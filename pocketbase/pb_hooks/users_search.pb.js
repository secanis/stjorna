/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA user search for tenant admins.
//
// Endpoint: GET /api/stjorna/users/search?q=<email>
//
// Auth (T-01):
//   - requireAuth() middleware verifies the JWT signature and populates
//     e.auth. e.hasSuperuserAuth() decides superuser vs tenant user.
//   - superuser: any query (caller-side narrows to a tenant if needed).
//   - tenant admin: only when at least one of their user_tenants rows
//     has role.name === "admin". The q-match is exact-email only to
//     avoid leaking account enumeration.
//
// Why a custom route? The `users` collection list rule is locked so
// regular users cannot enumerate accounts. Tenant admins still need to
// find existing users when adding them to a tenant.

// Handlers live in pb_hooks/lib/users.js (require()d inside each handler).

console.log("[stjorna-users-search] loading");

routerAdd("GET", "/api/stjorna/users/search", (e) => {
    require(`${__hooks}/lib/users.js`).searchHandler(e);
}, $apis.requireAuth());
console.log("[stjorna-users-search] registered GET /api/stjorna/users/search");

// Tenant member directory for the Users page.
//
// Endpoint: GET /api/stjorna/tenants/{id}/members
//
// T-02 locked `users` list/view to superusers, so a tenant admin's
// user_tenants expand of `user` comes back empty and the Users table
// showed blank names/emails. This route returns ONLY id/name/email for
// members of ONE tenant, and only to:
//   - superusers, or
//   - callers holding the `admin` role in THAT tenant (admin elsewhere
//     is not enough).
// Everyone else gets 403 — the response never reveals whether the
// tenant exists.
routerAdd("GET", "/api/stjorna/tenants/{id}/members", (e) => {
    require(`${__hooks}/lib/users.js`).membersHandler(e);
}, $apis.requireAuth());
console.log("[stjorna-users-search] registered GET /api/stjorna/tenants/{id}/members");
