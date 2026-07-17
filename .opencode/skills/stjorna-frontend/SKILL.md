---
name: stjorna-frontend
description: STJÓRNA SolidJS frontend implementation status and quick reference. Use when working on the SolidJS frontend, multi-tenant UI, role-based access, or implementing new features. Provides a status snapshot of the rewrite (mostly complete) and points to detailed skills and the implementation plan.
---

## STJÓRNA Frontend Status (July 2026)

The SolidJS frontend rewrite is **largely complete and working**. The PocketBase v0.22.7 backend with custom JS hooks is also in place. The most recent work added the OpenAPI spec endpoint and Swagger UI.

### Stack (actual)
- **Frontend:** SolidJS + TypeScript + TailwindCSS, built with Vite
- **Backend:** PocketBase v0.22.7 with `pb_hooks/*.pb.js` JS hooks
- **Storage:** S3-compatible (Scaleway/AWS/MinIO)
- **Tests:** Playwright E2E + Vitest unit

### Implementation Plan
A detailed implementation plan with phase status and next steps is stored at:
**`.opencode/plans/stjorna-frontend-plan.md`**

### Available Pages
Login, Setup (4-step wizard), Dashboard, Media (List/Edit), Categories (List/Edit), Products (List/Edit with media picker), Settings, InstanceSettings (PB admin S3 config), UserManagement, TenantList, TenantSettings (PB admin), ApiDocs (Swagger UI)

### Available Skills
- **`stjorna-architecture`** — full architecture, schema, role model, S3, OpenAPI, Helm
- **`stjorna-e2e-testing`** — Playwright E2E test patterns, schema, debugging
- **`pocketbase-jsvm-hooks`** — PocketBase v0.22.7 JS hook gotchas (loader/executor VM split, response writing, file patterns)

### Key Gotchas (load relevant skills for details)
- **PB JS hook loader vs executor VM**: top-level `let`/`var`/`globalThis.X` are NOT visible in handler scope. Use `new Function("c", "...literal code...")` to inline values. See `pocketbase-jsvm-hooks` skill.
- **Vite proxy**: must use `/api/` (with trailing slash), not `/api` — otherwise `/api-docs` route gets hijacked
- **PB v0.22.7 has no `c.send()`**: use `c.string(200, preSerializedJson)` + manual Content-Type
- **`c.response().write()` does NOT write**: returns 200 + empty body
- **PB hook files must end in `.pb.js`**: `stjorna.js` is currently NOT loaded
- **HooksWatch only re-loads CHANGED existing files**: new files need container restart
- **`podman cp` files owned by uid 100999**: `rm` then `cat >` as host user

### Next Steps (priorities)
1. Fix `stjorna.js` → `stjorna.pb.js` (rename + rewrite to v0.22.7 API; implement media file cleanup)
2. Run full E2E suite to verify everything works
3. Add Vitest unit tests for `pocketbase/test/`
4. Extract reusable Table/Form UI components
5. Add i18n (German/English)
6. Migrate to PocketBase v0.23+ (optional, for env-var S3 + `c.send()`)
