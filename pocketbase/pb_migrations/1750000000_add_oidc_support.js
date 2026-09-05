/// <reference path="../pb_data/types.d.ts" />

// Adds OIDC support fields:
//   - users.name (maps OIDC displayName)
//   - user_tenants.source (oidc | manual)
//   - instance_settings.oidc_* configuration
//
// Why both migration and Setup updates: migrations run before first boot,
// so instance_settings/user_tenants may not exist yet. New instances get
// the fields from Setup; existing instances get them from this migration.

migrate((db) => {
  const dao = new Dao(db);

  // ---- users: add name field ----
  try {
    const users = dao.findCollectionByNameOrId("_pb_users_auth_");
    if (!users.schema.getFieldByName("name")) {
      users.schema.addField(new SchemaField({ name: "name", type: "text", options: { maxLen: 200 } }));
      dao.saveCollection(users);
    }
  } catch (_) {}

  // ---- user_tenants: add source field ----
  try {
    const ut = dao.findCollectionByNameOrId("user_tenants");
    if (!ut.schema.getFieldByName("source")) {
      ut.schema.addField(new SchemaField({ name: "source", type: "text", options: { maxLen: 50 } }));
      dao.saveCollection(ut);
    }
  } catch (_) {}

  // ---- instance_settings: add OIDC config fields ----
  const oidcFields = [
    { name: "oidc_enabled", type: "bool", options: {} },
    { name: "oidc_provider_name", type: "text", options: { maxLen: 50 } },
    { name: "oidc_display_name", type: "text", options: { maxLen: 100 } },
    { name: "oidc_client_id", type: "text", options: { maxLen: 500 } },
    { name: "oidc_client_secret", type: "text", options: { maxLen: 500 } },
    { name: "oidc_auth_url", type: "text", options: { maxLen: 1000 } },
    { name: "oidc_token_url", type: "text", options: { maxLen: 1000 } },
    { name: "oidc_user_info_url", type: "text", options: { maxLen: 1000 } },
    { name: "oidc_scopes", type: "text", options: { maxLen: 500 } },
    { name: "oidc_group_claim", type: "text", options: { maxLen: 200 } },
    { name: "oidc_group_separator", type: "text", options: { maxLen: 10 } },
    { name: "oidc_default_role", type: "text", options: { maxLen: 50 } },
    { name: "oidc_role_mapping", type: "text", options: { maxLen: 500 } },
    { name: "oidc_auto_create_tenants", type: "bool", options: {} },
    { name: "oidc_deny_on_no_group", type: "bool", options: {} },
    { name: "oidc_disable_password_login", type: "bool", options: {} },
  ];

  try {
    const settings = dao.findCollectionByNameOrId("instance_settings");
    let changed = false;
    for (const def of oidcFields) {
      if (!settings.schema.getFieldByName(def.name)) {
        settings.schema.addField(new SchemaField(def));
        changed = true;
      }
    }
    if (changed) dao.saveCollection(settings);
  } catch (_) {}
}, (db) => {
  // Rollback is best-effort; we do not remove fields to avoid data loss.
  const dao = new Dao(db);
  try {
    const users = dao.findCollectionByNameOrId("_pb_users_auth_");
    const f = users.schema.getFieldByName("name");
    if (f) {
      users.schema.removeField(f.id);
      dao.saveCollection(users);
    }
  } catch (_) {}
});
