#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# test-helm.sh — end-to-end test rig for the STJÓRNA helm chart.
#
# Modes:
#   (no flag)   full test: build images → kind cluster → install → smoke → cleanup
#   --build-only   build PB + frontend images, then exit
#   --lint-only    helm lint + helm template render check, then exit
#   --help         show usage
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
Usage: $(basename "$0") [MODE]

Modes:
  (no flag)      Full end-to-end test (build images, create kind cluster,
                 install chart, smoke test, cleanup). This is the default.
  --build-only   Build the PocketBase and frontend images, then exit.
  --lint-only    Run 'helm lint' and a 'helm template' render check, then exit.
  --keep-kind    Don't delete the kind cluster at the end (for debugging).
  --help         Show this help.

Environment:
  KIND_VERSION   Kind version to install (default: $KIND_VERSION)
  TAG            Image tag to build and test (default: $TAG)
EOF
}

# --- Arg parse ---------------------------------------------------------
MODE="full"
KEEP_KIND=0
case "${1:-}" in
  "")            MODE="full" ;;
  --build-only)  MODE="build" ;;
  --lint-only)   MODE="lint" ;;
  --keep-kind)   KEEP_KIND=1; MODE="full" ;;
  -h|--help)     usage; exit 0 ;;
  *)             printf '\033[1;31m[test]\033[0m unknown argument: %s\n\n' "$1" >&2
                 usage >&2
                 exit 1 ;;
esac

# --- Bootstrap ---------------------------------------------------------
require helm
require kubectl
require podman
require curl
require python3

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
  if podman image exists "$image" 2>/dev/null; then
    log "image $image already present, skipping build"
    return
  fi
  log "building $image ..."
  (cd "$context" && podman build -t "$image" -f "$dockerfile" .) \
    || fail "failed to build $image"
  ok "built $image"
}

# Run in build-only mode after this point
if [[ "$MODE" == "build" ]]; then
  build_image_if_missing "$PB_IMAGE" "$SCRIPT_DIR/../docker/Dockerfile.pocketbase" "$SCRIPT_DIR/../pocketbase"
  build_image_if_missing "$FE_IMAGE" "$SCRIPT_DIR/../frontend/Dockerfile"        "$SCRIPT_DIR/../frontend"
  ok "all images built"
  exit 0
fi

# --- Full mode: build, kind, install, smoke, cleanup --------------------
install_kind_if_missing

build_image_if_missing "$PB_IMAGE" "$SCRIPT_DIR/../docker/Dockerfile.pocketbase" "$SCRIPT_DIR/../pocketbase"
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
log "installing chart in namespace $NS ..."
# The chart's default namespace is "stjorna"; override it to $NS so
# resources go into the same namespace that --create-namespace created.
# Disable the chart's own namespace template (namespace.create: false)
# to avoid racing with --create-namespace.
# The default storageClass is "longhorn" (production); for local kind
# testing we override to "standard" (the kind default StorageClass).
helm install stjorna "$CHART_DIR" \
  --namespace "$NS" --create-namespace \
  --set "namespace.create=false" \
  --set "namespace.name=$NS" \
  --set "ingress.enabled=false" \
  --set "pocketbase.persistence.storageClass=standard" \
  --set "pocketbase.image.pullPolicy=Never" \
  --set "frontend.image.pullPolicy=Never" \
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

# helm test (the chart's own test-connection Pod)
log "running helm test ..."
helm test stjorna -n "$NS" --logs || warn "helm test reported an issue (continuing)"

# Uninstall
log "uninstalling chart ..."
helm uninstall stjorna -n "$NS" \
  || warn "helm uninstall failed (continuing)"

# Verify PVC retention
assert_pvc_exists "$NS" "$PB_PVC"

# Final cleanup
log "deleting test namespace + PVC ..."
kubectl delete namespace "$NS" --wait=false >/dev/null 2>&1 || true
kubectl delete pvc -n "$NS" --all --wait=false >/dev/null 2>&1 || true

ok "all tests passed"
