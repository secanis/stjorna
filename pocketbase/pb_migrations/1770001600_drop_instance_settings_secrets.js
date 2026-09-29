/// <reference path="../pb_data/types.d.ts" />

// T-07.1: drop the plaintext secret columns from instance_settings.
//
// Migration 1770001300 hid s3_secret_key / s3_access_key /
// oidc_client_secret and scrubbed their values, but kept the columns.
// The frontend kept writing to them (Setup wizard, OIDC settings), so
// every wizard run / OIDC save put a plaintext copy of the credential
// back into the database row. PocketBase's own settings (S3, encrypted
// with PB_SECRET) and the `users` collection's oauth2 provider config
// are the only places these values belong.
//
// The frontend no longer sends the fields. Dropping the columns makes
// the write impossible: PB silently ignores unknown keys in a record
// body, so an old client keeps working but can no longer leak.
//
// Rollback re-adds the (empty, hidden) columns.

const SECRET_FIELDS = ["s3_secret_key", "s3_access_key", "oidc_client_secret"];

migrate((app) => {
  const settings = app.findCollectionByNameOrId("instance_settings");
  if (!settings) return;

  let changed = false;
  for (const name of SECRET_FIELDS) {
    const f = settings.fields.getByName(name);
    if (!f) continue;
    settings.fields.removeByName(name);
    changed = true;
  }
  if (changed) app.save(settings);
}, (app) => {
  const settings = app.findCollectionByNameOrId("instance_settings");
  if (!settings) return;

  let changed = false;
  for (const name of SECRET_FIELDS) {
    if (settings.fields.getByName(name)) continue;
    settings.fields.add(new TextField({ name, max: 500, hidden: true }));
    changed = true;
  }
  if (changed) app.save(settings);
});
