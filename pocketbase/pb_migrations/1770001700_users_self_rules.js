/// <reference path="../pb_data/types.d.ts" />

// T-02 follow-up: `users` view/update rules.
//
// 1770001000 set users.updateRule to
//   "@request.auth.id = id || @request.auth.admin = true"
// `@request.auth.admin` is not a field on the users collection (that was
// the PB v0.22 admin model), so the second half is a dead condition.
// Superusers bypass rules anyway. It also left viewRule = null, so a
// signed-in user could not fetch their own record through the regular
// API (only through auth-refresh).
//
// Self-only view + update; list stays superuser-only (the tenant admin
// UI uses /api/stjorna/users/search, which scopes by tenant).

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (!users) return;
  users.listRule = null;
  users.viewRule = "@request.auth.id = id";
  users.createRule = null;
  users.updateRule = "@request.auth.id = id";
  users.deleteRule = null;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  if (!users) return;
  users.viewRule = null;
  users.updateRule = "@request.auth.id = id || @request.auth.admin = true";
  app.save(users);
});
