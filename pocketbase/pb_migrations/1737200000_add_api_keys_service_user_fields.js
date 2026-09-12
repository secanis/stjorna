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

migrate((app) => {
  let apiKeys;
  try {
    apiKeys = app.findCollectionByNameOrId("api_keys");
  } catch (_) {
    return;
  }

  const fieldDefs = [
    new TextField({ name: "service_user_id", max: 100 }),
    new TextField({ name: "service_user_email", max: 255 }),
    new TextField({ name: "service_user_password", max: 255 }),
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
}, (app) => {
  // Rollback: drop the new fields (idempotent via try/catch).
  try {
    const apiKeys = app.findCollectionByNameOrId("api_keys");
    for (const name of ["service_user_password", "service_user_email", "service_user_id"]) {
      try { apiKeys.fields.removeByName(name); } catch (_) {}
    }
    app.save(apiKeys);
  } catch (_) {}
});
