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
// IMPORTANT: PocketBase v0.40 loads *.pb.js files in a loader VM and then
// executes each handler in a separate executor VM. Top-level function
// declarations are NOT visible inside the handlers, so each handler body
// is built as a string and wrapped with `new Function("e", BODY)`.

var CHECK_ADMIN_FN =
  "function isTenantAdmin(e,tenantId){" +
    "if(!tenantId)return false;" +
    "if(e.hasSuperuserAuth())return true;" +
    "if(!e.auth)return false;" +
    "var userId=String(e.auth.id||'');" +
    "if(!userId)return false;" +
    "try{" +
      "var rows=$app.findRecordsByFilter('user_tenants','user={:u} && tenant={:t}','',0,0,{u:userId,t:tenantId});" +
      "for(var i=0;i<rows.length;i++){" +
        "var row=rows[i];if(!row)continue;" +
        "var roleId='';try{roleId=String(row.get('role')||'');}catch(_){}" +
        "if(!roleId)continue;" +
        "try{var role=$app.findRecordById('roles',roleId);if(role&&String(role.get('name')||'')==='admin')return true;}catch(_){}" +
      "}" +
    "}catch(_){}" +
    "return false;" +
  "}" +
  "function requireTenantAdmin(e,tenantId,msg){" +
    "if(isTenantAdmin(e,tenantId))return;" +
    "throw new Error(msg||'Only superusers or tenant admins can manage memberships');" +
  "}";

var REJECT_OIDC_SOURCE =
  // `source='oidc'` is reserved for the OIDC sync hook, which writes
  // through the model-save path ($app.save) and does not fire *Request
  // hooks. If an API caller (PB user JWT) tries to stamp that value
  // through the request path, reject — that's the T-03 bypass.
  // Superusers keep the escape hatch for backfill / disaster recovery.
  "var _src=String(e.record.get('source')||'');" +
  "if(_src==='oidc' && !e.hasSuperuserAuth()){" +
    "throw new Error(\"source='oidc' is reserved for OIDC sync and cannot be set via the API\");" +
  "}";

onRecordCreateRequest(
  new Function("e",
    CHECK_ADMIN_FN +
    REJECT_OIDC_SOURCE +
    "requireTenantAdmin(e,String(e.record.get('tenant')||''),'Only tenant admins can invite users to this tenant');" +
    "e.next();"
  ),
  "user_tenants"
);

onRecordUpdateRequest(
  new Function("e",
    CHECK_ADMIN_FN +
    REJECT_OIDC_SOURCE +
    // Block silent reassignment of a membership to a different user.
    // Reassigning is a delete + recreate flow so the audit trail is
    // explicit (created_by / deleted_by / reason etc. stay consistent).
    "var _newUser=String(e.record.get('user')||'');" +
    "var _oldUser='';" +
    "try{var _ou=$app.findRecordById('user_tenants',e.record.id);_oldUser=String(_ou.get('user')||'');}catch(_){}" +
    "if(_newUser && _newUser!==_oldUser){" +
      "throw new Error('Cannot reassign a user_tenants row to a different user; delete + recreate instead');" +
    "}" +
    // Tenant admins must hold the admin role on BOTH the old and new
    // tenant. Reassigning across tenants would otherwise let an admin
    // of Tenant A move a membership into Tenant B even though they have
    // no rights there.
    "var _newTenant=String(e.record.get('tenant')||'');" +
    "var _oldTenant='';" +
    "try{var _ot=$app.findRecordById('user_tenants',e.record.id);_oldTenant=String(_ot.get('tenant')||'');}catch(_){}" +
    "requireTenantAdmin(e,_oldTenant,'Only tenant admins can update memberships');" +
    "if(_newTenant && _newTenant!==_oldTenant){requireTenantAdmin(e,_newTenant,'Only tenant admins can move users to this tenant');}" +
    "e.next();"
  ),
  "user_tenants"
);

onRecordDeleteRequest(
  new Function("e",
    CHECK_ADMIN_FN +
    "requireTenantAdmin(e,String(e.record.get('tenant')||''),'Only tenant admins can remove users from this tenant');" +
    "e.next();"
  ),
  "user_tenants"
);

console.log("[stjorna-user_tenants] membership guard hooks loaded");
