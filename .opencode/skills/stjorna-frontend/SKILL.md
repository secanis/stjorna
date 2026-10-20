---
name: stjorna-frontend
description: STJÓRNA SolidJS frontend implementation status and quick reference. Use when working on the SolidJS frontend, multi-tenant UI, role-based access, or implementing new features. Provides a status snapshot of the rewrite (mostly complete) and points to detailed skills and the implementation plan.
---

## STJÓRNA Frontend

The previous status snapshot described a PocketBase v0.22.7 backend and is
obsolete; STJÓRNA runs on **PocketBase v0.40**. Sources of truth:

- `README.md` — setup, storage, auth model (superusers, `user_tenants`
  roles viewer/editor/admin, OIDC), API keys, development commands
- `frontend/src/` — pages, stores (`stores/auth.ts` for the session and
  role model), services, `types/index.ts` for the record shapes
- `pocketbase/pb_migrations/` — collection schema and access rules
- `pocketbase/pb_hooks/*.pb.js` — custom routes; each file's header
  comment documents its contract

### Stack
- **Frontend:** SolidJS + TypeScript + TailwindCSS, built with Vite
- **Backend:** PocketBase v0.40 with `pb_hooks/*.pb.js` JSVM hooks
- **Tests:** Playwright E2E (`frontend/tests/e2e/`) + Vitest unit/integration

### Related Skills
- **`stjorna-e2e-testing`** — Playwright E2E test patterns
- **`pocketbase-jsvm-hooks`** — PocketBase v0.40 JSVM hook gotchas

### Frontend gotchas
- **Vite proxy**: must use `/api/` (with trailing slash), not `/api` —
  otherwise the `/api-docs` route gets hijacked.
- Slugs must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (enforced by the schema);
  generate them with `utils/slug.ts`.
