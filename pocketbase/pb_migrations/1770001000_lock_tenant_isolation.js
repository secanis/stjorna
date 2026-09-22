/// <reference path="../pb_data/types.d.ts" />

// T-02: lock down tenant isolation + disable public sign-up.
//
// Before this migration:
//   - users.createRule = "" (PB default) → anyone could sign up via the
//     users collection API, then read/write/delete every tenant's data
//     (because the tenant collections only required @request.auth.id != "")
//   - tenants.listRule = "" → anonymous enumeration of every tenant
//     (name, slug, custom_domain, theme_config, users id list)
//   - tenants.viewRule = '@request.auth.id != ""' → any logged-in user
//     could view every tenant's metadata
//   - media/categories/products/user_tenants rules all =
//     '@request.auth.id != ""' → any logged-in user could read, modify,
//     re-home or delete every tenant's data; tenant isolation existed
//     only as a UI filter
//   - API-key service users (T-05) inherited the same cross-tenant access
//   - The indexes that the frontend depends on for tenant-scoped reads
//     (`tenant = "…"`) didn't exist; the FE filter went through a table scan
//
// After:
//   - users.createRule = null  → no anonymous sign-up (OIDC/invite/admin only)
//   - tenants.listRule/viewRule = tenant-member (via id-ref since the
//     tenants collection has no `tenant` field of its own)
//   - media/categories/products rules = tenant-member for reads;
//     editor-or-admin role for create/update; admin-only for delete;
//     create also validates that body.tenant matches one of the caller's
//     editor/admin tenants; update forbids changing the tenant field
//   - user_tenants writes locked to admin-only (the existing hook stays
//     as defense-in-depth)
//   - INDEX on each `tenant` FK column for tenant-scoping queries
//   - UNIQUE(tenant, slug) on categories + products
//   - UNIQUE(user, tenant) on user_tenants
//
// Public storefront: rows stay private by default. Public read access for
// the storefront is provided by API keys (T-05). This keeps the security
// model simple — there is no anonymous path into the data.
//
// Rule expression notes:
//   - `@collection.user_tenants.user ?= @request.auth.id` is an EXISTS
//     subquery on the user_tenants collection correlated to the current
//     record (here: via the matching tenant FK).
//   - The right-hand operand after `?=` may be a literal, an auth field
//     (@request.auth.X) or a field of the current record. For tenants
//     (which has no `tenant` field of its own) the right-hand side is
//     `id`, the record's primary key.
//   - Role checks use the relation ID with `?=` (NOT the deep-joined
//     `.name`). Plain `=` always evaluates to false on relation-to-
//     text comparisons in PB v0.40 (verified empirically: the
//     `user_tenants.role = '<id>'` form returns 400 for every legitimate
//     match, while `user_tenants.role ?= '<id>'` works as expected).
//     `?~`/`~` (regex) on deep-joined `.name` is unsupported in v0.40.
//     Two role IDs (admin + editor) are ORed together.
//   - Multiple `@collection.<col>.<field>` checks within one rule are
//     correlated to the SAME row of <col>; PB rewrites them as a single
//     subquery with all the predicates ANDed.

migrate((app) => {
  // -------------------------------------------------------------------------
  // Look up the admin / editor role IDs at migration time so the rules
  // can pin them with literal equality (PB does not support regex on
  // deep-joined fields; see header note).
  // -------------------------------------------------------------------------
  const roleByName = {};
  try {
    const roleRows = app.findRecordsByFilter("roles", "", "", 0, 0);
    for (const r of roleRows) {
      const n = String(r.get("name") || "");
      if (n) roleByName[n] = r.id;
    }
  } catch (e) {
    console.log("[migration 1770001000] role lookup failed:", e && e.message);
  }
  const adminRoleId = roleByName["admin"] || "";
  const editorRoleId = roleByName["editor"] || "";
  const writerRoleIds = [adminRoleId, editorRoleId].filter(Boolean);
  // PB v0.40's `?=` ("equals or fallback") is the operator that matches a
  // relation field against a literal inside an EXISTS subquery; plain `=`
  // always evaluates to false on relation-to-text comparisons, so use `?=`
  // here even though it reads as "weird" for a string equality check.
  const writerRoleOr = writerRoleIds.length === 0
    ? "false"
    : "(" + writerRoleIds.map((id) => "@collection.user_tenants.role ?= '" + id + "'").join(" || ") + ")";

  // -------------------------------------------------------------------------
  // Shared rule fragments
  // -------------------------------------------------------------------------
  // media/categories/products: caller is a member of the record's tenant.
  const MEMBER_OF_TENANT =
    "@request.auth.id != '' && " +
    "@collection.user_tenants.user ?= @request.auth.id && " +
    "@collection.user_tenants.tenant ?= tenant";

  // media/categories/products: caller is editor or admin of the record's
  // tenant. The role check is an OR of literal role record IDs.
  const EDITOR_OR_ADMIN_OF_TENANT =
    "@request.auth.id != '' && " +
    "@collection.user_tenants.user ?= @request.auth.id && " +
    "@collection.user_tenants.tenant ?= tenant && " +
    writerRoleOr;

  // media/categories/products: caller is admin of the record's tenant.
  const ADMIN_ONLY_OF_TENANT = adminRoleId
    ? "@request.auth.id != '' && " +
      "@collection.user_tenants.user ?= @request.auth.id && " +
      "@collection.user_tenants.tenant ?= tenant && " +
      "@collection.user_tenants.role ?= '" + adminRoleId + "'"
    : "@request.auth.id != '' && @request.auth.admin = true";

  // media/categories/products CREATE: body.tenant must match one of the
  // caller's editor/admin tenants. PB treats @request.body.<relation> as
  // the relation id string.
  const EDITOR_OR_ADMIN_OF_BODY_TENANT =
    "@request.auth.id != '' && " +
    "@collection.user_tenants.user ?= @request.auth.id && " +
    "@collection.user_tenants.tenant ?= @request.body.tenant && " +
    writerRoleOr;

  // media/categories/products UPDATE: forbid changing tenant. The
  // `:isset` half means "if the caller didn't try to set tenant in this
  // update, allow it"; otherwise the new value must equal the existing
  // one.
  const NO_TENANT_CHANGE =
    "(@request.body.tenant:isset = false || @request.body.tenant = tenant)";

  // tenants: caller is a member of THIS tenant (uses id, since tenants
  // has no tenant FK of its own).
  const MEMBER_OF_TENANT_BY_ID =
    "@request.auth.id != '' && " +
    "@collection.user_tenants.user ?= @request.auth.id && " +
    "@collection.user_tenants.tenant ?= id";

  // -------------------------------------------------------------------------
  // 1. users — disable public sign-up
  // -------------------------------------------------------------------------
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    users.listRule = null;
    users.viewRule = null;
    users.createRule = null; // no self-service sign-up
    users.updateRule = "@request.auth.id = id || @request.auth.admin = true";
    users.deleteRule = null;
    app.save(users);
  }

  // -------------------------------------------------------------------------
  // 2. tenants — list/view require tenant membership
  // -------------------------------------------------------------------------
  const tenants = app.findCollectionByNameOrId("tenants");
  if (tenants) {
    tenants.listRule = MEMBER_OF_TENANT_BY_ID;
    tenants.viewRule = MEMBER_OF_TENANT_BY_ID;
    // writes remain superuser-only (already null from 1740000000_…)
    app.save(tenants);
  }

  // -------------------------------------------------------------------------
  // 3. media, categories, products — tenant-scoped reads + role-gated writes
  // -------------------------------------------------------------------------
  for (const name of ["media", "categories", "products"]) {
    const col = app.findCollectionByNameOrId(name);
    if (!col) continue;
    col.listRule = MEMBER_OF_TENANT;
    col.viewRule = MEMBER_OF_TENANT;
    col.createRule = EDITOR_OR_ADMIN_OF_BODY_TENANT;
    col.updateRule = EDITOR_OR_ADMIN_OF_TENANT + " && " + NO_TENANT_CHANGE;
    col.deleteRule = ADMIN_ONLY_OF_TENANT;
    app.save(col);
  }

  // -------------------------------------------------------------------------
  // 4. user_tenants — own rows or admin-of-tenant for reads; admin-only writes
  // -------------------------------------------------------------------------
  const userTenants = app.findCollectionByNameOrId("user_tenants");
  if (userTenants) {
    // list/view: caller can see their own memberships OR any membership for
    // a tenant where the caller is admin.
    const listRule = adminRoleId
      ? "user = @request.auth.id || (" +
        "@collection.user_tenants.user ?= @request.auth.id && " +
        "@collection.user_tenants.tenant ?= tenant && " +
        "@collection.user_tenants.role ?= '" + adminRoleId + "')"
      : "user = @request.auth.id";
    userTenants.listRule = listRule;
    userTenants.viewRule = listRule;
    // writes: admin-only (the user_tenants.pb.js hook already enforces
    // this; the rule adds defence-in-depth + better error messages).
    userTenants.createRule = ADMIN_ONLY_OF_TENANT;
    userTenants.updateRule = ADMIN_ONLY_OF_TENANT;
    userTenants.deleteRule = ADMIN_ONLY_OF_TENANT;
    app.save(userTenants);
  }

  // -------------------------------------------------------------------------
  // 5. roles — list/view require auth (writes stay superuser-only)
  // -------------------------------------------------------------------------
  const roles = app.findCollectionByNameOrId("roles");
  if (roles) {
    roles.listRule = "@request.auth.id != ''";
    roles.viewRule = "@request.auth.id != ''";
    app.save(roles);
  }

  // -------------------------------------------------------------------------
  // 6. Indexes — raw SQL via app.db()
  // -------------------------------------------------------------------------
  const db = app.db();
  const idx = (sql) => {
    try {
      db.newQuery(sql).execute();
    } catch (e) {
      // Best-effort. PB may already have the index (idempotent restarts)
      // or the table may not exist yet.
      console.log("[migration 1770001000] index statement skipped:", sql, "—", e && e.message ? e.message : e);
    }
  };

  for (const name of ["media", "categories", "products"]) {
    idx(`CREATE INDEX IF NOT EXISTS idx_${name}_tenant ON ${name} (tenant);`);
  }
  idx(`CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON user_tenants (user);`);
  idx(`CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants (tenant);`);

  for (const name of ["categories", "products"]) {
    idx(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${name}_tenant_slug ON ${name} (tenant, slug);`);
  }
  idx(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_tenants_user_tenant ON user_tenants (user, tenant);`);
}, (app) => {
  // Rollback: best-effort restore of the previous rules. We don't drop
  // indexes — they'd just sit unused until recreated.
  const restore = (name, rules) => {
    const col = app.findCollectionByNameOrId(name);
    if (!col) return;
    Object.assign(col, rules);
    try { app.save(col); } catch (_) {}
  };

  restore("users", {
    listRule: "@request.auth.id != ''",
    viewRule: '@request.auth.id = id || @request.auth.tenant != ""',
    createRule: "",
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  });
  restore("tenants", {
    listRule: "",
    viewRule: '@request.auth.id != ""',
  });
  for (const name of ["media", "categories", "products"]) {
    restore(name, {
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    });
  }
  restore("user_tenants", {
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
});
