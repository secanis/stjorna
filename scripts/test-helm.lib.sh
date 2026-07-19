#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# test-helm.lib.sh — assertion and wait helpers for scripts/test-helm.sh
# Source-only library; do not execute directly.

# Guard: only source, never execute
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "test-helm.lib.sh: source-only library, do not execute directly" >&2
  exit 1
fi

# --- Colors / logging --------------------------------------------------
log()  { printf '\033[1;34m[test]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  !\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[1;31m  ✗\033[0m %s\n' "$*" >&2; exit 1; }

# --- Dependency check --------------------------------------------------
require() {
  command -v "$1" >/dev/null 2>&1 || fail "missing dependency: $1 (please install it)"
}

# --- Asserts -----------------------------------------------------------
assert_http_status() {
  local url=$1 expected=$2 label=${3:-$url}
  local actual
  actual=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || echo "000")
  if [[ "$actual" != "$expected" ]]; then
    fail "$label: expected HTTP $expected, got $actual"
  fi
  ok "$label: HTTP $actual"
}

assert_json_valid() {
  local url=$1 label=${2:-$url}
  if ! curl -fsS --max-time 10 "$url" | python3 -c 'import json, sys; json.load(sys.stdin)' 2>/dev/null; then
    fail "$label: response is not valid JSON"
  fi
  ok "$label: valid JSON"
}

# assert_json_field <url> <python expression suffix> <expected>
# Example: assert_json_field "$URL" '["tags"][0]["name"]' "Public"
# The fetched JSON is piped into python3 as `data`; the suffix is appended
# to `print(data...)`.
assert_json_field() {
  local url=$1 py_path=$2 expected=$3 label=${4:-$url}
  local actual
  if ! actual=$(curl -fsS --max-time 10 "$url" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d${py_path})" 2>/dev/null); then
    fail "$label: could not extract ${py_path} (network or JSON error)"
  fi
  if [[ "$actual" != "$expected" ]]; then
    fail "$label${py_path}: expected '$expected', got '$actual'"
  fi
  ok "$label${py_path} = '$expected'"
}

assert_pvc_exists() {
  local ns=$1 name=$2
  if ! kubectl get pvc -n "$ns" "$name" >/dev/null 2>&1; then
    fail "PVC $ns/$name not found (was the Reclaim policy respected?)"
  fi
  ok "PVC $ns/$name exists (Reclaim policy honored)"
}

# --- Wait helpers ------------------------------------------------------
wait_for_pod() {
  local ns=$1 selector=$2 timeout=${3:-180}
  log "waiting up to ${timeout}s for pods with label $selector in $ns ..."
  if ! kubectl wait --for=condition=ready -n "$ns" pod -l "$selector" --timeout="${timeout}s" >/dev/null 2>&1; then
    kubectl get pods -n "$ns" -l "$selector" || true
    kubectl describe pods -n "$ns" -l "$selector" 2>/dev/null | tail -40 || true
    fail "pods with label $selector not ready in $ns after ${timeout}s"
  fi
  ok "pods with label $selector ready in $ns"
}

wait_for_deployment() {
  local ns=$1 name=$2 timeout=${3:-180}
  log "waiting up to ${timeout}s for deployment $ns/$name ..."
  if ! kubectl wait --for=condition=available -n "$ns" "deployment/$name" --timeout="${timeout}s" >/dev/null 2>&1; then
    kubectl get deployment -n "$ns" "$name" -o yaml 2>/dev/null | tail -30 || true
    fail "deployment $ns/$name not available after ${timeout}s"
  fi
  ok "deployment $ns/$name available"
}

# Free-port picker (returns a random port in 30000-39999 that isn't bound)
pick_free_port() {
  while :; do
    local p=$(( (RANDOM % 10000) + 30000 ))
    if ! ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":$p$"; then
      echo "$p"
      return
    fi
  done
}
