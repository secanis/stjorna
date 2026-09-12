#!/bin/sh
set -e

# STJÓRNA PocketBase entrypoint for v0.40+
#
# PB v0.40 moved superusers into the _superusers auth collection. With an empty
# pb_data directory PocketBase prints a one-time install URL and waits; this
# script creates the initial superuser automatically so the container can start
# headless.

# Optional: provide a 32-character ASCII key in PB_SECRET to encrypt app settings.
# PocketBase uses AES-256 and expects exactly 32 bytes; wrong size aborts startup.
ENCRYPTION_FLAG=""
if [ -n "$PB_SECRET" ]; then
    if [ "${#PB_SECRET}" -eq 32 ]; then
        ENCRYPTION_FLAG="--encryptionEnv PB_SECRET"
    else
        echo "WARNING: PB_SECRET must be exactly 32 characters, got ${#PB_SECRET}; encryption disabled."
    fi
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
