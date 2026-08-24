/// <reference path="../pb_data/types.d.ts" />

// Adds fields needed by the service-user exchange flow:
//   - service_user_id         — the auth-record id of the per-tenant
//                               service user created at ISSUE time
//   - service_user_email      — denormalised so EXCHANGE doesn't have
//                               to load the auth record
//   - service_user_password   — plaintext password for the service
//                               user. Needed because PB hashes
//                               `users.password` on save; the only
//                               way to authenticate as that user via
//                               the SDK is to give it the original
//                               plaintext. The api_keys collection
//                               rules are all `null` so STJÓRN A user
//                               JWTs can't read this; only the custom
//                               hooks and PB admins can.
//
// Why a follow-up migration: the original migration created the
// collection with the basic fields. Existing api_keys rows from
// before this migration won't have service_user_id populated —
// EXCHANGE returns 409 with `legacy: true` so callers know to
// re-issue.
//
// PB 0.22.7 exits the serve process if a migration throws during
// startup, so every step is wrapped in try/return.

migrate((db) => {
  const dao = new Dao(db);

  let apiKeys;
  try {
    apiKeys = dao.findCollectionByNameOrId("api_keys");
  } catch (_) {
    return;
  }

  const fieldDefs = [
    { name: "service_user_id",       type: "text", required: false, options: { maxLen: 100 } },
    { name: "service_user_email",    type: "text", required: false, options: { maxLen: 255 } },
    { name: "service_user_password", type: "text", required: false, options: { maxLen: 255 } },
  ];

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
    try { dao.saveCollection(apiKeys); } catch (_) { /* best-effort */ }
  }
}, (db) => {
  // Rollback: drop the new fields (idempotent via try/catch).
  const dao = new Dao(db);
  try {
    const apiKeys = dao.findCollectionByNameOrId("api_keys");
    for (const name of ["service_user_password", "service_user_email", "service_user_id"]) {
      try { apiKeys.schema.removeField(name); } catch (_) { /* best-effort, field may not exist */ }
    }
    dao.saveCollection(apiKeys);
  } catch (_) { /* best-effort, collection may not exist */ }
});
