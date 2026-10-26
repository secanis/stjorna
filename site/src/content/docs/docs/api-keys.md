---
title: API keys
description: Issue scoped, read-only keys for storefronts and backends.
---

API keys give a backend or storefront **read-only** access to exactly one tenant. They are the
recommended way to expose product data to a public website or an internal service without a human
account.

## How they work

Keys look like `stjorna_<tenant6>_<key6>.<secret40>`; only a hash is stored. Each key is backed by a
per-tenant **service user** that is a `viewer` member of its tenant.

A client sends the key as `Authorization: Bearer <key>` to the exchange route, then uses the
returned token as a normal PocketBase auth token against the regular collection API — so it sees
exactly what a tenant viewer sees, and nothing else.

## Routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/stjorna/api-keys` | superuser | Issue; the plaintext key is returned **once**. |
| `GET /api/stjorna/api-keys` | superuser | List metadata (never the key). |
| `DELETE /api/stjorna/api-keys/{id}` | superuser | Revoke (also invalidates issued tokens). |
| `GET /api/stjorna/api-keys/me` | API key | Introspect tenant / permissions. |
| `POST /api/stjorna/api-keys/exchange` | API key | Mint a short-lived (1 h) PocketBase auth token. |

## Example flow

```bash
# 1. Issue a key (superuser)
curl -X POST https://pb.example.com/api/stjorna/api-keys \
  -H "Authorization: <superuser-token>" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "..."}'

# 2. Exchange the key for a short-lived token
curl -X POST https://pb.example.com/api/stjorna/api-keys/exchange \
  -H "Authorization: Bearer stjorna_<tenant>_<key>.<secret>"

# 3. Use the returned token against the collection API
curl https://pb.example.com/api/collections/products/records \
  -H "Authorization: <token>"
```

The `demo/` app in the repository shows the full flow.
