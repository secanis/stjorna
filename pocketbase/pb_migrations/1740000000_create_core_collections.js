/// <reference path="../pb_data/types.d.ts" />

// Creates the core STJÓRNA collections on fresh PocketBase v0.40+ instances.
//
// Previously the setup wizard created these from the browser using the v0.22
// collection format (`schema` + nested `options`), which v0.40 ignores. That
// left collections with only an `id` field, causing tenant lookups to fail.
//
// This migration uses the v0.40 Collection/Field constructors so the schema
// exists before the frontend setup wizard runs.

migrate((app) => {
  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function ensureCollection(name, config) {
    let col;
    try {
      col = app.findCollectionByNameOrId(name);
    } catch (_) {
      col = new Collection(Object.assign({ name, type: "base", fields: [] }, config));
      app.save(col);
      // Reload so we have the generated id for relation fields.
      col = app.findCollectionByNameOrId(name);
    }
    return col;
  }

  function addFields(col, fields) {
    let changed = false;
    for (const f of fields) {
      if (col.fields.getByName(f.name)) continue;
      col.fields.add(f);
      changed = true;
    }
    if (changed) app.save(col);
    return col;
  }

  // The system auth collection is referenced by name; migrations need its id.
  const usersCol = app.findCollectionByNameOrId("users");
  const usersId = usersCol.id;

  // -------------------------------------------------------------------------
  // 1. roles
  // -------------------------------------------------------------------------
  const roles = ensureCollection("roles", {
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });
  addFields(roles, [
    new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    new TextField({ name: "name", required: true, min: 1, max: 100 }),
  ]);

  // Default STJÓRNA roles
  const roleNames = ["viewer", "editor", "admin"];
  for (const rn of roleNames) {
    try {
      app.findFirstRecordByFilter("roles", "name={:n}", { n: rn });
    } catch (_) {
      const rec = new Record(roles);
      rec.set("name", rn);
      app.save(rec);
    }
  }

  // -------------------------------------------------------------------------
  // 2. tenants
  // -------------------------------------------------------------------------
  const tenants = ensureCollection("tenants", {
    listRule: "",
    viewRule: '@request.auth.id != ""',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });
  addFields(tenants, [
    new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    new TextField({ name: "name", required: true, min: 1, max: 200 }),
    new TextField({ name: "slug", required: true, min: 1, max: 200 }),
    new SelectField({
      name: "plan",
      values: ["free", "starter", "professional", "enterprise"],
      maxSelect: 1,
    }),
    new TextField({ name: "custom_domain", max: 500 }),
    new JSONField({ name: "theme_config", maxSize: 2000000 }),
    new RelationField({
      name: "users",
      collectionId: usersId,
      maxSelect: 99,
      cascadeDelete: false,
    }),
  ]);

  // -------------------------------------------------------------------------
  // 3. media
  // -------------------------------------------------------------------------
  const media = ensureCollection("media", {
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  addFields(media, [
    new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    new RelationField({ name: "tenant", collectionId: tenants.id, maxSelect: 1, cascadeDelete: false }),
    new FileField({
      name: "file",
      maxSelect: 1,
      maxSize: 524288000,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"],
    }),
    new TextField({ name: "filename", max: 500 }),
    new TextField({ name: "original_name", max: 500 }),
    new TextField({ name: "mime_type", max: 100 }),
    new NumberField({ name: "size" }),
    new NumberField({ name: "width" }),
    new NumberField({ name: "height" }),
    new TextField({ name: "s3_key", max: 500 }),
    new URLField({ name: "s3_url" }),
    new URLField({ name: "thumbnail_url" }),
    new NumberField({ name: "usage_count" }),
    new RelationField({ name: "createdUser", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
  ]);

  // -------------------------------------------------------------------------
  // 4. categories
  // -------------------------------------------------------------------------
  const categories = ensureCollection("categories", {
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  addFields(categories, [
    new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    new RelationField({ name: "tenant", collectionId: tenants.id, maxSelect: 1, cascadeDelete: false }),
    new TextField({ name: "name", required: true, min: 1, max: 200 }),
    new TextField({ name: "slug", required: true, min: 1, max: 200 }),
    new TextField({ name: "description", max: 2000 }),
    new BoolField({ name: "active" }),
    new NumberField({ name: "sort_order" }),
    new RelationField({ name: "media", collectionId: media.id, maxSelect: 1, cascadeDelete: false }),
  ]);

  // -------------------------------------------------------------------------
  // 5. products
  // -------------------------------------------------------------------------
  const products = ensureCollection("products", {
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  addFields(products, [
    new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    new RelationField({ name: "tenant", collectionId: tenants.id, maxSelect: 1, cascadeDelete: false }),
    new RelationField({ name: "category", collectionId: categories.id, maxSelect: 1, cascadeDelete: false }),
    new TextField({ name: "name", required: true, min: 1, max: 200 }),
    new TextField({ name: "slug", required: true, min: 1, max: 200 }),
    new NumberField({ name: "price" }),
    new EditorField({ name: "description" }),
    new RelationField({ name: "media", collectionId: media.id, maxSelect: 99, cascadeDelete: false }),
    new BoolField({ name: "active" }),
    new NumberField({ name: "sort_order" }),
    new JSONField({ name: "custom_fields", maxSize: 2000000 }),
  ]);

  // -------------------------------------------------------------------------
  // 6. user_tenants
  // -------------------------------------------------------------------------
  const userTenants = ensureCollection("user_tenants", {
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  addFields(userTenants, [
    new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    new RelationField({ name: "user", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    new RelationField({ name: "tenant", collectionId: tenants.id, maxSelect: 1, cascadeDelete: false }),
    new RelationField({ name: "role", collectionId: roles.id, maxSelect: 1, cascadeDelete: false }),
    new TextField({ name: "source", max: 50 }),
  ]);

  // -------------------------------------------------------------------------
  // 7. instance_settings
  // -------------------------------------------------------------------------
  const instanceSettings = ensureCollection("instance_settings", {
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  });
  addFields(instanceSettings, [
    new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
    new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
    new TextField({ name: "instance_name", max: 200 }),
    new TextField({ name: "instance_url", max: 500 }),
    new URLField({ name: "instance_logo_url" }),
    new TextField({ name: "instance_tagline", max: 500 }),
    new BoolField({ name: "setup_done" }),
    new TextField({ name: "storage_type", max: 50 }),
    new TextField({ name: "s3_bucket", max: 200 }),
    new TextField({ name: "s3_region", max: 100 }),
    new TextField({ name: "s3_endpoint", max: 500 }),
    new TextField({ name: "s3_access_key", max: 500 }),
    new TextField({ name: "s3_secret_key", max: 500 }),
    new BoolField({ name: "s3_force_path_style" }),
  ]);

  // -------------------------------------------------------------------------
  // 8. users: add last_tenant + name (name is also added by the OIDC migration)
  // -------------------------------------------------------------------------
  let usersChanged = false;
  if (!usersCol.fields.getByName("last_tenant")) {
    usersCol.fields.add(new TextField({ name: "last_tenant", max: 100 }));
    usersChanged = true;
  }
  if (!usersCol.fields.getByName("name")) {
    usersCol.fields.add(new TextField({ name: "name", max: 200 }));
    usersChanged = true;
  }
  if (usersChanged) app.save(usersCol);
}, (app) => {
  // Rollback is best-effort; we do not drop collections to avoid data loss.
});
