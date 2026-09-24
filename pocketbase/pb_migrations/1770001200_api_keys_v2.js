/// <reference path="../pb_data/types.d.ts" />

// T-05: api_keys v2.
//
// 1. Drop the `service_user_password` column. The plaintext password
//    has no business living in a record row — the api_keys row stores
//    only the auth-record id + email, and the JWT is minted on demand
//    at /exchange via `record.newAuthToken()`.
//
// 2. KEEP `service_user_email` and `service_user_id`. The /exchange
//    response includes the email so the caller can display which
//    account is in use; the id is the lookup key for the service
//    user record at /exchange time.
//
// 3. Add UNIQUE INDEX on `prefix` so /me, /exchange and /list don't have
//    to scan the whole table. Lookups become `prefix = '<p>' &&
//    revoked = false` (handled by the lookup helper in api_keys.pb.js).
//
// 4. Scrub any pre-existing service users. After T-05 the api_keys
//    rows still reference them by id; deleting the user breaks the
//    chain entirely. Even if some leaked plaintext password is still
//    out there, the rows are gone.
//
// 5. Best-effort: clear `service_user_password` from existing rows
//    (the field itself will be dropped too). Field-level read access
//    is locked by `null` rules anyway, but defence-in-depth.

migrate((app) => {
  const ak = app.findCollectionByNameOrId("api_keys");
  if (!ak) return;

  // -------------------------------------------------------------------------
  // 1. UNIQUE INDEX on prefix
  // -------------------------------------------------------------------------
  try {
    app.db().newQuery(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys (prefix);"
    ).execute();
  } catch (_) {}

  // -------------------------------------------------------------------------
  // 2. Scrub (and delete if the legacy rows reference real users).
  // -------------------------------------------------------------------------
  // Two ways to do this safely:
  //   a. Walk every api_keys row, look up the service user, delete it,
  //      null the columns.
  //   b. Just blank the columns. /exchange will refuse any legacy row
  //      with `service_user_id = ''` anyway (returns 409 with
  //      `legacy: true`).
  // We do (a) — it's the only way to make sure any leaked password /
  // outstanding JWT is invalidated.
  try {
    const rows = app.findRecordsByFilter("api_keys", "", "", 0, 0);
    const userCol = app.findCollectionByNameOrId("users");
    for (const r of rows) {
      let svcId = "";
      try { svcId = String(r.get("service_user_id") || ""); } catch (_) {}
      if (svcId) {
        try {
          const svc = app.findRecordById(userCol, svcId);
          if (svc) {
            try {
              if (typeof svc.refreshTokenKey === "function") {
                svc.refreshTokenKey();
              }
            } catch (_) {}
            try { app.delete(svc); } catch (_) {}
          }
        } catch (_) {}
      }
      try { r.set("service_user_id", ""); } catch (_) {}
      try { r.set("service_user_password", ""); } catch (_) {}
      try { app.save(r); } catch (_) {}
    }
  } catch (_) {}

  // -------------------------------------------------------------------------
  // 3. Drop the service_user_password column itself. service_user_id
  //    and service_user_email stay — they're denormalised metadata used
  //    by the response builder in /exchange and the helper lookups.
  // -------------------------------------------------------------------------
  try {
    const f = ak.fields.getByName("service_user_password");
    if (f) {
      ak.fields.removeByName("service_user_password");
      app.save(ak);
    }
  } catch (_) {}

  // `service_user_id` stays as denormalised join key — cheap to read,
  // and the alternative (look up by email) is unreliable because the
  // service user is gone.
}, (app) => {
  // Rollback: re-add the dropped columns and clear the UNIQUE index.
  // Best-effort.
  const ak = app.findCollectionByNameOrId("api_keys");
  if (!ak) return;
  try {
    if (!ak.fields.getByName("service_user_password")) {
      ak.fields.add(new TextField({ name: "service_user_password", max: 255 }));
    }
    app.save(ak);
  } catch (_) {}
  try {
    app.db().newQuery("DROP INDEX IF EXISTS idx_api_keys_prefix;").execute();
  } catch (_) {}
});
