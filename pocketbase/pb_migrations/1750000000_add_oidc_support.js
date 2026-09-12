/// <reference path="../pb_data/types.d.ts" />

// Adds OIDC support fields:
//   - users.name (maps OIDC displayName)
//   - user_tenants.source (oidc | manual)
//   - instance_settings.oidc_* configuration
//
// Why both migration and Setup updates: migrations run before first boot,
// so instance_settings/user_tenants may not exist yet. New instances get
// the fields from Setup; existing instances get them from this migration.

migrate((app) => {
  // ---- users: add name field ----
  try {
    const users = app.findCollectionByNameOrId("users");
    if (!users.fields.getByName("name")) {
      users.fields.add(new TextField({ name: "name", max: 200 }));
      app.save(users);
    }
  } catch (_) {}

  // ---- user_tenants: add source field ----
  try {
    const ut = app.findCollectionByNameOrId("user_tenants");
    if (!ut.fields.getByName("source")) {
      ut.fields.add(new TextField({ name: "source", max: 50 }));
      app.save(ut);
    }
  } catch (_) {}

  // ---- instance_settings: add OIDC config fields ----
  const oidcFields = [
    new BoolField({ name: "oidc_enabled" }),
    new TextField({ name: "oidc_provider_name", max: 50 }),
    new TextField({ name: "oidc_display_name", max: 100 }),
    new TextField({ name: "oidc_client_id", max: 500 }),
    new TextField({ name: "oidc_client_secret", max: 500 }),
    new TextField({ name: "oidc_auth_url", max: 1000 }),
    new TextField({ name: "oidc_token_url", max: 1000 }),
    new TextField({ name: "oidc_user_info_url", max: 1000 }),
    new TextField({ name: "oidc_scopes", max: 500 }),
    new TextField({ name: "oidc_group_claim", max: 200 }),
    new TextField({ name: "oidc_group_separator", max: 10 }),
    new TextField({ name: "oidc_default_role", max: 50 }),
    new TextField({ name: "oidc_role_mapping", max: 500 }),
    new BoolField({ name: "oidc_auto_create_tenants" }),
    new BoolField({ name: "oidc_deny_on_no_group" }),
    new BoolField({ name: "oidc_disable_password_login" }),
  ];

  try {
    const settings = app.findCollectionByNameOrId("instance_settings");
    let changed = false;
    for (const f of oidcFields) {
      if (!settings.fields.getByName(f.name)) {
        settings.fields.add(f);
        changed = true;
      }
    }
    if (changed) app.save(settings);
  } catch (_) {}
}, (app) => {
  // Rollback is best-effort; we do not remove fields to avoid data loss.
  try {
    const users = app.findCollectionByNameOrId("users");
    const f = users.fields.getByName("name");
    if (f) {
      users.fields.removeByName(f.id);
      app.save(users);
    }
  } catch (_) {}
});
