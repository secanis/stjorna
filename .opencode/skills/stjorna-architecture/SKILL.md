---
name: stjorna-architecture
description: Provides architecture guidance for STJÓRNA product management application. Use when discussing STJÓRNA redesign, PocketBase collection design, SolidJS frontend, multi-tenant role model, S3 file storage, OpenAPI docs, or Helm/Kubernetes deployment for STJÓRNA.
---

# STJÓRNA Architecture Skill

This skill used to carry a full architecture write-up for the PocketBase
v0.22 era. That content is obsolete (STJÓRNA runs on **PocketBase v0.40**)
and has been removed so it cannot mislead. Read the sources of truth
instead:

| Topic | Where |
|---|---|
| Quick start, storage (S3 via PB settings), auth model, roles, OIDC, API keys, OpenAPI, CI/CD | `README.md` |
| Environment variables (`PB_SECRET` = exactly 32 chars, superuser bootstrap, IP allowlist) | `.env.example` |
| Collection schema | `pocketbase/pb_migrations/*.js` (in timestamp order; `1740000000_create_core_collections.js` is the base, later files change it) |
| Access rules / tenant isolation | `pocketbase/pb_migrations/1770001000_lock_tenant_isolation.js` (header comment) |
| API keys (issue / exchange / revoke) | `pocketbase/pb_hooks/api_keys.pb.js` (header comment) |
| OIDC group → tenant/role mapping | `pocketbase/pb_hooks/oidc_groups.pb.js`, `pocketbase/pb_hooks/lib/oidc.js` |
| Setup wizard bootstrap / setup token | `pocketbase/pb_hooks/setup.pb.js` |
| Tenant export / import | `pocketbase/pb_hooks/lib/backup.js` |
| Behaviour as tested | `pocketbase/tests/*.test.ts`, `frontend/tests/e2e/` |
| Kubernetes | `helm/stjorna/README.md` |

Key facts (verify against the files above before relying on them):

- Two account kinds: PB superusers (`_superusers`, instance operators) and
  `users` (tenant members, no public sign-up).
- Tenant access = `user_tenants` (user, tenant, role) with roles
  `viewer` / `editor` / `admin`, enforced by collection API rules.
- API keys are read-only per tenant: `POST /api/stjorna/api-keys/exchange`
  turns a key into a short-lived token of a per-tenant `viewer` service user.
- PocketBase owns file storage (local or S3) and thumbnails; STJÓRNA keeps
  no copy of storage config or credentials in its own collections.
