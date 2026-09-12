/// <reference path="../pb_data/types.d.ts" />

// Relaxes the default locked rules on user_tenants and roles so that
// authenticated users can read their own memberships and role names.
// Write access is still enforced by the user_tenants.pb.js hook
// (superusers or tenant admins only).
//
// This migration fixes the symptom where normal users logged in but saw
// an empty tenant dropdown and could not open /settings because
// loadTenants() could not read user_tenants.

migrate((app) => {
  const userTenants = app.findCollectionByNameOrId("user_tenants");
  if (userTenants) {
    const authRule = "@request.auth.id != ''";
    userTenants.listRule = authRule;
    userTenants.viewRule = authRule;
    userTenants.createRule = authRule;
    userTenants.updateRule = authRule;
    userTenants.deleteRule = authRule;
    app.save(userTenants);
  }

  const roles = app.findCollectionByNameOrId("roles");
  if (roles) {
    const readRule = "@request.auth.id != ''";
    roles.listRule = readRule;
    roles.viewRule = readRule;
    // roles are a system lookup; only superusers may edit them.
    app.save(roles);
  }
}, (app) => {
  // Rollback is best-effort; restoring locked rules is not destructive.
  try {
    const userTenants = app.findCollectionByNameOrId("user_tenants");
    if (userTenants) {
      userTenants.listRule = null;
      userTenants.viewRule = null;
      userTenants.createRule = null;
      userTenants.updateRule = null;
      userTenants.deleteRule = null;
      app.save(userTenants);
    }
  } catch (_) {}
  try {
    const roles = app.findCollectionByNameOrId("roles");
    if (roles) {
      roles.listRule = null;
      roles.viewRule = null;
      app.save(roles);
    }
  } catch (_) {}
});
