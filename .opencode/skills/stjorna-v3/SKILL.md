---
name: stjorna-v3
description: >-
    STJÓRNA v3 project map and release retrospective. Use to orient on the repo
    structure, recall what shipped in the v3 rewrite + security hardening
    (T-01…T-23), and avoid reintroducing patterns that were already fixed.
    Trigger on "project structure", "v3 release", "what did we ship", "hardening
    status", "where is X", or any new STJÓRNA feature/refactor/security task.
---

# STJÓRNA v3 — project map & release retrospective

STJÓRNA is a **multi-tenant product catalogue / product-management tool**.
Tenants own categories, products and media (images/videos); a REST API
(PocketBase collections + custom routes) serves that data to external sites
(`demo/` is a small SolidJS storefront consumer of it).

| Layer               | Tech                                             | Location                              |
| ------------------- | ------------------------------------------------ | ------------------------------------- |
| Backend             | PocketBase **v0.40.4** (Go, SQLite, JSVM hooks)  | `pocketbase/`                         |
| Frontend (admin UI) | SolidJS + Vite + Tailwind, PB JS SDK `^0.28`     | `frontend/`                           |
| Demo consumer       | SolidJS + Vite, API-key → exchange → JWT         | `demo/`                               |
| Deploy              | Docker Compose + Helm chart (kind-tested)        | `docker-compose.yml`, `helm/stjorna/` |
| Docs site           | Astro/Starlight, published to gh-pages           | `site/`                               |
| i18n                | `@solid-primitives/i18n`, en (default) / de / fr | `frontend/src/i18n/`                  |

## 1. Repo layout

```
pocketbase/
  pb_migrations/          # schema + API rules, timestamp-ordered (20 files,
                          #   latest 1780001000_schema_cleanup.js)
  pb_hooks/*.pb.js        # thin: register routes/hooks, log
  pb_hooks/lib/*.js       # shared modules (http, routes, apikeys, setup, stats,
                          #   users, backup, mfa, oidc, openapi)
  tests/*.test.ts         # vitest integration tests (real PB container)
  Dockerfile, entrypoint.sh
frontend/
  src/pages/              # Dashboard, lists, edits, Settings, Setup, auth, …
  src/stores/             # auth, tenant, tenantTheme, theme, sidebar
  src/components/         # ui/, layout/, auth/, media/, tenants/, settings/, backup/
  src/i18n/{en,de,fr,index}.ts
  src/services/           # pocketbase singleton, catalog, backup, …
  src/types/index.ts      # hand-written record shapes (typegen deferred → T-17.1)
  tests/e2e/              # Playwright + vitest unit tests
demo/                     # storefront consumer (API key → exchange → JWT)
helm/stjorna/             # chart: frontend + pocketbase, PVC, secrets, networkpolicy
site/                     # Astro/Starlight docs + Swagger UI (gh-pages)
scripts/                  # check-hooks.mjs, test-helm.sh, generate-openapi.sh
.opencode/improvements.md   # T-01…T-23 task ledger + follow-ups (tracked)
```

## 2. What v3 was

v3.0.0 (2026-10-20) was two things at once:

1. **The v0.22 → v0.40 rewrite.** PocketBase upgraded, the JSVM hooks
   refactored from string-built `new Function("e", BODY)` handlers to proper
   `lib/*.js` modules loaded via `require(\`${\_\_hooks}/lib/x.js\`)`, the
   SolidJS frontend rewired, setup wizard bootstrapping the first superuser
   via a hook + setup token, tenant API keys, OIDC group→role sync, MFA,
   S3 storage, tenant export/import.
2. **The security hardening sprint T-01…T-23.** A full audit produced 23
   tasks (P0 security → P2 tech debt), all now closed.

v3.1.0 (2026-10-27) added the Astro/Starlight landing + docs site, AGPL-3.0
licensing and brand logo. Post-3.1.0: i18n (en/de/fr) and a Settings
tenant-switch reload fix landed on `main`.

## 3. Hardening ledger (all closed)

| ID   | Sev | Area         | Outcome                                                               |
| ---- | --- | ------------ | --------------------------------------------------------------------- |
| T-01 | 🔴  | hooks        | Replaced `parseUnverifiedJWT` auth with `e.auth` + `$apis.require*`   |
| T-02 | 🔴  | rules        | Closed open sign-up; server-side tenant isolation in collection rules |
| T-03 | 🔴  | hooks        | Removed `source:"oidc"` membership escalation bypass                  |
| T-04 | 🔴  | setup        | Bootstrap locked behind `STJORNA_SETUP_TOKEN`; wizard idempotent      |
| T-05 | 🔴  | api keys     | Short-lived token exchange, no plaintext password, working revoke     |
| T-06 | 🔴  | helm         | `helm upgrade` no longer deletes namespace/PVC; PB_SECRET kept        |
| T-07 | 🟠  | secrets      | Secrets stripped from backups; bad PB_SECRET hard-fails               |
| T-08 | 🟠  | media        | `protected` files; auth JWT no longer leaked in URLs                  |
| T-09 | 🟠  | tests        | Real-migration backend tests run in CI                                |
| T-10 | 🟠  | auth         | Disabled superusers fully blocked; tokens revoked on disable          |
| T-11 | 🟠  | backup       | Tenant export/import with media + relations, transactional            |
| T-12 | 🟠  | nginx        | Body limit, SSE buffering off, security/cache headers                 |
| T-13 | 🟡  | oidc         | Sync only mutates `source:"oidc"` rows; sync-mode migration           |
| T-14 | 🟡  | auth         | MFA enabled on setup; admin banner when SMTP missing                  |
| T-15 | 🟡  | frontend     | Pagination/sort, `custom_fields`, auth-store, filter injection        |
| T-16 | 🟡  | hooks        | Modules replace string-built handlers; helm hook copy removed         |
| T-17 | 🟡  | frontend     | ESLint, lazy routes, runtime `/config.js`, component split (partial)  |
| T-18 | 🟡  | image        | Multi-arch, checksum, EOL base, entrypoint args                       |
| T-19 | 🟡  | helm         | securityContext, NetworkPolicy, config checksums                      |
| T-20 | 🟡  | CI           | SHA-pinned actions, per-job permissions, release gating               |
| T-21 | 🟡  | api docs     | OpenAPI spec generated from live collections + `lib/routes.js`        |
| T-22 | 🔵  | schema       | `1780001000_schema_cleanup.js`                                        |
| T-23 | 🔵  | scripts/docs | Deleted dangerous `fix-pocketbase.ts`; v0.22 docs removed             |

## 4. Guardrails — do NOT reintroduce these

These were hard-won in v3. Treat them as invariants.

- **Never use `$security.parseUnverifiedJWT` for any auth decision.** It only
  decodes; it does not verify. Verified identity is `e.auth` /
  `e.hasSuperuserAuth()`; protect routes with `$apis.requireAuth()` /
  `$apis.requireSuperuserAuth()`.
- **Never build hooks as `new Function("e", BODY)` strings.** Put logic in
  `pb_hooks/lib/*.js` (no `.pb.js` suffix) and `require` it _inside_ handlers.
  `*.pb.js` files stay thin.
- **Hooks are baked into the image only.** There is no helm ConfigMap mount and
  no second copy to keep in sync. If you add a hook file, it ships via the image.
- **No plaintext secrets in records.** `instance_settings` secret fields and
  `api_keys.service_user_password` were removed; secrets live in PB settings or
  are derived. Never write a secret into a collection field again.
- **Tenant isolation is enforced server-side**, not just as a UI filter. Rules
  use the `@collection.user_tenants` join; keep `user_tenants.source` as enum
  (`oidc`/`manual`), and never trust a client-supplied `source` value.
- **PB_SECRET must be exactly 32 ASCII chars and the container hard-fails
  otherwise.** Docs use `openssl rand -hex 16` (not `-hex 32`).
- **Schema/rule changes go in a NEW migration** with a timestamp later than
  `1780001000`. Never edit old migrations (they must stay idempotent).
- **Every security fix ships a negative test** (attacker is denied), not just a
  positive one. Write rules tests as a _tenant user_, never as superuser.
- **Every custom route is registered in `pb_hooks/lib/routes.js`**, which feeds
  `/api/openapi.json`; `pocketbase/tests/openapi.test.ts` fails if a documented
  path 404s or a documented field doesn't exist.
- **Auth tokens must never appear in URLs/DOM.** Use `pb.files.getToken()` for
  media; file access is `protected`.

## 5. Sources of truth (read before assuming)

- **Task ledger + open follow-ups:** `.opencode/improvements.md` (the T-01…T-23
  acceptance criteria and the T-\*.x follow-up table).
- **Other skills:** `stjorna-architecture`, `stjorna-frontend`,
  `stjorna-e2e-testing`, `pocketbase-jsvm-hooks`.
- **Schema:** `pocketbase/pb_migrations/*.js` in timestamp order.
- **Route contracts:** each `pb_hooks/*.pb.js` header comment.

## 6. Quick commands

```bash
cd frontend && npx tsc --noEmit -p .   # typecheck
cd frontend && npm run lint            # eslint
cd frontend && npx vitest run          # unit tests
cd frontend && npm run test:e2e        # Playwright (builds + runs)
cd pocketbase && npm run check:hooks   # node --check on all hook files
make lint-helm / make test-helm        # helm lint / kind e2e
```

`frontend/public/version.json` is a build artifact — `git checkout --` it
before committing.

## 7. Still-open follow-ups (pointers, not this file's job to detail)

The `.opencode/improvements.md` follow-up table lists remaining gaps, roughly:
secrets still re-written by `Setup.tsx`/`OidcSettings.tsx` (T-07.1), compose
`changeme` default (T-04.1), superuser-secret drift (T-06.1), demo localStorage
key (T-05.1), setup-redirect e2e skipped (T-04.2), auth-JWT e2e assertion
(T-08.1), S3 backup round-trip untested (T-11.1), in-memory ZIP build (T-11.2),
PB trusted-proxy config (T-12.1/T-19.1), frontend truncation/N+1/typegen
(T-15.1/T-15.2/T-17.1), CSP cross-origin PB (T-17.2), plus assorted CI/schema/
docs cleanup. Read the table before picking up any "small" follow-up — many are
🟠 and gate a real deployment.
