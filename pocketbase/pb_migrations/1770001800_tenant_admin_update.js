/// <reference path="../pb_data/types.d.ts" />

// Allow tenant admins to update their own tenant (name, slug, plan,
// custom_domain, theme_config). Until now every write on `tenants` was
// superuser-only, which forced superusers to do per-tenant tweaks (e.g.
// the theme config) they have no operational context for.
//
// createRule/deleteRule stay superuser-only: tenant lifecycle remains a
// superuser task. Superuser auth bypasses API rules entirely, so this
// rule only governs non-superuser callers.
//
// Rule mirrors the T-02 pattern (migration 1770001000): role checks pin
// the admin role record ID with `?=` inside the correlated EXISTS
// subquery; for `tenants` the correlation is the record's own `id`.

migrate((app) => {
  let adminRoleId = "";
  try {
    const roleRows = app.findRecordsByFilter("roles", "name='admin'", "", 1, 0);
    if (roleRows && roleRows.length > 0) adminRoleId = roleRows[0].id;
  } catch (e) {
    console.log("[migration 1770001800] admin role lookup failed:", e && e.message);
  }

  const tenants = app.findCollectionByNameOrId("tenants");
  if (!tenants) return;

  tenants.updateRule = adminRoleId
    ? "@request.auth.id != '' && " +
      "@collection.user_tenants.user ?= @request.auth.id && " +
      "@collection.user_tenants.tenant ?= id && " +
      "@collection.user_tenants.role ?= '" + adminRoleId + "'"
    : null; // no admin role → keep superuser-only rather than opening writes
  app.save(tenants);
}, (app) => {
  const tenants = app.findCollectionByNameOrId("tenants");
  if (!tenants) return;
  tenants.updateRule = null; // back to superuser-only
  try { app.save(tenants); } catch (_) {}
});
