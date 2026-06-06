#!/bin/sh
set -e

PB_URL="${PB_URL:-http://localhost:8090}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@stjorna.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin12345678}"

echo "Waiting for PocketBase to be ready..."
until curl -s "${PB_URL}/api/health" > /dev/null 2>&1; do
    sleep 1
done
echo "PocketBase is ready!"

echo "Authenticating as admin..."
RESPONSE=$(curl -s -X POST "${PB_URL}/api/admins/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
TOKEN=$(echo "$RESPONSE" | sed 's/.*"token":"\([^"]*\)".*/\1/')

if [ -z "$TOKEN" ]; then
    echo "Failed to authenticate, creating admin..."
    curl -s -X POST "${PB_URL}/api/admins" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\",\"passwordConfirm\":\"${ADMIN_PASSWORD}\"}" > /dev/null
    RESPONSE=$(curl -s -X POST "${PB_URL}/api/admins/auth-with-password" \
        -H "Content-Type: application/json" \
        -d "{\"identity\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")
    TOKEN=$(echo "$RESPONSE" | sed 's/.*"token":"\([^"]*\)".*/\1/')
fi

echo "Admin authenticated, setting up collections..."

setup_collection() {
    local name="$1"
    local schema="$2"
    local type="${3:-base}"

    EXISTING=$(curl -s "${PB_URL}/api/collections?perPage=200" -H "Authorization: $TOKEN")
    if echo "$EXISTING" | grep -q "\"name\":\"${name}\""; then
        echo "Collection '${name}' already exists, skipping..."
        return
    fi

    echo "Creating collection '${name}'..."
    curl -s -X POST "${PB_URL}/api/collections" \
        -H "Authorization: $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"${name}\",\"type\":\"${type}\",\"schema\":${schema}}"
    echo ""
}

TENANTS_SCHEMA='[
    {"name":"name","type":"text","required":true},
    {"name":"slug","type":"text","required":true},
    {"name":"plan","type":"select","required":false,"options":{"maxSelect":1,"values":["free","starter","professional","enterprise"]}},
    {"name":"custom_domain","type":"text","required":false},
    {"name":"theme_config","type":"json","required":false}
]'
setup_collection "tenants" "$TENANTS_SCHEMA"

CATEGORIES_SCHEMA='[
    {"name":"tenant","type":"text","required":true},
    {"name":"name","type":"text","required":true},
    {"name":"slug","type":"text","required":true},
    {"name":"description","type":"text","required":false},
    {"name":"image","type":"file","required":false,"options":{"maxSelect":1,"maxSize":10485760,"mimeTypes":["image/jpeg","image/png","image/webp","image/gif"]}},
    {"name":"active","type":"bool","required":false},
    {"name":"sort_order","type":"number","required":false},
    {"name":"createdUser","type":"text","required":false},
    {"name":"updatedUser","type":"text","required":false}
]'
setup_collection "categories" "$CATEGORIES_SCHEMA"

PRODUCTS_SCHEMA='[
    {"name":"tenant","type":"text","required":true},
    {"name":"category","type":"text","required":false},
    {"name":"name","type":"text","required":true},
    {"name":"slug","type":"text","required":true},
    {"name":"price","type":"number","required":false},
    {"name":"description","type":"editor","required":false},
    {"name":"images","type":"file","required":false,"options":{"maxSelect":99,"maxSize":10485760,"mimeTypes":["image/jpeg","image/png","image/webp","image/gif"]}},
    {"name":"active","type":"bool","required":false},
    {"name":"sort_order","type":"number","required":false},
    {"name":"custom_fields","type":"json","required":false},
    {"name":"createdUser","type":"text","required":false},
    {"name":"updatedUser","type":"text","required":false}
]'
setup_collection "products" "$PRODUCTS_SCHEMA"

MEDIA_SCHEMA='[
    {"name":"tenant","type":"text","required":true},
    {"name":"filename","type":"text","required":true},
    {"name":"original_name","type":"text","required":false},
    {"name":"mime_type","type":"text","required":false},
    {"name":"size","type":"number","required":false},
    {"name":"width","type":"number","required":false},
    {"name":"height","type":"number","required":false},
    {"name":"s3_key","type":"text","required":false},
    {"name":"s3_url","type":"url","required":false},
    {"name":"thumbnail_url","type":"url","required":false},
    {"name":"usage_count","type":"number","required":false},
    {"name":"createdUser","type":"text","required":false}
]'
setup_collection "media" "$MEDIA_SCHEMA"

PRODUCT_MEDIA_SCHEMA='[
    {"name":"tenant","type":"text","required":true},
    {"name":"product","type":"text","required":true},
    {"name":"media","type":"text","required":true},
    {"name":"sort_order","type":"number","required":false}
]'
setup_collection "product_media" "$PRODUCT_MEDIA_SCHEMA"

EMBED_CONFIGS_SCHEMA='[
    {"name":"tenant","type":"text","required":true},
    {"name":"name","type":"text","required":true},
    {"name":"embed_code","type":"text","required":false},
    {"name":"allowed_domains","type":"json","required":false},
    {"name":"active","type":"bool","required":false}
]'
setup_collection "embed_configs" "$EMBED_CONFIGS_SCHEMA"

ANALYTICS_SCHEMA='[
    {"name":"tenant","type":"text","required":true},
    {"name":"media","type":"text","required":false},
    {"name":"product","type":"text","required":false},
    {"name":"embed_config","type":"text","required":false},
    {"name":"domain","type":"text","required":false},
    {"name":"referer","type":"text","required":false},
    {"name":"client_ip","type":"text","required":false},
    {"name":"user_agent","type":"text","required":false},
    {"name":"timestamp","type":"date","required":false}
]'
setup_collection "analytics_events" "$ANALYTICS_SCHEMA"

WEBHOOKS_SCHEMA='[
    {"name":"tenant","type":"text","required":true},
    {"name":"name","type":"text","required":true},
    {"name":"url","type":"url","required":true},
    {"name":"events","type":"json","required":false},
    {"name":"secret","type":"text","required":false},
    {"name":"active","type":"bool","required":false}
]'
setup_collection "webhooks" "$WEBHOOKS_SCHEMA"

API_KEYS_SCHEMA='[
    {"name":"tenant","type":"text","required":true},
    {"name":"name","type":"text","required":true},
    {"name":"key_hash","type":"text","required":true},
    {"name":"permissions","type":"json","required":false},
    {"name":"last_used","type":"date","required":false},
    {"name":"expires","type":"date","required":false}
]'
setup_collection "api_keys" "$API_KEYS_SCHEMA"

SETTINGS_SCHEMA='[
    {"name":"tenant","type":"text","required":true},
    {"name":"config_json","type":"json","required":false}
]'
setup_collection "settings" "$SETTINGS_SCHEMA"

echo "All collections created successfully!"
echo "Setup complete!"