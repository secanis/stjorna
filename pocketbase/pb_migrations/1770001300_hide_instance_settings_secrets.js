/// <reference path="../pb_data/types.d.ts" />

// T-07: instance_settings plaintext secret fields.
//
// instance_settings.s3_secret_key / s3_access_key / oidc_client_secret
// were duplicates of values already held in PocketBase's own encrypted
// settings table (s3 creds) or the `users` auth collection's oauth2
// provider config (oidc_client_secret). They were never the source of
// truth, and leaking them through /api/backup/json|zip (which calls
// record.publicExport()) meant an admin backup file would include
// plaintext S3 and OIDC secrets.
//
// Fix:
//   1. Mark the three fields `hidden: true` on the instance_settings
//      collection. PB's publicExport() already strips hidden fields,
//      and the regular CRUD API also stops exposing them, so the
//      frontend has to fall back to the PB-settings endpoint (S3) and
//      users.oauth2 (OIDC) to read or update the actual values.
//   2. Scrub any non-empty value currently stored on existing rows.
//      We do NOT drop the columns outright: some operators may still
//      read/write them through the admin UI (which respects hidden
//      too), and keeping the columns avoids a destructive schema
//      migration. The fields are now write-once / always-blank.
//
// Rollback: best-effort restore of `hidden: false`. The data scrub
// cannot be undone — that's the point.

const SECRET_FIELDS = ["s3_secret_key", "s3_access_key", "oidc_client_secret"];

migrate((app) => {
  const settings = app.findCollectionByNameOrId("instance_settings");
  if (!settings) {
    // Brand-new installs may not have instance_settings yet (older
    // schema). The core-collection migration runs first; this guard
    // exists so this file can be re-applied safely during dev.
    return;
  }

  let schemaChanged = false;
  for (const name of SECRET_FIELDS) {
    const f = settings.fields.getByName(name);
    if (!f) continue;
    if (!f.hidden) {
      f.hidden = true;
      schemaChanged = true;
    }
  }
  if (schemaChanged) {
    app.save(settings);
  }

  // Scrub any value currently stored. We set the field to empty
  // string — TextField({ hidden: true }) still allows writes, so an
  // operator who round-trips an old settings row doesn't get a NULL
  // surprise. After this runs, every existing plaintext copy of
  // those three secrets is gone from the database.
  const rows = app.findRecordsByFilter("instance_settings", "", "", 0, 0);
  for (const row of rows) {
    let changed = false;
    for (const name of SECRET_FIELDS) {
      try {
        const v = row.get(name);
        if (v !== "" && v !== null && v !== undefined) {
          row.set(name, "");
          changed = true;
        }
      } catch (_) {
        // field absent on this row's schema variant — skip
      }
    }
    if (changed) {
      app.save(row);
    }
  }
}, (app) => {
  // Rollback: unhide. Data scrub is intentionally NOT reversed.
  try {
    const settings = app.findCollectionByNameOrId("instance_settings");
    if (!settings) return;
    let changed = false;
    for (const name of SECRET_FIELDS) {
      const f = settings.fields.getByName(name);
      if (f && f.hidden) {
        f.hidden = false;
        changed = true;
      }
    }
    if (changed) app.save(settings);
  } catch (_) {}
});
