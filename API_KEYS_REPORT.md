# STJÓRNA API Keys — Issue Report

What landed in `feature/demo-app`:

- `pocketbase/pb_migrations/1737100000_add_api_keys_collection.js` — first-boot migration that creates `api_keys` with all fields, locks every rule to `null` (superuser-only access).
- `pocketbase/pb_hooks/api_keys.pb.js` — admin-only issue/list/revoke/introspect custom routes (PB superuser enforced via JWT-claim check, not STJÓRN A's user role).
- `pocketbase/pb_hooks/openapi.pb.js` — new `/stjorna/api-keys*` entries in the OpenAPI spec.
- `frontend/src/pages/ApiKeys.tsx` + router + sidebar entry — admin-only management UI. Plaintext shown once via a copy-once modal.
- `pocketbase/setup.ts` — updated the test harness's `api_keys` schema so the test container picks up the same field set as the migration.
- `pocketbase/tests/api-keys.test.ts` — 11 tests (issue, list, admin-guard, missing-fields, tenant-missing, revoke, introspect happy path, wrong secret, revoked, malformed, expired). **All passing.**
- `pocketbase/tests/collections/*` — unchanged; all 76 pre-existing tests still pass.
- `demo/` — already accepted `stjorna_…` keys; README clarifies it.

---

## Open issue: API keys don't actually unlock private STJÓRN A data

**This is the part we should discuss before shipping.**

PB collection rules in STJÓRN A look like this (from `setup.ts`):

```js
listRule: '@request.auth.tenant = tenant',
viewRule: '@request.auth.tenant = tenant',
createRule: '@request.auth.tenant = tenant',
updateRule: '@request.auth.tenant = tenant',
deleteRule: '@request.auth.id != ""',
```

These reference `@request.auth` — the **PB user record**. An API key bearer is *not* a PB user record; PB has no way to inject a synthesized auth record into a request via hooks.

What the API key gets you **today**:

- Issue/list/revoke/introspect endpoints work as designed.
- Public collections (no listRule) like `categories` + `products` work — STJÓRN A's setup currently has them **with** rules, so they actually DON'T work today either.

What the API key does NOT get you:

- Reading `categories`, `products`, `media` (private fields) via `/api/collections/*`. The hooks can verify the bearer, but PB still rejects the read because `@request.auth.tenant` is undefined.

So the demo I shipped still needs `pb.collection('categories').getList(...)` to pass through the STJÓRN A rules. With an API key bearer, those calls 401.

### Option A — treat the key as a STJÓRN A service-user at mint time (recommended)

When admin issues a key:

1. Backend creates (or reuses) a hidden `users` row per tenant with `role='admin'` named like `__apikey__<prefix>` and a long random password.
2. API key = `stjorna_<prefix>.<hmac(secret, service-user.password)>`.
3. A custom `/api/stjorna/api-keys/exchange` route accepts the API key, looks up the service user, and uses PB's internal `users.authWithPassword` to mint a real STJÓRN A user JWT, then returns it. Caller swaps the JWT into the bearer for subsequent `/api/collections/*` calls.

Pros: STJÓRN A's existing rules work unchanged. No changes to collection rules.
Cons: A second round-trip to "exchange" the key for a JWT, and you leak the JWT to the caller. PB sessions are short-lived (token TTL on PB) so this is mostly OK but worth noting.

### Option B — open collection rules + enforce tenant in hooks

Replace `@request.auth.tenant = tenant` with `tenant = {:t}` style, and add per-collection hooks that fill in `:t` from the verified API key's tenant. STJÓRN A's admin UI uses `@request.auth.tenant`, so this would change the rule syntax in 6+ places (`categories`, `products`, `media`, `product_media`, `webhooks`, `embed_configs`, `analytics_events`, `settings`).

Pros: One round-trip per call, simpler to operate.
Cons: Big rule rewrite, breaks any user JWT that doesn't carry a tenant claim (PB superusers), and conflates "is this caller my STJÓRN A user" with "is this caller any of my STJÓRN A users".

### Option C — synthesize `@request.auth` in a global hook (probably impossible)

PB doesn't expose a way to inject a fake auth record into `request.auth` for downstream collection-rule evaluation. `onRecordEnrich` runs after the auth context is locked. So this approach doesn't exist.

### My recommendation

**Option A**. It's the only path that keeps STJÓRN A's existing rule surface and lets the API key behave like any other STJÓRN A user. The cost (one extra exchange round-trip, a token-leak vector during exchange) is small and well-understood.

Want me to implement Option A as a follow-up? It would touch:

- `pocketbase/pb_hooks/api_keys.pb.js` (new `/exchange` route + service-user lookup)
- `pocketbase/setup.ts` (new `service_users` collection or `is_service` flag on `users`)
- `pocketbase/pb_migrations/…` (one for the service-user infrastructure)
- `frontend/src/pages/ApiKeys.tsx` (optional "exchange now" button for testing)
- `demo/src/lib/pb.ts` (auto-exchange + cache the JWT)

Estimated ~150 LOC plus a handful of new tests.

---

## Smaller issues found while building this

1. **PB JS hook quirks worth recording in the codebase:**
   - `$app.dao().findFirstRecordByFilter(...)` and `findRecordsByFilter(...)` throw `sql: no rows in result set` for missing rows, and silently return nothing when the filter expression parses wrong. We use `findRecordsByExpr` + JS-side filtering instead — matches the pattern in `backup.pb.js`.
   - `$app.dao().findRecordById(collectionObject, id)` returns ErrNoRows even when the row exists. Passing the literal name string (`'api_keys'`) works.
   - `$app.dao().recordsQuery(...)` is not exposed via goja on this PB version.
   - PB `routerAdd(method, "/path/{id}", …)` path-param binding is unreliable; we use `routerAdd("DELETE", "/api/stjorna/api-keys/*", …)` and parse the id from `c.request().url` ourselves.
   - PB returns Date fields as a goja `time.Time` wrapper, not a JS `Date`. Normalise via `String(exp).replace(' ', 'T')` before `Date.parse`.
2. **No indexes.** The `prefix` field has no SQL index. With many keys the introspect `findRecordsByExpr('api_keys')` scan gets slow. Add `CREATE UNIQUE INDEX idx_api_keys_prefix ON api_keys (prefix)` once we have a follow-up migration with the next schema change. (Tried to add it in this PR; PB's JS migration API for indexes isn't stable across 0.21→0.22 and the only path via raw SQL threw, so we left it out.)
3. **`permissions` is unstructured JSON today.** No scope list, no per-resource scoping. STJÓRN A's collection rules are unaware of `permissions`. Until we wire Option A or B above, this column is purely informational.

---

## Files in this PR

```text
demo/README.md                                       (existing, minor text)
demo/src/pages/Settings.tsx                          (existing, label widened)
frontend/src/App.tsx                                 (1 line added)
frontend/src/components/layout/Sidebar.tsx           (1 entry added)
frontend/src/pages/ApiKeys.tsx                       (new)
pocketbase/pb_hooks/api_keys.pb.js                   (new)
pocketbase/pb_hooks/openapi.pb.js                    (4 routes added)
pocketbase/pb_migrations/1737100000_add_api_keys_collection.js  (new)
pocketbase/setup.ts                                  (api_keys schema updated)
pocketbase/tests/api-keys.test.ts                    (new, 11 tests, all passing)
```
