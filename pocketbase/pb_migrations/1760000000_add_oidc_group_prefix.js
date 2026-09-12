/// <reference path="../pb_data/types.d.ts" />

// Adds instance_settings.oidc_group_prefix field.
// This allows PocketID-style group names like "stjorna_test_admin"
// to be parsed as tenant "test" + role "admin".

migrate((app) => {
  try {
    const settings = app.findCollectionByNameOrId("instance_settings");
    if (!settings.fields.getByName("oidc_group_prefix")) {
      settings.fields.add(new TextField({ name: "oidc_group_prefix", max: 100 }));
      app.save(settings);
    }
  } catch (_) {}
}, (app) => {
  // Best-effort rollback; we do not remove fields to avoid data loss.
});
