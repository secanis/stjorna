#!/bin/sh
# Generate the runtime config (/config.js) from the environment at container
# start, so one image can be pointed at a different PocketBase without a
# rebuild. Run by the nginx image's /docker-entrypoint.sh.
#
#   PB_URL  PocketBase origin, e.g. https://pb.example.com. Leave empty (the
#           default) when nginx proxies /api on the same origin.
#
# Written to /tmp (writable for the unprivileged nginx user); nginx serves it
# as /config.js and falls back to the build-time default in the html dir if
# it is missing.
set -eu

OUT_DIR="${STJORNA_CONFIG_DIR:-/tmp/stjorna}"
PB_URL="${PB_URL:-}"

# Escape for a JS double-quoted string.
esc=$(printf '%s' "$PB_URL" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/</\\u003c/g')

if mkdir -p "$OUT_DIR" 2>/dev/null &&
  printf 'window.__STJORNA_CONFIG__ = { pbUrl: "%s" };\n' "$esc" > "$OUT_DIR/config.js.tmp" 2>/dev/null &&
  mv "$OUT_DIR/config.js.tmp" "$OUT_DIR/config.js"; then
  echo "40-stjorna-config.sh: wrote $OUT_DIR/config.js (pbUrl=${PB_URL:-<same origin>})"
else
  echo "40-stjorna-config.sh: WARNING: cannot write $OUT_DIR/config.js; using built-in defaults" >&2
fi
