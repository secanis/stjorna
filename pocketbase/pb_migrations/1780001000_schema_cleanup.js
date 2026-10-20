/// <reference path="../pb_data/types.d.ts" />

// T-22: schema cleanup.
//
// 1. tenants.users (relation, max 99) is dropped. Tenant membership lives
//    in user_tenants (user, tenant, role); nothing reads or writes the
//    relation (the backup export already stripped it).
//
// 2. media.s3_key / s3_url / thumbnail_url / usage_count are dropped.
//    PocketBase owns file storage (local or S3, configured in PB settings)
//    and generates thumbs on demand (?thumb=WxH); these columns were
//    v0.22-era leftovers that nothing populated. `filename` stays: it is
//    the user-editable display name (MediaEdit, backup import key, stats).
//
// 3. api_keys.tenant becomes a single relation to tenants (was text).
//    PB v0.40 identifies fields by id, so a remove+add with the same name
//    would drop the data. Instead: add `tenant_rel`, copy every value
//    whose tenant still exists, drop the old text column, rename
//    `tenant_rel` → `tenant`. Rows pointing at a tenant that no longer
//    exists are kept but revoked (tenant left empty; /exchange refuses
//    them with "api_keys row missing tenant"). cascadeDelete: deleting a
//    tenant deletes its key rows. `record.get('tenant')` on a single
//    relation returns the id string, so pb_hooks/api_keys.pb.js keeps
//    working unchanged.
//
// 4. categories.slug / products.slug get a pattern matching what the UI
//    generates (frontend/src/utils/slug.ts): lowercase a-z0-9 words
//    separated by single dashes. The UNIQUE(tenant, slug) indexes were
//    created as raw SQL by 1770001000 (best effort — they silently did
//    not exist if duplicates were present). They are now part of the
//    collection definition. Before that, existing rows are normalised:
//    already-valid unique slugs are kept; the rest are slugified (empty →
//    name → record id) and de-duplicated per tenant by appending
//    "-<record id>", so neither the pattern nor the index can make the
//    migration (or a later edit of an old row) fail.
//
// 5. instance_settings: drop the copies of PocketBase settings —
//    instance_name / instance_url (PB meta.appName / meta.appURL) and
//    storage_type / s3_bucket / s3_region / s3_endpoint /
//    s3_force_path_style (PB s3 settings). They were written by the
//    setup wizard but never read. A non-default instance_name is copied
//    into meta.appName if PB still has its default ("Acme").
//    The oidc_* provider fields (client id, URLs, scopes, display name)
//    still duplicate users.oauth2 but stay for now: the OIDC settings
//    page and the public /api/stjorna/oidc-config route read them.

const SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
const SLUG_MAX = 200;

const MEDIA_DROP = ["s3_key", "s3_url", "thumbnail_url", "usage_count"];
const SETTINGS_DROP = [
  "instance_name",
  "instance_url",
  "storage_type",
  "s3_bucket",
  "s3_region",
  "s3_endpoint",
  "s3_force_path_style",
];

function slugify(s) {
  // Same algorithm as frontend/src/utils/slug.ts.
  let v = String(s || "").toLowerCase().trim();
  try { v = v.normalize("NFKD"); } catch (_) {}
  return v
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dropFields(app, colName, names) {
  let col;
  try { col = app.findCollectionByNameOrId(colName); } catch (_) { return; }
  let changed = false;
  for (const n of names) {
    if (!col.fields.getByName(n)) continue;
    col.fields.removeByName(n);
    changed = true;
  }
  if (changed) app.save(col);
}

function normaliseSlugs(app, colName) {
  const rows = app.findRecordsByFilter(colName, "", "created,id", 0, 0);
  const seen = {}; // tenant -> { slug: true }
  const re = new RegExp(SLUG_PATTERN);
  // Pass 1: rows whose slug is already valid keep it (stable URLs).
  const todo = [];
  for (const r of rows) {
    const tenant = String(r.get("tenant") || "");
    const current = String(r.get("slug") || "");
    const bucket = seen[tenant] || (seen[tenant] = {});
    if (current.length <= SLUG_MAX && re.test(current) && !bucket[current]) {
      bucket[current] = true;
    } else {
      todo.push(r);
    }
  }
  // Pass 2: normalise the rest, suffixing "-<id>" on collision.
  let fixed = 0;
  for (const r of todo) {
    const tenant = String(r.get("tenant") || "");
    const current = String(r.get("slug") || "");
    let slug = slugify(current) || slugify(r.get("name")) || r.id.toLowerCase();
    const bucket = seen[tenant];
    if (bucket[slug]) {
      const suffix = "-" + r.id.toLowerCase();
      slug = slug.slice(0, SLUG_MAX - suffix.length).replace(/-+$/, "") + suffix;
      let n = 2;
      while (bucket[slug]) {
        slug = slug.slice(0, SLUG_MAX - 4) + "-" + n++;
      }
    } else if (slug.length > SLUG_MAX) {
      slug = slug.slice(0, SLUG_MAX).replace(/-+$/, "");
    }
    bucket[slug] = true;
    if (slug !== current) {
      // Raw UPDATE: no hooks, no full-record validation of unrelated fields.
      app.db()
        .newQuery("UPDATE " + colName + " SET slug = {:s} WHERE id = {:id}")
        .bind({ s: slug, id: r.id })
        .execute();
      fixed++;
    }
  }
  if (fixed) console.log("[migration 1780001000] " + colName + ": normalised/deduplicated " + fixed + " slug(s)");
}

migrate((app) => {
  // ---- 1. tenants.users ----------------------------------------------------
  dropFields(app, "tenants", ["users"]);

  // ---- 2. media legacy storage columns -------------------------------------
  dropFields(app, "media", MEDIA_DROP);

  // ---- 3. api_keys.tenant: text → relation ---------------------------------
  const tenants = app.findCollectionByNameOrId("tenants");
  let ak = app.findCollectionByNameOrId("api_keys");
  const oldTenant = ak.fields.getByName("tenant");
  if (oldTenant && oldTenant.type() !== "relation") {
    if (!ak.fields.getByName("tenant_rel")) {
      ak.fields.add(new RelationField({
        name: "tenant_rel",
        collectionId: tenants.id,
        maxSelect: 1,
        cascadeDelete: true,
      }));
      app.save(ak);
    }
    app.db().newQuery(
      "UPDATE api_keys SET tenant_rel = tenant WHERE tenant IN (SELECT id FROM tenants)"
    ).execute();
    const orphans = app.db().newQuery(
      "UPDATE api_keys SET revoked = 1 WHERE tenant_rel = '' OR tenant_rel IS NULL"
    ).execute();
    try {
      const n = orphans.rowsAffected();
      if (n) console.log("[migration 1780001000] api_keys: revoked " + n + " key(s) of deleted tenants");
    } catch (_) {}

    ak = app.findCollectionByNameOrId("api_keys");
    ak.fields.removeByName("tenant");
    app.save(ak);

    ak = app.findCollectionByNameOrId("api_keys");
    ak.fields.getByName("tenant_rel").name = "tenant";
    ak.indexes = (ak.indexes || []).filter((s) => !/idx_api_keys_tenant\b/.test(s));
    ak.indexes.push("CREATE INDEX `idx_api_keys_tenant` ON `api_keys` (`tenant`)");
    app.save(ak);
  }

  // ---- 4. slug pattern + UNIQUE(tenant, slug) ------------------------------
  for (const name of ["categories", "products"]) {
    // The raw index from 1770001000 (if it exists) has the same name as
    // the managed one below; drop it so PB can create its own, and so the
    // row-by-row normalisation can't trip over it mid-way.
    app.db().newQuery("DROP INDEX IF EXISTS idx_" + name + "_tenant_slug").execute();
    normaliseSlugs(app, name);

    const col = app.findCollectionByNameOrId(name);
    const slug = col.fields.getByName("slug");
    slug.pattern = SLUG_PATTERN;
    slug.required = true;
    slug.max = SLUG_MAX;
    const idxName = "idx_" + name + "_tenant_slug";
    col.indexes = (col.indexes || []).filter((s) => s.indexOf(idxName) === -1);
    col.indexes.push("CREATE UNIQUE INDEX `" + idxName + "` ON `" + name + "` (`tenant`, `slug`)");
    app.save(col);
  }

  // ---- 5. instance_settings duplicates of PB settings ----------------------
  try {
    const rows = app.findRecordsByFilter("instance_settings", "", "", 1, 0);
    const name = rows.length ? String(rows[0].get("instance_name") || "").trim() : "";
    const settings = app.settings();
    if (name && (!settings.meta.appName || settings.meta.appName === "Acme")) {
      settings.meta.appName = name;
      app.save(settings);
    }
  } catch (e) {
    console.log("[migration 1780001000] appName sync skipped:", e && e.message ? e.message : e);
  }
  dropFields(app, "instance_settings", SETTINGS_DROP);
}, (app) => {
  // Rollback: re-add the dropped columns (empty), turn api_keys.tenant back
  // into text, remove the slug pattern + managed indexes (re-created as the
  // raw indexes 1770001000 made). Slug renames are not reverted.
  const addFields = (colName, fields) => {
    let col;
    try { col = app.findCollectionByNameOrId(colName); } catch (_) { return; }
    let changed = false;
    for (const f of fields) {
      if (col.fields.getByName(f.name)) continue;
      col.fields.add(f);
      changed = true;
    }
    if (changed) app.save(col);
  };

  const users = app.findCollectionByNameOrId("users");
  addFields("tenants", [
    new RelationField({ name: "users", collectionId: users.id, maxSelect: 99, cascadeDelete: false }),
  ]);
  addFields("media", [
    new TextField({ name: "s3_key", max: 500 }),
    new URLField({ name: "s3_url" }),
    new URLField({ name: "thumbnail_url" }),
    new NumberField({ name: "usage_count" }),
  ]);
  addFields("instance_settings", [
    new TextField({ name: "instance_name", max: 200 }),
    new TextField({ name: "instance_url", max: 500 }),
    new TextField({ name: "storage_type", max: 50 }),
    new TextField({ name: "s3_bucket", max: 200 }),
    new TextField({ name: "s3_region", max: 100 }),
    new TextField({ name: "s3_endpoint", max: 500 }),
    new BoolField({ name: "s3_force_path_style" }),
  ]);

  let ak = app.findCollectionByNameOrId("api_keys");
  const rel = ak.fields.getByName("tenant");
  if (rel && rel.type() === "relation") {
    ak.indexes = (ak.indexes || []).filter((s) => !/idx_api_keys_tenant\b/.test(s));
    ak.fields.add(new TextField({ name: "tenant_txt", max: 100 }));
    app.save(ak);
    app.db().newQuery("UPDATE api_keys SET tenant_txt = tenant").execute();
    ak = app.findCollectionByNameOrId("api_keys");
    ak.fields.removeByName("tenant");
    app.save(ak);
    ak = app.findCollectionByNameOrId("api_keys");
    const f = ak.fields.getByName("tenant_txt");
    f.name = "tenant";
    app.save(ak);
  }

  for (const name of ["categories", "products"]) {
    const col = app.findCollectionByNameOrId(name);
    const slug = col.fields.getByName("slug");
    if (slug) slug.pattern = "";
    const idxName = "idx_" + name + "_tenant_slug";
    col.indexes = (col.indexes || []).filter((s) => s.indexOf(idxName) === -1);
    app.save(col);
    try {
      app.db().newQuery(
        "CREATE UNIQUE INDEX IF NOT EXISTS " + idxName + " ON " + name + " (tenant, slug)"
      ).execute();
    } catch (_) {}
  }
});
