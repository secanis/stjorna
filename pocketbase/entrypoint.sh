#!/bin/sh
set -e

# STJÓRNA PocketBase entrypoint for v0.40+
#
# PB v0.40 moved superusers into the _superusers auth collection. With an empty
# pb_data directory PocketBase prints a one-time install URL and waits; this
# script creates the initial superuser automatically so the container can start
# headless.

# T-07: PB_SECRET must be exactly 32 characters (AES-256 key). Silently
# running PB without --encryptionEnv when the operator thought encryption
# was on is worse than crashing the pod with a loud error — that operator
# would otherwise find out the cluster was unencrypted the first time they
# read a backup file or restored to a new instance.
#
# Generating a fresh key (any of these work; PocketBase uses PB_SECRET
# directly as the AES-256 key string, so 32 ASCII chars are required):
#   openssl rand -hex 16                       # 32 hex chars
#   openssl rand -base64 32 | tr -d '=+/' | head -c 32
#   head -c 32 /dev/urandom | base64 | tr -d '=+/\\n' | head -c 32
#   LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
ENCRYPTION_FLAG=""
if [ -n "$PB_SECRET" ]; then
    if [ "${#PB_SECRET}" -ne 32 ]; then
        echo "FATAL: PB_SECRET must be exactly 32 characters (PocketBase AES-256 key)." >&2
        echo "       got ${#PB_SECRET} characters; refusing to start with encryption disabled." >&2
        echo "" >&2
        echo "Generate a fresh key with one of:" >&2
        echo "  openssl rand -hex 16" >&2
        echo "  openssl rand -base64 32 | tr -d '=+/' | head -c 32" >&2
        echo "  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32" >&2
        exit 1
    fi
    ENCRYPTION_FLAG="--encryptionEnv PB_SECRET"
fi

# Create the first superuser automatically on a fresh data directory. A marker
# file prevents resetting the password on every container restart.
if [ -n "$PB_SUPERUSER_EMAIL" ] && [ -n "$PB_SUPERUSER_PASSWORD" ] && [ ! -f /app/pb_data/.superuser-bootstrapped ]; then
    if /app/pocketbase superuser upsert "$PB_SUPERUSER_EMAIL" "$PB_SUPERUSER_PASSWORD" \
            --dir /app/pb_data \
            --hooksDir /app/pb_hooks \
            --automigrate="${PB_AUTOMIGRATE:-true}" \
            $ENCRYPTION_FLAG; then
        touch /app/pb_data/.superuser-bootstrapped
    fi
fi

# Apply superuser IP whitelist on every start so the env var stays authoritative.
# Default is unset/empty, which leaves access open (PB behavior). Set e.g.
# "10.0.0.0/8 172.16.0.0/12" to restrict. The special value "0.0.0.0/0" is
# treated as "allow all" and skipped to avoid IPv6 localhost lockouts.
IPS="${PB_SUPERUSER_IPS:-}"
if [ -n "$IPS" ] && [ "$IPS" != "0.0.0.0/0" ]; then
    /app/pocketbase superuser ips $IPS \
        --dir /app/pb_data \
        --hooksDir /app/pb_hooks \
        --automigrate="${PB_AUTOMIGRATE:-true}" \
        $ENCRYPTION_FLAG || true
fi

exec /app/pocketbase serve \
    --http 0.0.0.0:8090 \
    --dir /app/pb_data \
    --hooksDir /app/pb_hooks \
    --automigrate="${PB_AUTOMIGRATE:-true}" \
    $ENCRYPTION_FLAG
