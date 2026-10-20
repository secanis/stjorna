/// <reference path="../pb_data/types.d.ts" />

// Enforces tenant-scoped membership management.
//
// - Superusers may create/update/delete any user_tenants row.
// - The OIDC group-sync hook writes rows with source = "oidc" via
//   `$app.save(record)`, which uses the model-save path and bypasses
//   every `*Request` hook in this chain. The OIDC sync therefore does
//   NOT need any bypass here — and historically a `if(source==='oidc')
//   return e.next()` bypass on create + update was dead code that API
//   callers could use to skip the admin check entirely (T-03).
// - Authenticated tenant admins may manage memberships for tenants where
//   they have the "admin" role.
// - Everyone else is rejected.
//
// The collection API rules are intentionally broad so that authenticated
// users can list their own memberships; this hook guards the writes.
//
// The tenant-admin check lives in pb_hooks/lib/http.js and is require()d
// inside each handler (handlers run in a separate VM from this file).

onRecordCreateRequest((e) => {
  var http = require(`${__hooks}/lib/http.js`);
  // `source='oidc'` is reserved for the OIDC sync hook, which writes via
  // $app.save (no *Request hooks). API callers may not stamp it (T-03);
  // superusers keep the escape hatch for backfill / disaster recovery.
  if (String(e.record.get("source") || "") === "oidc" && !e.hasSuperuserAuth()) {
    throw new Error("source='oidc' is reserved for OIDC sync and cannot be set via the API");
  }
  if (!http.isTenantAdmin(e, String(e.record.get("tenant") || ""))) {
    throw new Error("Only tenant admins can invite users to this tenant");
  }
  e.next();
}, "user_tenants");

onRecordUpdateRequest((e) => {
  var http = require(`${__hooks}/lib/http.js`);
  if (String(e.record.get("source") || "") === "oidc" && !e.hasSuperuserAuth()) {
    throw new Error("source='oidc' is reserved for OIDC sync and cannot be set via the API");
  }
  var old = null;
  try { old = $app.findRecordById("user_tenants", e.record.id); } catch (_) {}
  var oldUser = "";
  var oldTenant = "";
  try { oldUser = String(old.get("user") || ""); } catch (_) {}
  try { oldTenant = String(old.get("tenant") || ""); } catch (_) {}
  // Reassigning a membership to another user is delete + recreate, so the
  // audit trail stays explicit.
  var newUser = String(e.record.get("user") || "");
  if (newUser && newUser !== oldUser) {
    throw new Error("Cannot reassign a user_tenants row to a different user; delete + recreate instead");
  }
  // Tenant admins must hold the admin role on BOTH the old and new tenant.
  if (!http.isTenantAdmin(e, oldTenant)) {
    throw new Error("Only tenant admins can update memberships");
  }
  var newTenant = String(e.record.get("tenant") || "");
  if (newTenant && newTenant !== oldTenant && !http.isTenantAdmin(e, newTenant)) {
    throw new Error("Only tenant admins can move users to this tenant");
  }
  e.next();
}, "user_tenants");

onRecordDeleteRequest((e) => {
  var http = require(`${__hooks}/lib/http.js`);
  if (!http.isTenantAdmin(e, String(e.record.get("tenant") || ""))) {
    throw new Error("Only tenant admins can remove users from this tenant");
  }
  e.next();
}, "user_tenants");

console.log("[stjorna-user_tenants] membership guard hooks loaded");
