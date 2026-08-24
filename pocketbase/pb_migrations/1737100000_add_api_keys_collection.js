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
//
// PB 0.22.7 exits the serve process if a migration throws during
// startup, so every step is wrapped in try/return.

migrate((db) => {
  const dao = new Dao(db);

  // ---- Step 1: ensure api_keys collection exists ----
  let apiKeys;
  try {
    apiKeys = dao.findCollectionByNameOrId("api_keys");
  } catch (_) {
    apiKeys = new Collection({
      name: "api_keys",
      type: "base",
      schema: [],
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    dao.saveCollection(apiKeys);
  }

  // ---- Step 2: ensure required fields ----
  // tenant is text-typed (matches every other STJÓRNA collection —
  // a relation to a not-yet-existing `tenants` collection would fail
  // on first-boot migrations). The hook enforces that the tenant
  // referenced actually exists.
  const fieldDefs = [
    { name: "tenant",      type: "text", required: true,  options: { min: 1, maxLen: 100 } },
    { name: "name",        type: "text", required: true,  options: { min: 1, maxLen: 200 } },
    { name: "prefix",      type: "text", required: true,  options: { min: 1, maxLen: 32, pattern: "^[a-zA-Z0-9_]+$" } },
    { name: "key_hash",    type: "text", required: true,  options: { min: 1, maxLen: 256 } },
    { name: "permissions", type: "json", required: false, options: { maxSize: 4096 } },
    { name: "last_used",   type: "date", required: false, options: {} },
    { name: "expires",     type: "date", required: false, options: {} },
    { name: "revoked",     type: "bool", required: false, options: {} },
    { name: "created_by",  type: "text", required: false, options: { maxLen: 100 } },
  ];

  // Re-fetch the schema model — `getFieldByName` is a method on the
  // schema collection, not the record.
  const schemaFieldByName = (name) => {
    try { return apiKeys.schema.getFieldByName(name); }
    catch (_) { return null; }
  };

  const newFields = [];
  for (const def of fieldDefs) {
    if (schemaFieldByName(def.name)) continue;
    newFields.push(new SchemaField(def));
  }
  if (newFields.length > 0) {
    for (const f of newFields) apiKeys.schema.addField(f);
    dao.saveCollection(apiKeys);
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
    dao.saveCollection(apiKeys);
  }
}, (db) => {
  // Rollback: drop the api_keys collection (idempotent via try/catch).
  const dao = new Dao(db);
  try {
    const apiKeys = dao.findCollectionByNameOrId("api_keys");
    dao.deleteCollection(apiKeys);
  } catch (_) {}
});
