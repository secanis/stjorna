#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# test-helm.sh — end-to-end test rig for the STJÓRNA helm chart.
#
# Modes:
#   (no flag)   full test: build images → kind cluster → install → smoke → upgrade → uninstall → cleanup
#   --build-only   build PB + frontend images, then exit
#   --lint-only    helm lint + helm template render check, then exit
#   --help         show usage
#
# T-06: the full mode also runs an `install → upgrade → verify` cycle
# to assert that namespace, PVC, PB_SECRET Secret and the data
# survive an upgrade. Defaults to namespace.create=true so the
# chart's own Namespace template is exercised.
#
# See helm/stjorna/README.md and the Makefile for the discoverable entry points.

set -euo pipefail

# Resolve script dir so we can source the lib regardless of CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/test-helm.lib.sh"

# --- Configuration -----------------------------------------------------
HELM_CHART="$SCRIPT_DIR/../helm/stjorna"
KIND_CLUSTER="stjorna-test"
KIND_CONFIG="$SCRIPT_DIR/kind-cluster.yaml"

REPO_OWNER="secanis"
PB_REPO="docker.io/${REPO_OWNER}/stjorna-pocketbase"
FE_REPO="docker.io/${REPO_OWNER}/stjorna-frontend"
TAG="v3.0.0-rc1"
PB_IMAGE="${PB_REPO}:${TAG}"
FE_IMAGE="${FE_REPO}:${TAG}"

KIND_VERSION="v0.24.0"
KIND_PATH="$HOME/.local/bin/kind"

export PATH="$HOME/.local/bin:$PATH"

# --- Usage -------------------------------------------------------------
usage() {
  cat <<EOF
Usage: $(basename "$0") [MODE] [--kube-context NAME]

Modes:
  (no flag)      Full end-to-end test (build images, create kind cluster,
                 install chart, smoke test, upgrade, uninstall, cleanup).
                 This is the default.
  --build-only   Build the PocketBase and frontend images, then exit.
  --lint-only    Run 'helm lint' and a 'helm template' render check, then exit.
  --keep-kind    Don't delete the kind cluster at the end (for debugging).
  --help         Show this help.

Options:
  --kube-context NAME   Override the kubectl context the test asserts on
                        (default: 'kind-$KIND_CLUSTER'). The script
                        refuses to run if 'kubectl config current-context'
                        is anything else — this is a safety net so a
                        stray invocation cannot target a real cluster.
                        Pass this flag ONLY when you have explicitly
                        pointed kubectl at an isolated test cluster.

Environment:
  KIND_VERSION   Kind version to install (default: $KIND_VERSION)
  TAG            Image tag to build and test (default: $TAG)
EOF
}

# --- Arg parse ---------------------------------------------------------
MODE="full"
KEEP_KIND=0
KUBE_CONTEXT="kind-${KIND_CLUSTER}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    "")            shift ;;
    --build-only)  MODE="build"; shift ;;
    --lint-only)   MODE="lint"; shift ;;
    --keep-kind)   KEEP_KIND=1; MODE="full"; shift ;;
    --kube-context) KUBE_CONTEXT="$2"; shift 2 ;;
    -h|--help)     usage; exit 0 ;;
    *)             printf '\033[1;31m[test]\033[0m unknown argument: %s\n\n' "$1" >&2
                   usage >&2
                   exit 1 ;;
  esac
done

# --- Bootstrap ---------------------------------------------------------
require helm
require kubectl
require curl
require python3

# Pick a container runtime. Prefer docker (works on GitHub Actions and
# most Linux desktops), fall back to podman (the historical default).
# Sets CONTAINER_CLI to the chosen binary name.
if command -v docker >/dev/null 2>&1; then
  CONTAINER_CLI=docker
elif command -v podman >/dev/null 2>&1; then
  CONTAINER_CLI=podman
else
  fail "missing dependency: neither docker nor podman found (install one)"
fi
log "container runtime: $CONTAINER_CLI"

log "STJÓRNA helm chart test rig"
log "  mode:   $MODE"
log "  chart:  $HELM_CHART"
log "  images: $PB_IMAGE, $FE_IMAGE"

# --- Mode: lint only ---------------------------------------------------
if [[ "$MODE" == "lint" ]]; then
  log "running helm lint ..."
  helm lint "$HELM_CHART"

  # Render the chart. If the optional garage subchart dep is not vendored
  # (the default, since twofleurs does not publish a public chart repo),
  # `helm template` will refuse. In that case, render a stripped copy that
  # omits the `dependencies:` block — this is enough to verify the base
  # chart's templates, labels, and ConfigMap content.
  RENDER_TMP=$(mktemp -d)
  trap 'rm -rf "$RENDER_TMP"' EXIT

  RENDER_OUT="$RENDER_TMP/rendered.yaml"
  if helm template stjorna "$HELM_CHART" \
      --set "ingress.hosts[0].host=stjorna.example.com" \
      > "$RENDER_OUT" 2>/dev/null; then
    log "rendered chart (full, with garage dep)"
  else
    log "garage subchart not vendored; rendering base chart only (Chart.yaml copied without dependencies:)"
    mkdir -p "$RENDER_TMP/chart"
    cp -r "$HELM_CHART"/. "$RENDER_TMP/chart/"
    sed -i 's/^dependencies:/xdependencies:/' "$RENDER_TMP/chart/Chart.yaml"
    helm template stjorna "$RENDER_TMP/chart" \
      --set "ingress.hosts[0].host=stjorna.example.com" \
      > "$RENDER_OUT" \
      || fail "helm template failed even without the garage dep"
  fi

  log "  rendered $(grep -c '^kind:' "$RENDER_OUT") resources"
  # Sanity assertions on the rendered output
  grep -q '^kind: PersistentVolumeClaim$' "$RENDER_OUT" \
    || fail "rendered output missing PVC"
  # NOTE: persistentVolumeReclaimPolicy is intentionally NOT on the PVC
  # (it's a PV field). Retain semantics come from the StorageClass.
  grep -q '^  openapi\.pb\.js:' "$RENDER_OUT" \
    || fail "rendered hooks ConfigMap is missing openapi.pb.js data"
  grep -q '^  setup\.pb\.js:' "$RENDER_OUT" \
    || fail "rendered hooks ConfigMap is missing setup.pb.js data"
  # The default-credentials Secret must render unless an existingSecret
  # was supplied. The lint-mode render uses no overrides, so the default
  # path is what we get.
  grep -q '^  name: stjorna-pocketbase-superuser$' "$RENDER_OUT" \
    || fail "rendered output missing default superuser Secret"
  # T-04: the Secret must be wired into the pod so entrypoint.sh creates
  # the superuser headlessly (the /setup bootstrap route is a fallback).
  grep -q '^            - name: PB_SUPERUSER_EMAIL$' "$RENDER_OUT" \
    || fail "rendered Deployment does not mount PB_SUPERUSER_EMAIL"
  grep -q '^            - name: PB_SUPERUSER_PASSWORD$' "$RENDER_OUT" \
    || fail "rendered Deployment does not mount PB_SUPERUSER_PASSWORD"
  ok "lint + render checks passed"
  exit 0
fi

# --- Kind install ------------------------------------------------------
install_kind_if_missing() {
  if [[ -x "$KIND_PATH" ]]; then
    log "kind found at $KIND_PATH ($("$KIND_PATH" version | head -1))"
    return
  fi
  log "downloading kind $KIND_VERSION to $KIND_PATH ..."
  mkdir -p "$(dirname "$KIND_PATH")"
  local url="https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-amd64"
  if ! curl -fsSL -o "$KIND_PATH" "$url"; then
    fail "failed to download kind from $url"
  fi
  chmod +x "$KIND_PATH"
  ok "kind installed at $KIND_PATH ($("$KIND_PATH" version | head -1))"
}

# --- Chart resolver ----------------------------------------------------
# Returns a path to a usable chart. If the optional garage subchart dep
# is not vendored (the default), copy the chart into a temp dir and
# strip the `dependencies:` block. Otherwise return the original path.
CHART_DIR=""
resolve_chart() {
  CHART_DIR="$HELM_CHART"
  if helm template stjorna "$HELM_CHART" \
       --set "ingress.hosts[0].host=t" >/dev/null 2>&1; then
    return 0
  fi
  log "garage subchart not vendored; using a stripped copy for install/render"
  local tmpdir
  tmpdir=$(mktemp -d)
  cp -r "$HELM_CHART"/. "$tmpdir/"
  sed -i 's/^dependencies:/xdependencies:/' "$tmpdir/Chart.yaml"
  CHART_DIR="$tmpdir"
}

# --- Image build -------------------------------------------------------
build_image_if_missing() {
  local image=$1 dockerfile=$2 context=$3
  if "$CONTAINER_CLI" image exists "$image" >/dev/null 2>&1; then
    log "image $image already present, skipping build"
    return
  fi
  log "building $image ..."
  (cd "$context" && "$CONTAINER_CLI" build -t "$image" -f "$dockerfile" .) \
    || fail "failed to build $image"
  ok "built $image"
}

# Run in build-only mode after this point
if [[ "$MODE" == "build" ]]; then
  build_image_if_missing "$PB_IMAGE" "$SCRIPT_DIR/../pocketbase/Dockerfile" "$SCRIPT_DIR/../pocketbase"
  build_image_if_missing "$FE_IMAGE" "$SCRIPT_DIR/../frontend/Dockerfile"   "$SCRIPT_DIR/../frontend"
  ok "all images built"
  exit 0
fi

# --- Full mode: build, kind, install, smoke, cleanup --------------------
install_kind_if_missing

build_image_if_missing "$PB_IMAGE" "$SCRIPT_DIR/../pocketbase/Dockerfile" "$SCRIPT_DIR/../pocketbase"
build_image_if_missing "$FE_IMAGE" "$SCRIPT_DIR/../frontend/Dockerfile"        "$SCRIPT_DIR/../frontend"

# Trap to ensure kind cluster is cleaned up on any exit
cleanup_kind() {
  if [[ "${KEEP_KIND:-0}" -eq 1 ]]; then
    warn "KEEP_KIND=1, leaving kind cluster '$KIND_CLUSTER' running"
    return
  fi
  # Just try to delete; ignore "not found" errors. The previous
  # "kind get clusters | grep" pattern fails with podman due to a
  # template-string bug in some kind versions.
  if "$KIND_PATH" delete cluster --name "$KIND_CLUSTER" >/dev/null 2>&1; then
    log "kind cluster '$KIND_CLUSTER' deleted"
  fi
}
trap cleanup_kind EXIT INT TERM

# Create kind cluster
if "$KIND_PATH" get clusters 2>/dev/null | grep -q "^${KIND_CLUSTER}$"; then
  log "kind cluster '$KIND_CLUSTER' already exists, reusing it"
else
  log "creating kind cluster '$KIND_CLUSTER' from $KIND_CONFIG ..."
  "$KIND_PATH" create cluster --config "$KIND_CONFIG" \
    || fail "failed to create kind cluster"
  ok "kind cluster created"
fi

# Load images
log "loading images into kind ..."
"$KIND_PATH" load docker-image "$PB_IMAGE" --name "$KIND_CLUSTER" >/dev/null
"$KIND_PATH" load docker-image "$FE_IMAGE" --name "$KIND_CLUSTER" >/dev/null
ok "images loaded"

# Resolve chart (strips optional garage dep if not vendored)
resolve_chart

# Install chart
NS="stjorna-test-$(date +%s)"
log "installing chart in namespace $NS (context: $KUBE_CONTEXT) ..."

# Safety net (T-06 + general): refuse to run if the kubectl current
# context is not the kind cluster the script created. Without this,
# a stray `scripts/test-helm.sh --keep-kind` followed by a re-run
# could target the user's actual prod cluster.
ACTUAL_CONTEXT="$(kubectl config current-context 2>/dev/null || echo '<unset>')"
if [[ "$ACTUAL_CONTEXT" != "$KUBE_CONTEXT" ]]; then
  fail "kubectl current-context is '$ACTUAL_CONTEXT', not '$KUBE_CONTEXT'. Refusing to run (would target a real cluster). Pass --kube-context to override on isolated clusters only."
fi

# T-06: install with `namespace.create=true` (the chart default) so the
# chart's own Namespace template is exercised — that's the path the bug
# used to break. `--create-namespace` is still required because helm
# checks namespace existence BEFORE rendering the chart; the chart's
# Namespace resource is then `kubectl apply`-merged onto the existing
# one (idempotent, no race in practice).
# The default storageClass is "longhorn" (production); for local kind
# testing we override to "standard" (the kind default StorageClass).
helm install stjorna "$CHART_DIR" \
  --namespace "$NS" --create-namespace \
  --set "namespace.create=true" \
  --set "namespace.name=$NS" \
  --set "ingress.enabled=false" \
  --set "pocketbase.persistence.storageClass=standard" \
  --set "pocketbase.image.pullPolicy=Never" \
  --set "frontend.image.pullPolicy=Never" \
  --set "pocketbase.hooks.mountFromConfigMap=false" \
  --set "pocketbase.image.tag=$TAG" \
  --set "frontend.image.tag=$TAG" \
  || fail "helm install failed"
ok "chart installed in $NS"

# Compute resource names
PB_DEPLOY="stjorna-pocketbase"
FE_DEPLOY="stjorna-frontend"
PB_SVC="stjorna-pocketbase"
FE_SVC="stjorna-frontend"
PB_PVC="stjorna-pocketbase"

# Wait for pods
wait_for_deployment "$NS" "$PB_DEPLOY" 180
wait_for_deployment "$NS" "$FE_DEPLOY" 180

# Port-forward
PB_PORT=$(pick_free_port)
FE_PORT=$(pick_free_port)
log "port-forwarding: PB http://localhost:$PB_PORT, FE http://localhost:$FE_PORT"
kubectl port-forward -n "$NS" "svc/$PB_SVC" "$PB_PORT:8090" >/dev/null 2>&1 &
PF_PB_PID=$!
kubectl port-forward -n "$NS" "svc/$FE_SVC" "$FE_PORT:8080" >/dev/null 2>&1 &
PF_FE_PID=$!
cleanup_portforwards() {
  kill "$PF_PB_PID" "$PF_FE_PID" 2>/dev/null || true
}
trap 'cleanup_portforwards; cleanup_kind; [[ "$CHART_DIR" != "$HELM_CHART" && -n "$CHART_DIR" ]] && rm -rf "$CHART_DIR"' EXIT INT TERM

# Give port-forward a moment to bind
sleep 2

# Smoke tests: PocketBase direct
assert_http_status "http://localhost:$PB_PORT/api/health"   200 "PB /api/health"
assert_json_valid   "http://localhost:$PB_PORT/api/openapi.json" "PB /api/openapi.json"
assert_json_field   "http://localhost:$PB_PORT/api/openapi.json" '["openapi"]' "3.0.3" "PB openapi"
# The openapi.pb.js hook should have loaded and registered the spec
assert_json_field   "http://localhost:$PB_PORT/api/openapi.json" '["tags"][0]["name"]' "Public" "PB tag[0]"

# Smoke tests: Frontend (nginx)
assert_http_status  "http://localhost:$FE_PORT/"        200 "FE /"
assert_http_status  "http://localhost:$FE_PORT/api/health" 200 "FE /api/health (proxied)"
assert_json_valid   "http://localhost:$FE_PORT/api/openapi.json" "FE /api/openapi.json (proxied)"

# First-run setup (T-04). The chart mounts the superuser Secret into the
# pod as PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD and entrypoint.sh
# creates the superuser headlessly on the first boot. So on a fresh kind
# install:
#   - setup-status must already report superuserExists=true
#   - the unauthenticated bootstrap route must refuse: 401 without the
#     setup token, and never 200 (the superuser exists → 409)
#   - the credentials from the Secret must actually log in
SUPERUSER_SECRET_NAME="${PB_DEPLOY}-superuser"
log "probing setup-status (expect superuserExists=true: headless upsert from the Secret) ..."
assert_json_field "http://localhost:$PB_PORT/api/stjorna/setup-status" '["superuserExists"]' "True" "setup-status.superuserExists"
assert_json_field "http://localhost:$PB_PORT/api/stjorna/setup-status" '["setupDone"]' "False" "setup-status.setupDone"

log "POSTing /api/stjorna/setup-bootstrap-superuser WITHOUT a setup token (expect 401) ..."
SETUP_BOOTSTRAP_BODY=$(mktemp)
trap 'rm -f "$SETUP_BOOTSTRAP_BODY"; cleanup_portforwards; cleanup_kind; [[ "$CHART_DIR" != "$HELM_CHART" && -n "$CHART_DIR" ]] && rm -rf "$CHART_DIR"' EXIT INT TERM
cat > "$SETUP_BOOTSTRAP_BODY" <<EOF
{"email":"attacker@stjorna-helm-test.local","password":"AttackerPass1234abcd","passwordConfirm":"AttackerPass1234abcd"}
EOF
# Pre-existing inconsistency on main (not introduced by T-06): with the
# helm chart's headless superuser upsert the real superuser exists from
# first boot, so the bootstrap route 409s (superuser exists) BEFORE it
# gets a chance to verify the token. The 401-only-no-token case is only
# exercised in dev / docker-compose where PB_SUPERUSER_EMAIL is not
# pre-seeded. We accept either 401 (token-first, dev path) or 409
# (superuser-first, helm path) here as long as we never see 200.
SETUP_BOOTSTRAP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X POST -H 'Content-Type: application/json' \
  --data-binary "@$SETUP_BOOTSTRAP_BODY" \
  "http://localhost:$PB_PORT/api/stjorna/setup-bootstrap-superuser" || echo "000")
case "$SETUP_BOOTSTRAP_STATUS" in
  401|409)
    ok "setup-bootstrap-superuser without token rejected with HTTP $SETUP_BOOTSTRAP_STATUS" ;;
  *)
    fail "setup-bootstrap-superuser without token: expected HTTP 401 or 409, got $SETUP_BOOTSTRAP_STATUS" ;;
esac

# With a (wrong) token the route must still never mint an admin.
SETUP_BOOTSTRAP_STATUS_2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X POST -H 'Content-Type: application/json' \
  -H 'X-Stjorna-Setup-Token: definitely-not-the-real-token' \
  --data-binary "@$SETUP_BOOTSTRAP_BODY" \
  "http://localhost:$PB_PORT/api/stjorna/setup-bootstrap-superuser" || echo "000")
if [[ "$SETUP_BOOTSTRAP_STATUS_2" == "200" ]]; then
  fail "setup-bootstrap-superuser with a bogus token returned HTTP 200 — the guard is broken"
fi
ok "setup-bootstrap-superuser with a bogus token rejected with HTTP $SETUP_BOOTSTRAP_STATUS_2"

# Read the headless-bootstrap credentials back from the Secret and confirm
# they log in (this is what the /setup wizard does in step 1).
log "reading superuser credentials from Secret $SUPERUSER_SECRET_NAME ..."
SETUP_EMAIL=$(kubectl get secret -n "$NS" "$SUPERUSER_SECRET_NAME" -o jsonpath='{.data.PB_SUPERUSER_EMAIL}' | base64 -d)
SETUP_PASSWORD=$(kubectl get secret -n "$NS" "$SUPERUSER_SECRET_NAME" -o jsonpath='{.data.PB_SUPERUSER_PASSWORD}' | base64 -d)
if [[ -z "$SETUP_EMAIL" || -z "$SETUP_PASSWORD" ]]; then
  fail "superuser Secret $SUPERUSER_SECRET_NAME is missing PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD"
fi
SETUP_LOGIN_BODY=$(mktemp)
trap 'rm -f "$SETUP_BOOTSTRAP_BODY" "$SETUP_LOGIN_BODY"; cleanup_portforwards; cleanup_kind; [[ "$CHART_DIR" != "$HELM_CHART" && -n "$CHART_DIR" ]] && rm -rf "$CHART_DIR"' EXIT INT TERM
python3 -c 'import json,sys; print(json.dumps({"identity": sys.argv[1], "password": sys.argv[2]}))' \
  "$SETUP_EMAIL" "$SETUP_PASSWORD" > "$SETUP_LOGIN_BODY"
SETUP_TOKEN=$(curl -fsS --max-time 10 \
  -X POST -H 'Content-Type: application/json' \
  --data-binary "@$SETUP_LOGIN_BODY" \
  "http://localhost:$PB_PORT/api/collections/_superusers/auth-with-password" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
if [[ -z "$SETUP_TOKEN" ]]; then
  fail "could not log in with the superuser credentials from the Secret"
fi
ok "superuser from Secret logs in (${#SETUP_TOKEN}-char token)"

# Verify the auto-generated superuser Secret was created and is readable
log "checking superuser Secret $SUPERUSER_SECRET_NAME exists in $NS ..."
if ! kubectl get secret -n "$NS" "$SUPERUSER_SECRET_NAME" >/dev/null 2>&1; then
  fail "superuser Secret $SUPERUSER_SECRET_NAME not found in $NS"
fi
ok "superuser Secret $SUPERUSER_SECRET_NAME exists"

# --- T-06: install → upgrade → verify ----------------------------------
# Seed a record so we can prove data survives the upgrade, and snapshot
# PB_SECRET so we can prove it isn't rotated. We do this BEFORE the
# upgrade so the upgrade is the only thing that could break it.
log "T-06: seeding a test record (proves data survives upgrade) ..."
TEST_RECORD_BODY=$(mktemp)
python3 -c 'import json,sys; print(json.dumps({"name": "t06-canary", "slug": "t06-canary-'"$(date +%s)"'"}))' > "$TEST_RECORD_BODY"
TEST_RECORD_ID=$(curl -fsS --max-time 10 \
  -X POST -H 'Content-Type: application/json' \
  -H "Authorization: $SETUP_TOKEN" \
  --data-binary "@$TEST_RECORD_BODY" \
  "http://localhost:$PB_PORT/api/collections/tenants/records" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
if [[ -z "$TEST_RECORD_ID" ]]; then
  fail "could not create test tenant record before upgrade"
fi
ok "seeded tenant id=$TEST_RECORD_ID"

log "T-06: snapshotting PB_SECRET (must be unchanged across upgrade) ..."
PB_SECRET_NAME="$PB_DEPLOY"
PB_SECRET_BEFORE=$(kubectl get secret -n "$NS" "$PB_SECRET_NAME" -o jsonpath='{.data.PB_SECRET}' | base64 -d)
if [[ -z "$PB_SECRET_BEFORE" ]]; then
  fail "PB_SECRET Secret '$PB_SECRET_NAME' missing or empty in $NS"
fi
ok "PB_SECRET length=${#PB_SECRET_BEFORE} bytes"

# Tear down port-forwards while the upgrade runs (the chart will
# replace the PB pod, which briefly drops /api/health).
kill "$PF_PB_PID" "$PF_FE_PID" 2>/dev/null || true

log "T-06: running helm upgrade with the same flags as install ..."
helm upgrade stjorna "$CHART_DIR" \
  --namespace "$NS" \
  --set "namespace.create=true" \
  --set "namespace.name=$NS" \
  --set "ingress.enabled=false" \
  --set "pocketbase.persistence.storageClass=standard" \
  --set "pocketbase.image.pullPolicy=Never" \
  --set "frontend.image.pullPolicy=Never" \
  --set "pocketbase.hooks.mountFromConfigMap=false" \
  --set "pocketbase.image.tag=$TAG" \
  --set "frontend.image.tag=$TAG" \
  || fail "helm upgrade failed (T-06 regression: chart must install+upgrade cleanly)"
ok "helm upgrade completed"

# After upgrade: namespace, PVC, PB_SECRET and the test record must all
# be intact.
if ! kubectl get namespace "$NS" >/dev/null 2>&1; then
  fail "T-06: namespace $NS was DELETED by helm upgrade (the bug we just fixed)"
fi
ok "namespace $NS survived helm upgrade"

assert_pvc_exists "$NS" "$PB_PVC"

PB_SECRET_AFTER=$(kubectl get secret -n "$NS" "$PB_SECRET_NAME" -o jsonpath='{.data.PB_SECRET}' | base64 -d)
if [[ "$PB_SECRET_AFTER" != "$PB_SECRET_BEFORE" ]]; then
  fail "T-06: PB_SECRET was ROTATED by helm upgrade. Before=${#PB_SECRET_BEFORE}b After=${#PB_SECRET_AFTER}b. data.db is now unreadable."
fi
ok "PB_SECRET unchanged across upgrade (${#PB_SECRET_AFTER} bytes)"

# Re-port-forward and wait for the PB pod to come back
PB_PORT=$(pick_free_port)
FE_PORT=$(pick_free_port)
log "re-port-forwarding: PB http://localhost:$PB_PORT, FE http://localhost:$FE_PORT"
kubectl port-forward -n "$NS" "svc/$PB_SVC" "$PB_PORT:8090" >/dev/null 2>&1 &
PF_PB_PID=$!
kubectl port-forward -n "$NS" "svc/$FE_SVC" "$FE_PORT:8080" >/dev/null 2>&1 &
PF_FE_PID=$!
sleep 2

# Wait for the new PB pod to be ready, then confirm the test record is
# still there.
wait_for_deployment "$NS" "$PB_DEPLOY" 180
wait_for_deployment "$NS" "$FE_DEPLOY" 180

log "T-06: confirming test record id=$TEST_RECORD_ID still exists after upgrade ..."
GET_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -H "Authorization: $SETUP_TOKEN" \
  "http://localhost:$PB_PORT/api/collections/tenants/records/$TEST_RECORD_ID" || echo "000")
if [[ "$GET_STATUS" != "200" ]]; then
  fail "T-06: test record $TEST_RECORD_ID missing after upgrade (HTTP $GET_STATUS) — data was lost"
fi
ok "test record survived upgrade (HTTP 200)"

# --- Helm test (the chart's own test-connection Pod) -------------------
log "running helm test ..."
helm test stjorna -n "$NS" --logs || warn "helm test reported an issue (continuing)"

# --- Uninstall ---------------------------------------------------------
log "uninstalling chart ..."
helm uninstall stjorna -n "$NS" \
  || warn "helm uninstall failed (continuing)"

# T-06: `helm uninstall` must NOT take the data with it.
log "T-06: verifying uninstall preserves PVC, Namespace and PB_SECRET Secret ..."
assert_pvc_exists "$NS" "$PB_PVC"

if ! kubectl get namespace "$NS" >/dev/null 2>&1; then
  fail "T-06: namespace $NS was DELETED by helm uninstall — resource-policy: keep is missing on namespace.yaml"
fi
ok "namespace $NS survived helm uninstall (resource-policy: keep)"

if ! kubectl get secret -n "$NS" "$PB_SECRET_NAME" >/dev/null 2>&1; then
  fail "T-06: PB_SECRET Secret $NS/$PB_SECRET_NAME was DELETED by helm uninstall — data.db is now unreadable on re-install"
fi
PB_SECRET_FINAL=$(kubectl get secret -n "$NS" "$PB_SECRET_NAME" -o jsonpath='{.data.PB_SECRET}' | base64 -d)
if [[ "$PB_SECRET_FINAL" != "$PB_SECRET_BEFORE" ]]; then
  fail "T-06: PB_SECRET changed across uninstall. Before=${#PB_SECRET_BEFORE}b After=${#PB_SECRET_FINAL}b"
fi
ok "PB_SECRET Secret $NS/$PB_SECRET_NAME survived helm uninstall unchanged (resource-policy: keep)"

# Final cleanup: now that the assertions have run, drop the namespace +
# the PVC that resource-policy: keep left behind.
log "deleting test namespace + PVC ..."
kubectl delete namespace "$NS" --wait=false >/dev/null 2>&1 || true
kubectl delete pvc -n "$NS" --all --wait=false >/dev/null 2>&1 || true

ok "all tests passed"
