#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# generate-openapi.sh — regenerate the committed site/public/openapi.json.
#
# Boots a throwaway PocketBase container (built from pocketbase/) and
# authenticates as the bootstrap superuser so /api/openapi.json returns the
# FULL 3-tier spec (Public + Private + Admin). An anonymous fetch would only
# return the Public tier, which is why we log in.
#
# The spec is derived from the migrations + route registry (see
# pocketbase/pb_hooks/lib/openapi.js), not from records, so it is stable
# across runs. The output lands in site/public/openapi.json, which Astro
# copies verbatim into site/dist/ at build time.

set -euo pipefail

# Resolve repo root so the script works regardless of CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE="localhost/stjorna-pocketbase:openapi"
CONTAINER="stjorna-openapi-gen"
PB_DOCKERFILE="$REPO_ROOT/pocketbase/Dockerfile"
PB_CONTEXT="$REPO_ROOT/pocketbase"
OUT_FILE="$REPO_ROOT/site/public/openapi.json"

# Bootstrap env mirrors the release-time bootstrap (and the e2e global-setup).
PB_SUPERUSER_EMAIL="openapi-gen@stjorna.local"
PB_SUPERUSER_PASSWORD="openapi-gen-password"
STJORNA_SETUP_TOKEN="openapi-gen-setup-token"
PB_SECRET="0123456789abcdef0123456789abcdef"

# Optional build-arg so info.version can be refreshed (defaults to "dev",
# which openapi.js renders as "3.x"). Pass e.g. STJORNA_VERSION=v3.0.0.
BUILD_ARGS=()
if [[ -n "${STJORNA_VERSION:-}" ]]; then
    BUILD_ARGS+=(--build-arg "STJORNA_VERSION=${STJORNA_VERSION}")
fi

echo "building PocketBase image (${IMAGE}) ..."
docker buildx build \
    --tag "$IMAGE" \
    --load \
    --file "$PB_DOCKERFILE" \
    "${BUILD_ARGS[@]}" \
    "$PB_CONTEXT"

echo "booting throwaway PB container (${CONTAINER}) ..."
# --tmpfs (mode 1777) so the uid-1000 pocketbase user can write pb_data on a
# Docker daemon whose named volumes are root-owned; we don't need persistence.
CONTAINER_ID="$(docker run -d --name "$CONTAINER" --network=host \
    --tmpfs /app/pb_data:rw,size=64m,mode=1777 \
    -e "PB_SUPERUSER_EMAIL=${PB_SUPERUSER_EMAIL}" \
    -e "PB_SUPERUSER_PASSWORD=${PB_SUPERUSER_PASSWORD}" \
    -e "STJORNA_SETUP_TOKEN=${STJORNA_SETUP_TOKEN}" \
    -e "PB_SECRET=${PB_SECRET}" \
    "$IMAGE")"

cleanup() {
    echo "cleaning up container ..."
    docker rm -f "$CONTAINER_ID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "waiting for PB /api/health ..."
ready=0
for i in $(seq 1 60); do
    RUNNING="$(docker inspect --format '{{.State.Running}}' "$CONTAINER_ID" 2>/dev/null || echo false)"
    if [[ "$RUNNING" != "true" ]]; then
        echo "PB container exited before becoming healthy" >&2
        docker logs "$CONTAINER_ID" 2>&1 || true
        exit 1
    fi
    if curl -fsS http://127.0.0.1:8090/api/health >/dev/null 2>&1; then
        ready=1
        echo "PB healthy after ${i}s"
        break
    fi
    sleep 1
done

if [[ "$ready" -ne 1 ]]; then
    echo "PB did not become healthy within 60s" >&2
    docker logs "$CONTAINER_ID" 2>&1 || true
    exit 1
fi

echo "authenticating as superuser ..."
TOKEN="$(curl -fsS -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"identity\":\"${PB_SUPERUSER_EMAIL}\",\"password\":\"${PB_SUPERUSER_PASSWORD}\"}" \
    http://127.0.0.1:8090/api/collections/_superusers/auth-with-password \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"

if [[ -z "$TOKEN" ]]; then
    echo "could not obtain a superuser token" >&2
    exit 1
fi

echo "fetching full (superuser) spec ..."
curl -fsS -H "Authorization: ${TOKEN}" \
    http://127.0.0.1:8090/api/openapi.json > "$OUT_FILE"

echo "verifying spec ..."
python3 - "$OUT_FILE" <<'PY'
import json
import os
import sys

spec = json.load(open(sys.argv[1]))
tags = [t["name"] for t in spec.get("tags", [])]
for want in ("Public", "Private", "Admin"):
    if want not in tags:
        raise SystemExit(f"spec is missing tag: {want}")
print("tags: " + ", ".join(tags))
print(f"bytes: {os.path.getsize(sys.argv[1])}")
PY

echo "wrote ${OUT_FILE}"
