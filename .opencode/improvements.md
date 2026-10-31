# STJÓRNA — Improvement Tasks for AI Agents

Written 2026-09-22 against commit `869739b` (PocketBase **v0.40.4**, JS SDK `^0.28.1`,
SolidJS frontend). Background, data model and PB v0.40 idioms: see **`ai-pedia.md`**.
Every task below was verified by reading code; line numbers may drift, so re-check them.

## How to hand these out

Each task is **self-contained**: paste the task section plus these standing rules to an agent.

> **Standing rules for every agent**
> - Work on a feature branch (never commit to `main`/`master`), one task per branch/PR.
> - Never run migrations or DB writes against a real/shared/production instance. Use only
>   the local test container (`pocketbase/setup.ts` / `docker compose` with a throw-away `pb_data`).
> - Don't read or print secrets, `.env` files or tokens.
> - Any change in `pocketbase/pb_hooks/` must be mirrored in `helm/stjorna/files/hooks/` (until task T-16 removes the copy).
> - Schema/rule changes go in a **new** migration file in `pocketbase/pb_migrations/` (timestamp later than `1770000000`). Never edit old migrations.
> - Every security fix ships with a **negative** test (attacker is denied), not just a positive one.
> - Target PocketBase v0.40 APIs: `e.auth`, `e.hasSuperuserAuth()`, `$apis.requireAuth()`,
>   `$apis.requireSuperuserAuth()`, `e.json()`, `require(\`${__hooks}/lib/x.js\`)`. `$security.parseUnverifiedJWT` must not be used for any auth decision.

Suggested order: **T-01 → T-02 → T-03 → T-04 → T-05** first (they are critical and exploitable
without credentials or with a self-registered account). **T-09 (test harness)** can run in parallel,
and T-01 to T-05 get much easier to verify once it lands.

Severity: 🔴 critical · 🟠 high · 🟡 medium · 🔵 low / tech debt

---

## P0 — Security (fix before any real deployment)

### T-01 🔴 Replace unverified-JWT auth in all custom routes
**Problem.** `$security.parseUnverifiedJWT` only decodes a token; it does not check the signature. PB ignores an
invalid `Authorization` header and just leaves `e.auth = null`, so the route still runs. A hand-made token such as
`x.<base64 {"type":"auth","collectionId":"pbc_3142635823","id":"x"}>.x` passes the "superuser" checks:
- `pocketbase/pb_hooks/api_keys.pb.js` `ADMIN_AUTH_FN` (issue/list/revoke). Issue a key for any tenant, then `/exchange` returns working credentials.
- `pocketbase/pb_hooks/backup.pb.js` `authCheckSnippet` + import auth (`{"type":"admin"}`) gives a full data export (including S3/OIDC secrets) and import into any tenant.
- `pocketbase/pb_hooks/users_search.pb.js` enumerates all user emails.
- `pocketbase/pb_hooks/stats.pb.js` returns any tenant's stats, and a forged user token can impersonate any user id.
- `pocketbase/pb_hooks/openapi.pb.js` (low: only chooses which spec to show).
- `superusers.pb.js` refresh guard (low).

Side bug: backup checks the v0.22 token types `admin`/`authRecord`, so **real v0.40 superusers get 401**, and
the tenant-admin import branch reads the non-existent `users.tenant`/`users.role`.

**Do.**
1. Admin routes: `routerAdd(method, path, handler, $apis.requireSuperuserAuth())` and inside also `if (!e.hasSuperuserAuth()) throw new ForbiddenError()`.
2. User routes (stats, users/search): `$apis.requireAuth("users", "_superusers")` and take the identity from `e.auth.id` / `e.auth.collection().name`.
3. Tenant-admin checks (backup import, users/search): look up `user_tenants` (user = `e.auth.id`, tenant = target, `role.name = "admin"`). For users/search, only return users relevant to the admin's tenant or require an exact-email match.
4. Remove the hard-coded `'pbc_3142635823'` / `'_pb_users_auth_'` comparisons.
5. Grep to confirm there are zero `parseUnverifiedJWT` uses in auth decisions.

**Acceptance.** New `pocketbase/tests/forged-jwt.test.ts`: unsigned/forged tokens (superuser collectionId, `type:admin`, user id of a victim) get 401/403 on every route above. A real superuser token gets 200 on `/api/backup/json` and `/zip`.

### T-02 🔴 Close open sign-up and enforce tenant isolation in collection rules
**Problem.** `media`, `categories`, `products` and `user_tenants` use `@request.auth.id != ""` for all five rules
(`pb_migrations/1740000000_create_core_collections.js`, `1758000000_…`). The `users` collection keeps PB's
default `createRule = ""` (public sign-up). So anyone can register and then read, write, delete or re-home
**every tenant's** data. Tenant scoping exists only as a UI filter (`frontend/src/pages/ProductList.tsx` etc.).
API-key service users (T-05) have the same access. `tenants.listRule = ""` also exposes all tenants publicly
(name, slug, custom_domain, theme_config, `users` id list).

**Do (new migration).**
- `users`: `createRule = null` (invites/admin-created only). Review list/view/update rules (self only).
- Read rules for tenant collections (`X` = products/categories/media):
  `@request.auth.id != "" && @collection.user_tenants.user ?= @request.auth.id && @collection.user_tenants.tenant ?= tenant`
  (verify that the same unaliased join applies both conditions to the same row; otherwise use an aliased `@collection.user_tenants:m`).
- Write rules additionally require role `editor|admin`. Create must validate `@request.body.tenant` membership, and update must forbid changing `tenant` (`@request.body.tenant:isset = false` or equality).
- `user_tenants`: list/view only own rows or rows of tenants where the caller is admin. Create/update/delete only for tenant admins (the hook stays as defense-in-depth).
- `tenants`: list/view only for members. Decide what (if anything) must be public for the storefront/demo and expose it through a dedicated read-only route or view collection.
- Add indexes: `CREATE INDEX` on `tenant` for each tenant collection, `UNIQUE(tenant, slug)` for products/categories, `UNIQUE(user, tenant)` for user_tenants.
- Decide the **public storefront** story. The OpenAPI spec and site claim unauthenticated GET on products/categories/media, which isn't true today. Either make `active = true` rows public per tenant, or keep them private and document API keys (T-05).

**Acceptance.** `pocketbase/tests/tenant-isolation.test.ts`, run as **tenant users** (not superuser): user A cannot list/view/update/delete/re-home tenant B records and cannot create with `tenant: B`, while a viewer cannot write. `signup-disabled.test.ts`: anonymous user create gets 400/403. Frontend e2e still passes.

### T-03 🔴 Remove the `source = "oidc"` bypass in the membership guard
**Problem.** `pocketbase/pb_hooks/user_tenants.pb.js` calls `e.next()` without checks when the client sends
`source: "oidc"` (create **and** update). With the auth-only rules, any user can POST
`{user: self, tenant: X, role: <admin role id>, source: "oidc"}` and become **admin of any tenant**.
The bypass is unnecessary: `oidc_groups.pb.js` writes through `$app.save`, which does not fire `*Request` hooks.

**Do.** Delete both bypass lines. Reject any API request that sets `source = "oidc"` unless `e.hasSuperuserAuth()`.
Also stop non-admins from changing `user`/`role` on update.

**Acceptance.** `user-tenants-escalation.test.ts`: non-admin create/update with `source:"oidc"` or an admin role gets 403. OIDC login sync still creates rows (`oidc_groups` flow).

### T-04 🔴 Secure first-run bootstrap and lock the setup wizard afterwards
**Problem.**
- `POST /api/stjorna/setup-bootstrap-superuser` (`pb_hooks/setup.pb.js`) is unauthenticated; its only gate is
  "no superuser exists yet". On **Helm**, no `PB_SUPERUSER_*` reaches the pod (`helm/stjorna/templates/pocketbase-deployment.yaml`),
  and `superuser-secret.yaml` is created but never mounted. So whoever reaches the ingress first owns the instance. The check-then-save is also racy.
- Frontend `Setup.tsx` checks "already set up" through `instance_settings.getList` (superuser-only, so it always gets 403 and the check never fires).
  It ignores `setupDone` from `/api/stjorna/setup-status`, can be re-run to overwrite S3/app settings and create duplicate tenants,
  keeps state in `window.__setupTenantId`, uses the default LocalAuthStore (the superuser JWT persists in localStorage),
  and creates a `users` account that reuses the superuser password.

**Do.**
1. Require a setup token: `STJORNA_SETUP_TOKEN` env (from the helm `superuser-secret` or a new secret, printed in `NOTES.txt` with a `kubectl get secret` command). Compare it in constant time against a header. Alternatively, mount `PB_SUPERUSER_*` into the pod so `entrypoint.sh` upserts the superuser.
2. Wrap the existence check and the save in `$app.runInTransaction`.
3. Server-side: add a hook that refuses the setup mutations once `instance_settings.setup_done = true` (except for superusers editing settings normally).
4. Frontend: redirect when `setup-status.setupDone`. Use one `new PocketBase(url, new BaseAuthStore())` held in component state and clear it on finish. Make each step idempotent (upsert tenant by slug). Ask for a separate user password or send an invite.

**Acceptance.** Tests: bootstrap without a token gets 403; with a token it gets 200 once; two concurrent requests create exactly one superuser; a wizard reload after completion redirects to `/login`.

### T-05 🔴 Redesign API keys (no plaintext passwords, real scoping, working revoke)
**Problem** (`pb_hooks/api_keys.pb.js`, migrations `1737100000`/`1737200000`):
- `service_user_password` is stored in plaintext and returned by `/exchange`. Revoking only sets `revoked=true`, so the service user and any JWT obtained earlier **keep working forever**.
- The service user gets no `user_tenants` row (the `tenant` field it sets doesn't exist on `users`). Because of T-02 it can still access every tenant, and because of T-03 it can make itself admin.
- `permissions` is stored but never enforced.
- Lookup scans the whole table (`findRecordsByFilter('api_keys','','',0,0)`) on every request. There is no unique index on `prefix` and no rate limiting.
- The demo (`demo/src/lib/pb.ts`) keeps the key and JWT in localStorage and uses SDK `^0.21`.

**Do.**
- `/exchange` returns a **short-lived auth token** minted server-side (`e.auth`-less route → `$tokens.recordAuthToken(...)` / `record.newAuthToken()`, check the exact v0.40 API) for a service user that has a scoped `user_tenants` row (role `viewer` or from `permissions`). Never return or store a password: give service users a random password that nobody knows, or use a dedicated auth collection `api_clients`.
- Revoke deletes or disables the service user and calls `refreshTokenKey()` so its tokens are invalidated.
- Add `UNIQUE INDEX` on `api_keys.prefix` and look up with `findFirstRecordByFilter('api_keys','prefix={:p} && revoked=false',{p})`.
- Enforce `permissions` (e.g. read-only means the service user gets the viewer role).
- Migration: clear `service_user_password` for existing rows and rotate existing service users.
- Update `demo/` to SDK `^0.28` and to the new flow.

**Acceptance.** Tests: exchange never returns a password; a service-user JWT cannot read another tenant; after revoke, both exchange and the old JWT fail; a read-only key cannot write.

### T-06 🔴 Helm: `helm upgrade` can delete the namespace (and the data)
**Problem.** `helm/stjorna/templates/namespace.yaml` renders the Namespace only when a `lookup` doesn't find it.
On install it becomes a release resource; on upgrade it isn't rendered, so **Helm deletes the Namespace and all it contains**,
PVC included. Also:
- The PVC has no `helm.sh/resource-policy: keep`, so `helm uninstall` deletes it. `NOTES.txt` wrongly claims the data survives.
- The `pre-install` hook Secret for `PB_SECRET` (`secret.yaml`) is not part of the release. Reinstalling fails, and deleting/recreating it rotates `PB_SECRET`, after which the encrypted settings in the retained `data.db` can no longer be read. Argo CD PreSync would rotate it on every sync.

**Do.** Remove `namespace.yaml` (document `--create-namespace`), or annotate it `helm.sh/resource-policy: keep` and drop the lookup. Add `resource-policy: keep` to the PVC. Generate PB_SECRET as a normal resource that reuses the existing value via `lookup`, plus `resource-policy: keep`, or require `existingSecret`. Fix `NOTES.txt`. Extend `scripts/test-helm.sh` with an **install → upgrade → verify data still present** step, run with the default values (namespace.create/hooks ConfigMap enabled). Add `--kube-context` handling so it can never target the current (possibly prod) context by accident.

**Acceptance.** kind test: after `helm upgrade` the namespace, PVC and a test record still exist, and PB_SECRET is unchanged.

### T-07 🟠 Secrets at rest and in backups
**Problem.**
- `instance_settings.s3_secret_key`, `s3_access_key` and `oidc_client_secret` are plaintext duplicates of values already held in PB's own (encrypted-when-`PB_SECRET`) settings.
- `/api/backup/json|zip` exports them through `publicExport()`.
- `OidcSettings.tsx` always sends `oidc_client_secret`, so an empty "keep existing" field wipes it.
- `.env.example`/README say `openssl rand -hex 32` (64 chars), which `entrypoint.sh` rejects with only a warning, so **encryption is silently off**.

**Do.** Migration: drop the secret fields from `instance_settings` (PB settings are the single source of truth) or mark them `hidden: true` and exclude them from export. Frontend: only send changed secret fields. `entrypoint.sh`: **fail** on an invalid-length `PB_SECRET` (or derive 32 bytes via sha256 and document it). Change the docs to `openssl rand -hex 16` (32 chars) or `head -c 24 /dev/urandom | base64`.

**Acceptance.** A backup export contains no secret values (test). Container start with a 64-char PB_SECRET either fails loudly or encrypts.

### T-08 🟠 Protect media files and stop leaking the auth token in URLs
**Problem.** `media.file` is not `protected`, so files are world-readable across tenants. `frontend/src/utils/mediaUrl.ts` appends the full
auth JWT (a superuser JWT for admins) as `?token=` to every `<img>/<video>` URL. That is the wrong token type (PB expects a file token), and it ends up
in nginx logs, browser history, referers and copied links.

**Do.** Decide per product: storefront images public (keep unprotected, but then media metadata listing must still be tenant-scoped) **or** set `protected: true` and use `pb.files.getToken()` (short-lived file token), cached and refreshed. Never put the auth token in URLs. Add `Referrer-Policy` (T-12).

**Acceptance.** No URL in the DOM contains the auth JWT (e2e check). With protected files, an unauthenticated fetch gets 403/404.

---

## P1 — Correctness & reliability

### T-09 🟠 Make backend tests real and run them in CI
**Problem.**
- `pocketbase/vitest.config.ts` only includes `*.unit.test.ts` when `CI` is set, so **no integration test runs in CI**.
- The harness `pocketbase/setup.ts` builds collections in the v0.22 format (`options`, text `tenant`, rules `@request.auth.tenant = tenant`), which differs from the production migrations. Several tests import a non-existent path, and tests and scripts use the removed SDK `pb.admins.*`.
- The frontend e2e `frontend/tests/e2e/helpers/global-setup.ts` uses `pocketbase admin create`, `/api/admins/auth-with-password` and v0.22 schemas, **overwrites rules**, uses fixed sleeps and `podman --network=host`.
- `multitenant.test.ts` "should not be able to update tenant B…" actually asserts that the cross-tenant update **succeeds** (as superuser).

**Do.** Start PB from the real image with an empty `pb_data` so the **real migrations** create the schema; delete `setupCollections`. Use `pb.collection('_superusers').authWithPassword`. Add tenant-user fixtures (user + `user_tenants` row). Fix or rename the misleading multitenant tests. Enable integration tests in CI (health-check wait, not sleep). Port the Playwright global setup the same way. Replace `waitForTimeout` with web-first assertions.

**Acceptance.** `ci.yml` runs the full backend suite and Playwright e2e against the built images. The tests from T-01 to T-05 are green.

### T-10 🟠 Disabled superusers must be fully blocked
**Problem.** `pb_hooks/superusers.pb.js` matches only exact paths `/api/collections/_superusers/auth-with-password|auth-refresh`. The guard can be bypassed:
- via the collection id (`/api/collections/pbc_3142635823/...`) or different casing,
- via `/auth-with-otp`,
- with an upper-case email (the filter is case-sensitive while PB's lookup is not).

Existing tokens stay valid after disabling.

**Do.** Replace the `routerUse` path matching with `onRecordAuthRequest((e) => { if (!e.record.getBool("active")) throw new ForbiddenError(); e.next() }, "_superusers")`, and verify that it fires for password, OTP and refresh. On update to `active=false`, call `record.refreshTokenKey()`. Add a `routerUse` that rejects requests whose `e.auth` is an inactive superuser.

**Acceptance.** `superuser-disabled.test.ts` covers name path, id path, upper-case email, OTP, refresh and pre-existing token.

### T-11 🟠 Rewrite backup/restore (or adopt PB native backups)
**Problem** (`pb_hooks/backup.pb.js`):
- ZIP export reads `pb_data/storage/media/<id>/…`, but PB stores files under the collection **id** (`pbc_…`) and may use S3, so **backups contain no media**.
- Everything is built in JS memory (base64 → JS number arrays, the whole ZIP as an array), against a 256 Mi pod limit.
- Import reads at most 64 MB, although the route declares a 500 MB limit.
- There is no transaction, so a crash leaves a partial import.
- Media re-import duplicates records, product/category media relations aren't remapped, and only STORE zips are read (deflated entries are silently dropped).
- A fallback writes untrusted bytes straight to storage when validation fails.
- The manifest lists collections that don't exist (`webhooks`, `embed_configs`, `product_media`, `settings`).

**Do.** Option A (recommended): use PB's built-in `/api/backups` (full-instance, S3-capable) for disaster recovery. Keep a **tenant export/import** limited to JSON data plus media fetched through `$app.newFilesystem()` (`record.baseFilesPath()`), streamed and chunked. Import through multipart upload (not base64 JSON), inside `$app.runInTransaction`, idempotent by slug and original media id, with relations remapped. Delete the raw-write fallback. Keep the v1 import path with tests.

**Acceptance.** Round-trip test on local and S3 (MinIO) storage: export tenant → import into a new tenant → same counts, relations and file bytes. A 200 MB import stays under the pod memory limit.

### T-12 🟠 nginx: body size, timeouts, SSE, security and cache headers
**Problem.** `frontend/nginx.conf` (and the helm frontend ConfigMap):
- No `client_max_body_size`, so the nginx default of 1 MB applies and **media uploads over 1 MB fail with 413**.
- No timeouts, buffering always on (breaks `/api/realtime` SSE, and long exports hit 504), `Connection "upgrade"` sent unconditionally.
- No CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` or HSTS.
- No cache policy for `/assets/*` vs `index.html`.
- `nginx-unprivileged:1.25` is EOL.
- PB does not trust the proxy's forwarded IP headers, so rate limits and `PB_SUPERUSER_IPS` see the nginx IP.

**Do.**
- `client_max_body_size 520m; proxy_request_buffering off;`.
- A `/api/realtime` location with `proxy_buffering off; proxy_read_timeout 1h;`.
- `map $http_upgrade $connection_upgrade`.
- Security headers, with a CSP that allows the PB origin and the swagger chunk.
- `Cache-Control: immutable` for `/assets/`, `no-cache` for `index.html`.
- Bump the image.
- Configure PB **trusted proxy** settings (Settings → trusted proxy headers `X-Forwarded-For`/`X-Real-IP`) through a migration or the setup step.

**Acceptance.** An e2e upload of a 20 MB video succeeds, realtime events arrive, and the headers are present (`curl -I`).

### T-13 🟡 OIDC sync safety
**Problem** (`pb_hooks/oidc_groups.pb.js`):
- An existing **manual** membership for a tenant that matches an IdP group gets its source changed to `oidc` and its role overwritten, and is later deleted by `replace-oidc` when the group disappears.
- `oidc_sync_mode` has no migration, so the mode is always `replace-oidc`.
- PB auto-links OAuth2 logins to an existing user with the same email, which is account takeover if the IdP doesn't verify emails.
- The hook logs raw group claims and user keys on every login.

**Do.** Only mutate rows with `source === "oidc"`, and leave manual rows untouched (or make the behaviour configurable). Add a migration for `oidc_sync_mode` (select: `replace-oidc`, `additive`). Reject when `!e.isNewRecord` and the IdP's `email_verified` is not true (configurable). Reduce the logs to debug level. Extend `oidc-groups.unit.test.ts` (extract the pure mapping logic into `pb_hooks/lib/oidc.js` so it's unit-testable; see T-15).

### T-14 🟡 Superuser MFA is never enabled on fresh installs
**Problem.** Migration `1770000000_enable_superuser_mfa.js` returns early when `setup_done` is false. A migration runs only once, so fresh installs never get MFA, and nothing else turns it on (only manual toggles in `SecuritySettings.tsx`/`Profile.tsx`).

**Do.** When setup finishes (server-side hook on `instance_settings.setup_done` false→true), enable OTP+MFA **if SMTP is configured**. Otherwise show a persistent admin banner "MFA disabled — configure SMTP". Document `STJORNA_LOG_OTP` as dev-only (it also silently **skips sending** OTP mails).

### T-15 🟡 Frontend correctness fixes (SolidJS)
Each item is small; one agent can take all of them.
- **Pagination/sort do nothing.** `ProductList.tsx`, `CategoryList.tsx` and `MediaList.tsx` fetchers ignore the resource source and always call `getList(1, 50)`. Use `(src) => getList(src.page, 50, { sort, filter })`.
- **`custom_fields` corruption.** It is a JSON field typed/edited as a string (`types/index.ts`, `ProductEdit.tsx`), so the textarea shows `[object Object]` and saving writes that string back. Stringify on load, parse and validate on save.
- **Expired sessions look logged in.** `stores/auth.ts` initialises `user` from `pb.authStore.model` without checking `isValid`, never calls `authRefresh()`, doesn't subscribe `pb.authStore.onChange`, and has no 401 handling. Fix: init once at app start, add a route guard component instead of `await authStore.init()` in 23 `onMount`s, and switch `authStore.model` to `.record`.
- **Filter injection.** 18 filter strings are built by interpolation (tenant id comes from localStorage). Use `pb.filter('tenant = {:t}', { t })`, and `?=` for multi-relations.
- **Duplicate fetches/races.** `onMount` plus an immediately-running `createEffect` in Sidebar, Dashboard, Stats and TenantStats. Use `createResource` with `on(() => tenantStore.version, …, { defer: true })` and ignore stale responses.
- **Truncation.** `getList(1, 500)` for tenants, 500/50 for user_tenants, `getFullList` of all users in `TenantSettings.tsx`. Paginate, or use `/api/stjorna/users/search`.
- **Module-scope reactivity.** `createMemo`/`onCleanup` outside a root (`auth.ts`, `theme.ts`). Remove `window.__authStore` in production builds.
- **Accessibility.** The tenant selector opens on hover only, and there are 21 native `confirm()`/`alert()` calls. Add a keyboard-accessible menu and a confirm dialog component.

**Acceptance.** Add `eslint-plugin-solid` (T-17) with zero errors. e2e covers page 2 of products and a `custom_fields` round-trip.

---

## P2 — Tech debt & hardening

### T-16 🟡 Refactor hooks from string-built handlers to modules
**Problem.** All handlers are JS **strings** concatenated with `new Function("e", BODY)` (a v0.22-era workaround documented in `.opencode/skills/pocketbase-jsvm-hooks`). They can't be linted, type-checked, unit-tested or reviewed properly, and helpers are copy-pasted (JSON reply, body read, date parsing, admin check, key-shape) across 6 files. `helm/stjorna/files/hooks/` is a manual byte copy of `pb_hooks/`, and the chart hooks can mismatch the image's migrations.

**Do.** Move shared code to `pb_hooks/lib/*.js` (no `.pb.js` suffix) and `require(\`${__hooks}/lib/…\`)` **inside** handlers (the v0.23+ documented pattern). Use `e.json()`, `e.requestInfo().body` and `$apis.*` middlewares. Add `/// <reference path="../pb_data/types.d.ts" />` typing and a `tsc --checkJs` or eslint step. Stop duplicating hooks in helm: either bake them into the image only (default `hooks.mountFromConfigMap: false`) or generate the ConfigMap at package time in CI with a diff check. Update `.opencode/skills/pocketbase-jsvm-hooks/SKILL.md` to v0.40.

### T-17 🟡 Frontend structure & tooling
- Add ESLint + `eslint-plugin-solid` + `@typescript-eslint`, run in CI. The root `.eslintrc.yml` doesn't cover the frontend setup properly; verify.
- Route-level `lazy()` (main bundle ~432 KB). Remove the unused `@tanstack/solid-query` or actually use it.
- Split big components (Setup 736, MediaEdit 672, UserManagement 600, TenantSettings 538, OidcSettings 526, ProductEdit 485 lines). Extract a tenant-scoped data service (`services/catalog.ts`) that owns filters.
- Generate types from the schema (e.g. `pocketbase-typegen` against the local test instance) instead of the hand-written `types/index.ts` (it lacks `InstanceSettings`/`ApiKey`, has wrong JSON field types and 50+ `any`).
- Remove dead code: `checkHasAdmins` (it also clears auth), `checkSetupDone`, `recreatePb`, `TenantSelector.handleChange`.
- Runtime config: `VITE_PB_URL` is baked in at build time. Serve `/config.js` generated from env in the nginx entrypoint so one image works everywhere.
- Add `frontend/.dockerignore` (currently `COPY . .` can overwrite `node_modules` with host binaries).

### T-18 🟡 PocketBase image & entrypoint
- `pocketbase/Dockerfile`: map `TARGETARCH` → `PB_ARCH` for multi-arch (arm64), verify the zip against PB's `checksums.txt`, bump `alpine:3.19` (EOL), drop `wget`/`unzip` in a multi-stage build.
- `entrypoint.sh`: honour `"$@"` or remove the dead `args:` from the helm Deployment (changing `service.port` currently breaks probes). Fail hard on a bad `PB_SECRET` (T-07).
- `docker-compose.yml`: **frontend port mapping is broken**: `'3000:80'`, but the nginx-unprivileged image listens on **8080**, so the README quick start (`http://localhost:3000`) can't reach the UI. Change it to `'3000:8080'` and add an e2e/compose smoke test. Also consider not publishing PB `8090` on the host by default (it exposes the `/_/` admin UI and bypasses nginx).
- `docker-compose.yml`: enable a named `pb_data` volume by default (data is currently lost on `down`), and don't ship `changeme` as the default password (require it via `.env`, or generate it).

### T-19 🟡 Helm hardening
- Container `securityContext`: `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`, `seccompProfile: RuntimeDefault`, `readOnlyRootFilesystem` (with an emptyDir for tmp). `automountServiceAccountToken: false`.
- `NetworkPolicy`: only the frontend (or the ingress controller) may reach PB:8090.
- `checksum/config` annotations so ConfigMap changes roll the pods. Add a `startupProbe`.
- Raise PB memory limits (or keep them low only after T-11). Expose `PB_SUPERUSER_IPS`.
- Remove the misleading `reclaimPolicy` value and the unused `superuser-secret.yaml` (or wire it up in T-04).

### T-20 🟡 CI/CD hardening
- Pin all actions to commit SHAs (checkout, setup-node, docker/*, azure/setup-helm, chart-releaser).
- Per-job `permissions` in `release.yml`. The top-level block grants `packages/pages/id-token: write` to every job, and most are unused.
- `workflow_dispatch`: check out the requested tag (`ref:`), and pass `inputs.tag` through `env:` instead of `${{ }}` inside `run:` (script injection).
- Release must depend on the test jobs. Don't delete existing GitHub releases (hand-written notes).
- Multi-arch builds (`platforms: linux/amd64,linux/arm64`) after T-18.
- Delete or fix the dead `e2e-ai-artifact.yml` (no caller, no permissions, shell injection through inputs).
- Artifact Hub: real `repositoryID`, publish `artifacthub-repo.yaml` to gh-pages, fix the site's `.tgz` link (chart-releaser puts the chart in release assets).

### T-21 🟡 OpenAPI spec accuracy
**Problem.** `pb_hooks/openapi.pb.js` claims public GET for products/categories/media (false today), calls tenants private (actually public), documents backup paths as `/api/api/backup/*`, lists non-existent fields (`Product.sku`, `Media.name`, `Tenant.description`) and misses real ones (`active`, `sort_order`, `custom_fields`, `file`, `plan`, `theme_config`). It also omits the setup/oidc/users-search routes and hard-codes version `1.0.0`.
**Do.** Generate the schemas at request time from `$app.findAllCollections()` plus the actual rules (null / "" / expression → Admin / Public / Private). Build the custom-route section from one route registry shared with the hooks (after T-16). Add a test that every spec path exists and every documented field exists.

### T-22 🔵 Schema cleanup
- `tenants.users` (relation, max 99) duplicates `user_tenants`; remove it after checking the frontend doesn't use it.
- `media.s3_key`, `s3_url`, `thumbnail_url`, `usage_count`, `filename`: check usage, since PB manages storage and thumbs. Drop them or populate them consistently.
- `api_keys.tenant` is a text field. Make it a relation to `tenants` now that `tenants` exists (order issue from 1737*).
- Add `products.slug`/`categories.slug` pattern validation and `UNIQUE(tenant, slug)` (T-02).
- Remove `instance_settings` duplicates of PB settings (appName, S3, OIDC) where PB is the source of truth. Note that `InstanceSettings` already "syncs instance name to PocketBase app metadata".

### T-23 🔵 Scripts & docs hygiene
- Delete `scripts/fix-pocketbase.ts` (`npm run fix`). It uses `pb.admins`, the v0.22 schema and `@request.auth.admin`, and, if ported, would set tenants create/update/delete rules to `""` (**public write**) and move orphaned memberships and roles into the default tenant. Delete or rewrite `scripts/test-api-rules.ts` (it asserts nothing, always exits 0, has a scoping bug on `utResult`).
- `scripts/test-helm.sh`: stop hard-coding `TAG/PB_IMAGE/FE_IMAGE` (overrides the Makefile), use runtime-agnostic image checks, require an explicit kube context.
- README / `.env.example`: remove the "PB v0.22.7" statements (S3 env vars, admins API), fix the PB_SECRET generation command, document the real auth model and API-key flow.
- Replace `API_KEYS_REPORT.md` and `.opencode/*` v0.22 content with pointers to `ai-pedia.md`.

---

## Quick index

Status column: **✅ passed** = merged and verified against the acceptance criteria (code review + full local
suite + CI on `main`, 2026-09-27); **✅ passed, follow-ups** = acceptance met but residual gaps were found —
see the follow-up table below; **open** = not started.

| ID | Sev | Area | One-liner | Status |
|---|---|---|---|---|
| T-01 | 🔴 | hooks | Forged JWT bypass on api-keys/backup/stats/users-search | ✅ passed |
| T-02 | 🔴 | rules | Open sign-up + no tenant isolation in collection rules | ✅ passed |
| T-03 | 🔴 | hooks | `source:"oidc"` makes anyone tenant admin | ✅ passed |
| T-04 | 🔴 | setup | Unauthenticated first-superuser bootstrap; wizard re-runnable | ✅ passed, follow-ups T-04.1, T-04.2 |
| T-05 | 🔴 | api keys | Plaintext service passwords, revoke ineffective, unscoped | ✅ passed, follow-ups T-05.1, T-05.2 |
| T-06 | 🔴 | helm | `helm upgrade` deletes namespace + PVC; PB_SECRET rotation | ✅ passed, follow-up T-06.1 |
| T-07 | 🟠 | secrets | Plaintext secrets in records/backups; PB_SECRET silently off | ✅ passed, follow-up T-07.1 |
| T-08 | 🟠 | media | Public files; auth JWT leaked in file URLs | ✅ passed, follow-up T-08.1 |
| T-09 | 🟠 | tests | Integration tests never run in CI; harness targets v0.22 | ✅ passed |
| T-10 | 🟠 | auth | Disabled-superuser guard bypassable; tokens not revoked | ✅ passed |
| T-11 | 🟠 | backup | Export without media, OOM, non-transactional import | ✅ passed, follow-ups T-11.1, T-11.2 |
| T-12 | 🟠 | nginx | 1 MB upload limit, SSE buffering, no security headers | ✅ passed, follow-up T-12.1 |
| T-13 | 🟡 | oidc | Manual memberships hijacked/deleted; email auto-link | ✅ passed |
| T-14 | 🟡 | auth | Superuser MFA never enabled on fresh installs | ✅ done (`mfa.pb.js` + `lib/mfa.js`, admin banner, `superuser-mfa-setup.test.ts`) |
| T-15 | 🟡 | frontend | Pagination, custom_fields, auth store, filter injection | ✅ done, follow-ups T-15.1–T-15.3 |
| T-16 | 🟡 | hooks | String-built handlers → modules; remove helm hook copy | ✅ done (no `new Function` left; `check:hooks` in CI; helm hook copy + ConfigMap removed), follow-up T-16.1 |
| T-17 | 🟡 | frontend | Lint, lazy routes, types, runtime config, split components | ✅ done (component split + typegen deferred → T-17.1), follow-ups T-17.2, T-17.3 |
| T-18 | 🟡 | image | Multi-arch, checksum, EOL base, entrypoint args | ✅ done, follow-up T-18.1 |
| T-19 | 🟡 | helm | securityContext, NetworkPolicy, config checksums | ✅ done (T-06.1 already satisfied), follow-up T-19.1 |
| T-20 | 🟡 | CI | SHA pinning, permissions, dispatch injection, release gating | ✅ done, follow-ups T-20.1–T-20.3 |
| T-21 | 🟡 | api docs | OpenAPI spec disagrees with reality | ✅ done (spec generated from live collections + `lib/routes.js`; `openapi.test.ts`), follow-ups T-21.1, T-21.2 |
| T-22 | 🔵 | schema | Redundant/unused fields, relation types, indexes | ✅ done (`1780001000_schema_cleanup.js`; OIDC columns kept → T-22.1), follow-ups T-22.1–T-22.3 |
| T-23 | 🔵 | scripts/docs | Delete dangerous fix script; fix stale v0.22 docs | ✅ done, follow-up T-23.1 |

### Follow-ups from the T-01…T-13 verification (ordered by criticality)

| ID | Sev | Area | Gap | Do |
|---|---|---|---|---|
| T-07.1 | 🟠 | secrets | `Setup.tsx` (`buildStorageConfig`) still writes `s3_access_key`/`s3_secret_key`, and `OidcSettings.tsx` still writes `oidc_client_secret` when typed, into `instance_settings`. Fields are `hidden` and stripped from backups, but the plaintext copy lands in the DB row again on every wizard run / OIDC save. | Stop sending the three secret fields from the frontend; write S3 creds only to PB settings (`/api/settings`) and the OIDC secret only to the `users` oauth2 provider config. Then drop the columns in a migration. Add a test that an instance_settings row has empty secret fields after setup + OIDC save. |
| T-04.1 | 🟠 | setup | `docker-compose.yml` defaults `PB_SUPERUSER_PASSWORD` to `changeme` and `PB_SUPERUSER_IPS` to `0.0.0.0/0`. A compose deployment that forgets `.env` gets a headless superuser with a known password reachable from anywhere. | Remove the password default (fail fast in `entrypoint.sh` when `PB_SUPERUSER_EMAIL` is set but the password is empty or `changeme`), or generate a random password and print it once like the setup token. Default `PB_SUPERUSER_IPS` to a private range in compose. |
| T-06.1 | 🟡 | helm | `superuser-secret.yaml` is still a `pre-install` hook (the pattern T-06 removed from `secret.yaml`). On `helm uninstall` + reinstall the default `before-hook-creation` policy recreates it with a fresh `randAlphaNum 24` password that the marker-guarded `entrypoint.sh` never applies, so the Secret drifts from the real superuser password. | Make it a normal release resource with `lookup` reuse + `helm.sh/resource-policy: keep`, mirroring `secret.yaml`. Extend `scripts/test-helm.sh` to assert `PB_SUPERUSER_PASSWORD` is byte-identical across upgrade and uninstall. |
| T-05.1 | 🟡 | api keys | `demo/src/lib/pb.ts` still persists the raw API key (`API_KEY_KEY`) and the service JWT in `localStorage` after a successful exchange. | Keep the key in memory only (or `sessionStorage`), store just the short-lived JWT, and clear both on tab close. |
| T-04.2 | 🟡 | tests | The e2e for "wizard reload after completion redirects to `/login`" is `test.skip` in `frontend/tests/e2e/auth.spec.ts:55` and still relies on a stale `localStorage.pb_setup_done` flag. The five `setup-storage.spec.ts` tests self-skip because they probe the removed `/api/admins` endpoint. The T-04 redirect acceptance has no automated coverage. | Rewrite the redirect test to drive `/api/stjorna/setup-status` (`setupDone: true`) and un-skip it. Port `setup-storage.spec.ts` to `/api/stjorna/setup-status` instead of `/api/admins`. |
| T-08.1 | 🟡 | tests | `media.spec.ts` asserts `img[src]` contains `token=` but never asserts the value is **not** the auth JWT. The T-08 acceptance ("no URL in the DOM contains the auth JWT") is only covered by the unit test. | Add an e2e assertion that no `src`/`href` in the DOM contains `pb.authStore.token` (read it via `page.evaluate`) and that the `token=` value differs from it. |
| T-05.2 | 🔵 | tests | No test performs a **write** with a service-user JWT. Read-only enforcement is covered only transitively (service users get the `viewer` role; T-02 tests prove viewers cannot write). | Add a case in `api-keys-v2.test.ts`: exchange → POST/PATCH/DELETE on products/categories/media → expect 403/400. |
| T-11.2 | 🟠 | backup | Export still assembles the whole ZIP as a JS number array (`buildZipBytes`) and import reads the entire body into memory (`toBytes(e.request.body)`), so a large tenant export/import can exceed the 256 Mi pod limit. The import route also sets no `bodyLimit`, so PB's default may reject large bodies before the handler runs. | Stream/chunk the ZIP build and the import (or defer large instances to PB's native `/api/backups`), add an explicit body limit to the import route, and add a 200 MB round-trip test that asserts it stays under the pod memory limit. |
| T-11.1 | 🟡 | backup | The T-11 acceptance requires a round-trip test on S3 (MinIO) storage, but only the local-filesystem round-trip is covered. The export/import code is S3-aware (`$app.newFilesystem()`, `record.baseFilesPath()`) but has never been exercised against real S3. | Stand up MinIO in the test harness (container + PB S3 settings via `/api/settings`), then run the export→import round-trip with media on S3 and assert identical counts, relations and file bytes. |
| T-12.1 | 🟡 | nginx | The frontend proxy forwards `X-Forwarded-For`/`X-Real-IP`, but PocketBase does not trust the proxy, so PB rate limits and `PB_SUPERUSER_IPS` see the nginx pod IP instead of the real client. | Configure PB's trusted proxy settings (Settings → trusted proxy headers `X-Forwarded-For`/`X-Real-IP`) through a migration or the setup step. |

### Follow-ups from the T-14…T-23 implementation (ordered by criticality)

| ID | Sev | Area | Gap | Do |
|---|---|---|---|---|
| T-17.2 | 🟠 | frontend | Runtime `PB_URL` (`/config.js`) can point the SPA at another origin, but the nginx CSP has `connect-src 'self'`, so a cross-origin PB is blocked in the browser. | Render the CSP from a template at container start (`/etc/nginx/templates` + envsubst) adding the PB origin, in both `frontend/nginx.conf` and the helm `frontend-configmap.yaml`; expose `frontend.pbUrl` in values. |
| T-18.1 | 🟠 | compose | `pb_data` moved from an anonymous to a named volume. Existing compose users get an empty instance on the next `up`; the old data stays in the orphaned anonymous volume. | Release note with a one-time copy (`docker run --rm -v <anon>:/from -v stjorna_pb_data:/to alpine cp -a /from/. /to/`), or detect an empty volume in `entrypoint.sh` and print the hint. |
| T-19.1 | 🟠 | helm | `pocketbase.superuserIps` (`PB_SUPERUSER_IPS`) sees the ingress/nginx IP unless PB trusts the proxy headers (same root cause as T-12.1), so an allow-list either locks everyone out or allows everyone. | Fix T-12.1 first (trusted proxy settings via migration/setup), then document the value as usable. |
| T-21.1 | 🟠 | api docs | The public spec (also what the gh-pages site embeds) now shows almost no collection paths, because every tenant collection requires auth. The T-21 premise "tenants are public" was wrong: tenants and user_tenants are Private (membership rules). | Fetch the spec with a superuser token in the release job for the site, or add a `?full=1` superuser-only variant. |
| T-15.1 | 🟠 | frontend | Remaining truncation: ProductEdit/CategoryEdit media & category pickers load `getList(1, 200)`, MediaEdit usage 200, `activity.ts` and ApiKeys `getFullList` across all tenants. | Server-backed searchable Combobox; scope activity queries to the current tenant and paginate. |
| T-15.2 | 🟠 | frontend | `authStore.loadTenants` falls back to one `getOne` per membership row for tenant/role when `expand` fails (N+1). | Rely on `expand`, or batch with a single `id ?= ` filter. |
| T-22.1 | 🟠 | schema | `instance_settings.oidc_*` (client id, URLs, scopes, provider/display name) still duplicate `users.oauth2` and can drift. | Read the provider from `users.oauth2.providers` in OidcSettings + `oidc_config.pb.js`/`oidc_groups.pb.js`, then drop the columns. Also drop unused `instance_logo_url`/`instance_tagline`. |
| T-16.1 | 🟡 | helm | Before T-16 the chart's hooks ConfigMap (mounted by default) only globbed `*.pb.js`, so `lib/*.js` was missing and every `require()`-based hook (backup, OIDC, MFA) failed on Helm installs. Fixed by baking hooks into the image only, but no helm test exercises a hook route. | Extend `scripts/test-helm.sh` smoke test to call `/api/stjorna/setup-status` and `/api/stjorna/openapi.json` through the frontend service. |
| T-21.2 | 🟡 | hooks | An unknown `GET /api/*` path returns the static fallback's "File not found." instead of PB's JSON 404. | Register a catch-all `/api/{path...}` 404 JSON route after the custom routes, or exclude `/api/` from the static handler. |
| T-16.2 | 🟡 | api keys | Revoking a key whose service user is already gone logs `svc-user teardown failed: sql: no rows`. | Treat a missing service user as success in `lib/apikeys.js`. |
| T-22.2 | 🟡 | backup | Backup import matches existing media by `filename`, which isn't unique per tenant, so it can update the wrong row. | Match by the exported record id (kept in the manifest) or by file hash; add a test with two same-named media. |
| T-20.1 | 🟡 | CI | Release is gated on `ci.yml`, but `test-e2e` is still `continue-on-error`, so a red e2e suite doesn't block a release. New/updated e2e specs from T-15 (pagination, custom_fields round-trip, confirm dialog) have not been run yet. | Run the e2e suite, fix failing specs, then remove `continue-on-error`. |
| T-20.2 | 🟡 | CI | arm64 images build under QEMU; `npm ci` + vite build for the frontend under emulation is slow. | Build the frontend builder stage with `--platform=$BUILDPLATFORM` (output is static), or use native arm runners. |
| T-20.3 | 🟡 | release | `artifacthub-repo.yaml` `repositoryID` is still a zero placeholder; `notify-artifacthub` posts to an endpoint that is likely not public. | Register the repo on Artifact Hub, set the real ID, drop or fix the notify job. |
| T-16.3 | 🔵 | hooks | `lib/backup.js` keeps its own reply/admin helpers (`{success:false}` shape) and its `isTenantAdmin` checks only the first `user_tenants` row. | Move to `lib/http.js` helpers; keep the response shape via a thin wrapper. |
| T-15.3 | 🔵 | frontend | Pages still carry their own `if (!isAuthenticated()) navigate('/login')` checks next to the new `RequireAuth` guard; login does not return to the original page. | Remove the per-page checks; add `?redirect=` to the guard and Login. |
| T-17.1 | 🔵 | frontend | Big components not split (Setup, MediaEdit, UserManagement, TenantSettings, OidcSettings, ProductEdit); no tenant-scoped `services/catalog.ts`; types still hand-written (no typegen). | Split per page section; generate types with `pocketbase-typegen` against the test container in CI with a diff check. |
| T-17.3 | 🔵 | frontend | ESLint passes with ~280 warnings (217 `no-explicit-any`, 27 `solid/reactivity`); `vite.config.ts` uses `__dirname` (Vite 8 warns). | Tighten gradually and flip the rules to `error`; use `import.meta.dirname`. |
| T-23.1 | 🔵 | docs | `ai-pedia.md` referenced at the top of this file is not in the repo (only untracked under `.claude/`); pointers in `.opencode/*` and `API_KEYS_REPORT.md` therefore go to README + hook headers. `.codacy.yml` still references `API_KEYS_REPORT.md`; unused `tsx` devDependency in `pocketbase/package.json`. | Commit `ai-pedia.md` (or drop the references) and clean the leftovers. |
