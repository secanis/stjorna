/// <reference path="../pb_data/types.d.ts" />

// Enforces tenant-scoped membership management.
//
// - Superusers may create/update/delete any user_tenants row.
// - The OIDC group-sync hook may create rows with source = "oidc".
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

onRecordCreateRequest(
  new Function("e",
    CHECK_ADMIN_FN +
    "var source=String(e.record.get('source')||'');" +
    "if(source==='oidc')return e.next();" +
    "requireTenantAdmin(e,String(e.record.get('tenant')||''),'Only tenant admins can invite users to this tenant');" +
    "e.next();"
  ),
  "user_tenants"
);

onRecordUpdateRequest(
  new Function("e",
    CHECK_ADMIN_FN +
    "var source=String(e.record.get('source')||'');" +
    "if(source==='oidc')return e.next();" +
    "var newTenant=String(e.record.get('tenant')||'');" +
    "var oldTenant='';" +
    "try{var old=$app.findRecordById('user_tenants',e.record.id);oldTenant=String(old.get('tenant')||'');}catch(_){}" +
    "requireTenantAdmin(e,oldTenant,'Only tenant admins can update memberships');" +
    "if(newTenant&&newTenant!==oldTenant){requireTenantAdmin(e,newTenant,'Only tenant admins can move users to this tenant');}" +
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
