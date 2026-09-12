/// <reference path="../pb_data/types.d.ts" />

// Adds the `api_keys` collection + fields.
//
// Why now: setup.ts already declares an `api_keys` collection so the test
// harness can spawn it, but it has no rules, no `prefix`/`revoked`
// fields, and no PB migration file. Without a migration, fresh
// production PB instances (initialised through the setup wizard, not
// the test harness) never get the collection at all. The frontend
// cannot manage what isn't there.
//
// Schema mirrors the text-typed `tenant` convention used by every other
// STJÓRN A collection (categories, products, media, …) — relations on a
// not-yet-existing `tenants` collection during first-boot migrations
// would fail the migration entirely.
//
// All four access rules are set to `null` so STJÓRN A user JWTs cannot
// list/view/update/delete keys directly — every access goes through the
// admin-only custom routes in pb_hooks/api_keys.pb.js.

migrate((app) => {
  // ---- Step 1: ensure api_keys collection exists ----
  let apiKeys;
  try {
    apiKeys = app.findCollectionByNameOrId("api_keys");
  } catch (_) {
    apiKeys = new Collection({
      name: "api_keys",
      type: "base",
      fields: [],
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    app.save(apiKeys);
  }

  // ---- Step 2: ensure required fields ----
  // tenant is text-typed (matches every other STJÓRNA collection —
  // a relation to a not-yet-existing `tenants` collection would fail
  // on first-boot migrations). The hook enforces that the tenant
  // referenced actually exists.
  const fieldDefs = [
    new TextField({ name: "tenant", required: true, min: 1, max: 100 }),
    new TextField({ name: "name", required: true, min: 1, max: 200 }),
    new TextField({ name: "prefix", required: true, min: 1, max: 32, pattern: "^[a-zA-Z0-9_]+$" }),
    new TextField({ name: "key_hash", required: true, min: 1, max: 256 }),
    new JSONField({ name: "permissions", maxSize: 4096 }),
    new DateField({ name: "last_used" }),
    new DateField({ name: "expires" }),
    new BoolField({ name: "revoked" }),
    new TextField({ name: "created_by", max: 100 }),
  ];

  let changed = false;
  for (const f of fieldDefs) {
    if (apiKeys.fields.getByName(f.name)) continue;
    apiKeys.fields.add(f);
    changed = true;
  }

  if (changed) {
    app.save(apiKeys);
  }

  // ---- Step 3: lock all rules (collection access via the custom route only) ----
  const rulesCleared =
    apiKeys.listRule === null && apiKeys.viewRule === null &&
    apiKeys.createRule === null && apiKeys.updateRule === null &&
    apiKeys.deleteRule === null;
  if (!rulesCleared) {
    apiKeys.listRule = null;
    apiKeys.viewRule = null;
    apiKeys.createRule = null;
    apiKeys.updateRule = null;
    apiKeys.deleteRule = null;
    app.save(apiKeys);
  }
}, (app) => {
  // Rollback: drop the api_keys collection (idempotent via try/catch).
  try {
    const apiKeys = app.findCollectionByNameOrId("api_keys");
    app.delete(apiKeys);
  } catch (_) {}
});
