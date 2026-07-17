# STJÓRNA Frontend Implementation Plan

> **Status (2026-07-15):** Phases 1–10 are largely **COMPLETE** and working. The SolidJS + PocketBase rewrite is functional and tested. This document is now primarily a reference for what was built + the next steps for further work.

## Overview

Frontend for STJÓRNA — a multi-tenant product/media management application.
Built with SolidJS, TailwindCSS, @solidjs/router, @tanstack/solid-query, and PocketBase SDK.

## Tech Stack (actual)

- **Framework:** SolidJS + TypeScript
- **Styling:** TailwindCSS
- **Routing:** @solidjs/router
- **Server state:** Direct `pb.collection()` calls + manual invalidation
- **Backend:** PocketBase v0.22.7
- **Build:** Vite (dev :3000, preview :4173)
- **Tests:** Playwright E2E + Vitest unit

## Role Model (implemented)

| Role | Description |
|------|-------------|
| `viewer` | Read-only access within their tenant |
| `editor` | Full CRUD on content (products, categories, media) within their tenant |
| `admin` | Tenant admin — manages users within their tenant + full content access |
| `pb_admin` | PocketBase admin — system-wide admin, manages tenants + all users across tenants |

A user belongs to one or more tenants via a `user_tenants` junction table. Each assignment has its own role (a user can be editor in Tenant A and viewer in Tenant B).

## Data Model (implemented, v2)

### Collections

| Collection | Key fields | Notes |
|------------|------------|-------|
| `users` | standard PB auth + `last_tenant` | last selected tenant |
| `roles` | `name`, `description` | viewer/editor/admin lookup |
| `tenants` | `name`, `slug`, `description`, `users` (relation multi) | |
| `user_tenants` | `user`, `tenant`, `role` (relation) | junction |
| `categories` | `name`, `slug`, `description`, `tenant` | |
| `products` | `name`, `slug`, `description`, `price`, `sku`, `tenant`, `category`, `media` (relation multi max 99) | |
| `media` | `name`, `original_name`, `file`, `mime_type`, `size`, `s3_url`, `thumbnail_url`, `tenant` | file collection |
| `instance_settings` | `s3_bucket`, `s3_region`, `s3_endpoint`, `s3_access_key` | singleton, PB admin only |

### API Rules (implemented)

All tenant-scoped collections (`categories`, `products`, `media`):
- `listRule` / `viewRule` / `createRule` / `updateRule` / `deleteRule`:
  `'@request.auth.id != "" || @request.auth.admin = true'`

`users`: listRule same, viewRule `'@request.auth.id = id || @request.auth.admin = true'`
`user_tenants`: listRule `'@request.auth.id != "" || @request.auth.admin = true'`
`instance_settings`: all rules `'@request.auth.admin = true'`

Frontend always sends `?filter=tenant = '{currentTenant}'` as primary filter; API rules are guardrails.

## Pages & Routes (implemented)

| Route | Component | Access | Status |
|-------|-----------|--------|--------|
| `/setup` | `Setup.tsx` | Public (only when no admin) | ✅ Done |
| `/login` | `Login.tsx` | Public | ✅ Done |
| `/` | `Dashboard.tsx` | Authenticated | ✅ Done |
| `/media` | `MediaList.tsx` | Authenticated | ✅ Done |
| `/media/new` | `MediaEdit.tsx` | Editor+ | ✅ Done |
| `/media/:id` | `MediaEdit.tsx` | Editor+ | ✅ Done |
| `/categories` | `CategoryList.tsx` | Authenticated | ✅ Done |
| `/categories/new` | `CategoryEdit.tsx` | Editor+ | ✅ Done |
| `/categories/:id` | `CategoryEdit.tsx` | Editor+ | ✅ Done |
| `/products` | `ProductList.tsx` | Authenticated | ✅ Done |
| `/products/new` | `ProductEdit.tsx` | Editor+ | ✅ Done |
| `/products/:id` | `ProductEdit.tsx` | Editor+ | ✅ Done |
| `/settings` | `Settings.tsx` | Admin | ✅ Done |
| `/settings/instance` | `InstanceSettings.tsx` | PB admin | ✅ Done |
| `/users` | `UserManagement.tsx` | Admin / PB admin | ✅ Done |
| `/tenants` | `TenantList.tsx` | PB admin | ✅ Done |
| `/tenants/:id` | `TenantSettings.tsx` | PB admin | ✅ Done |
| `/api-docs` | `ApiDocs.tsx` | Editor+ | ✅ Done |

## Phase Status

### Phase 1 — Scaffolding ✅ DONE
- SolidJS + TS + Tailwind + @solidjs/router + pocketbase SDK installed
- Vite config with `/api/` proxy to PB :8090

### Phase 2 — Project Structure ✅ DONE
- All folders created: components/{layout,ui}, pages, services, stores, types, utils

### Phase 3 — Auth Store ✅ DONE
- `frontend/src/stores/auth.ts` with `user`, `tenants`, `currentTenant`, `role`, `isPBAdmin`
- `loadTenants()` with role/tenant expand + fallback direct fetch
- `isEditorOrAbove()` and other role helpers (with PB admin override)

### Phase 4 — Setup Page (4 Steps) ✅ DONE
- 4-step wizard: Connect → Initialize → Tenant → Link Admin
- S3 storage configuration step (extra): bucket, region, access key, secret
- `saveS3Settings()` PATCHes PB settings via `pb.settings.update({ s3: {...} })`
- `isS3Valid()` requires endpoint (auto-filled with `https://s3.${region}.amazonaws.com`)
- `categorizedS3Error()` for user-friendly S3 error messages
- Setup complete → redirect to `/login`

### Phase 5 — Login Page ✅ DONE
- Unified login with "Admin Login" / "User Login" mode toggle
- PB URL stored in `localStorage` as `stjorna_pb_url`
- On success: fetch user_tenants expand → set store → redirect to `/`
- Show error for failed login
- Link to `/setup` if no admin exists

### Phase 6 — Dashboard ✅ DONE
- Stats cards: counts for products/categories/media
- Recent activity: last 10 items created/updated (deduped, sorted by `at` desc)
- Action column (created/updated badges)
- Quick links: Add media, Add product

### Phase 7 — Reusable Table Component ⚠️ PARTIAL
- Tables are written inline per-page, no shared component yet
- Each page has its own table styling
- **TODO:** extract into `components/ui/Table.tsx`

### Phase 8 — Media Management ✅ DONE
- `MediaList.tsx`: table with thumbnails (`?thumb=100x100`), paginated, delete with confirmation
- `MediaEdit.tsx`: file upload + blob URL preview + `setCanonicalUrls()` PATCHes `s3_url` and `thumbnail_url` after upload; backfill on load for old records
- `original_name` field is readOnly with note "(set on upload, not editable)"

### Phase 9 — Settings & User Management ✅ DONE
- `Settings.tsx`: tenant name, slug, description (admin only)
- `InstanceSettings.tsx`: S3 config (PB admin only)
- `UserManagement.tsx`: list users, change role, remove from tenant
- `TenantList.tsx` / `TenantSettings.tsx`: PB admin manages all tenants

### Phase 10 — Tenant Switcher ✅ DONE
- `frontend/src/stores/auth.ts` tracks `currentTenant`
- Sidebar shows current tenant; users with multiple tenants can switch
- `last_tenant` field on users remembers preference

### Phase 11 — OpenAPI / Swagger UI ✅ DONE
- `pocketbase/pb_hooks/openapi.pb.js` serves 3-tier OpenAPI 3.0.3 spec at `/api/openapi.json`
- `frontend/src/pages/ApiDocs.tsx` renders Swagger UI with PB token via `requestInterceptor`
- Sidebar link `/api-docs` for editor+
- E2E test `tests/e2e/api-docs.spec.ts` (3 tests)

### Phase 12 — Docker ✅ DONE
- `docker-compose.yml` with PB + frontend services
- `frontend/Dockerfile` (multi-stage: builder + nginx)
- Helm chart at `helm/stjorna/`

## Helper Utilities (implemented)

- `frontend/src/utils/mediaUrl.ts`: `getMediaFileUrl(id, file, { thumb? })` adds PB token for private files
- `frontend/src/utils/slug.ts`: `slugify()` for category/product slug auto-generation
- `frontend/src/stores/sidebar.ts`: `bump()` signal for sidebar count refresh after CRUD

## Next Steps (Prioritized)

### High Priority

1. **Fix `stjorna.js` PB hook** — currently NOT loaded by PB v0.22.7 (uses outdated `pb.hook`/`pocketbase.router` API; lacks `.pb.js` extension)
   - Rename `pocketbase/pb_hooks/stjorna.js` → `stjorna.pb.js`
   - Rewrite to use v0.22.7+ API: `onRecordAfterDeleteRequest(collection, handler)`, `routerAdd(method, path, handler)`
   - Implement media file cleanup: `pb.dao.NewFilesystem().Delete(originalName, recordId)` in `onRecordAfterDeleteRequest` for `media` collection
   - This fixes orphan files in PB storage when media records are deleted

2. **Run full E2E suite** to verify all features work end-to-end:
   ```bash
   npm run test:e2e
   ```
   Currently individual test files pass; need to confirm full suite runs without state leaks.

3. **Add Vitest unit tests for pocketbase/test** — `pocketbase/test/setup.ts` and `pocketbase/test/vitest.config.ts` exist but no test files yet. Add unit tests for the schema, role assignment logic, etc.

4. **Migrate to PocketBase v0.23+** (optional) — gain env-var S3 config, `c.send()` method, better JSDoc types. Requires PB upgrade and re-testing all hooks.

### Medium Priority

5. **Extract reusable Table component** — `components/ui/Table.tsx` with sort/filter/pagination props; refactor CategoryList, ProductList, MediaList to use it

6. **Extract reusable Form components** — `components/ui/Input.tsx`, `Select.tsx`, `Modal.tsx`, `Button.tsx`; refactor edit pages to use them

7. **Add webhook dispatch** for product/category create/update events (placeholder exists in `stjorna.js`)

8. **Implement file upload progress** — currently the upload is blocking with no progress indicator

9. **Add bulk operations** to MediaList and ProductList (multi-select with delete)

10. **Improve mobile/tablet layouts** — sidebar collapses to drawer on small screens, tables become cards

### Low Priority

11. **i18n (German/English)** — currently English-only; need to add `i18next` or similar

12. **Matomo tracking integration** — currently disabled

13. **Public storefront view** — the API is documented as `Public` tier but no actual storefront UI exists yet. Could add a `/store/:tenantSlug` route.

14. **Multi-image drag-reorder keyboard accessibility** — drag-and-drop is mouse-only; add keyboard shortcuts

15. **Add Storybook** for component development and visual testing

16. **Add E2E tests for the missing areas**: TenantSettings, UserManagement edit flows, error states

## File Count (actual)

| Category | Files |
|----------|-------|
| Pages | 16 (Login, Setup, Dashboard, MediaList/Edit, CategoryList/Edit, ProductList/Edit, Settings, InstanceSettings, UserManagement, TenantList, TenantSettings, ApiDocs) |
| Components (layout) | 3 (Layout, Sidebar, Header) |
| Stores | 2 (auth, sidebar) |
| Services | 1 (pocketbase) |
| Utils | 2 (mediaUrl, slug) |
| Types | 1 (index) |
| PB Hooks | 1 (openapi.pb.js) + 1 (stjorna.js — needs rewrite) |
| E2E Tests | 8 files |
| **Total** | ~35 source files |

## Key Architectural Decisions (for future maintainers)

1. **No `react-query` / `solid-query` in practice** — direct `pb.collection()` calls with manual invalidation are simpler for STJÓRNA's CRUD pattern
2. **PB URL in localStorage, not env var** — allows same build to point to any PB instance (dev/staging/prod)
3. **Three API tiers, not two** — Public/Private/Admin instead of just Public/Private makes the API more granular for storefront/admin separation
4. **API rules as guardrails, frontend filters as primary** — even if frontend forgets a filter, backend prevents cross-tenant data leaks
5. **OpenAPI spec hardcoded in `openapi.pb.js`** — could be generated from PB schema, but hardcoding gives full control over descriptions, tags, and tier classification
6. **`@request.auth.id != "" || @request.auth.admin = true` for tenant-scoped rules** — allows PB admin to access all tenants for management; the public tier uses a separate `Public` tag in OpenAPI but actually requires user auth in current rules (TODO: consider making public reads truly unauthenticated)

## Related Plans / Skills

- `stjorna-architecture` skill — full architecture, schema, role model
- `stjorna-e2e-testing` skill — E2E test patterns, schema, debugging
- `pocketbase-jsvm-hooks` skill — PB v0.22.7 JS hook gotchas
