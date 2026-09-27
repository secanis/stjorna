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

console.log("[stjorna-users-search] loading");

var USERS_SEARCH_BODY = "" +
  "function _reply(status,obj){" +
      "var body=JSON.stringify(obj);" +
      "e.response.header().set('Content-Type','application/json; charset=utf-8');" +
      "e.response.header().set('Cache-Control','no-store');" +
      "e.string(status,body);" +
  "}" +
  "if(!e.auth){_reply(401,{ok:false,error:{code:401,message:'unauthorized'}});return;}" +
  "var _isSuperuser=!!e.hasSuperuserAuth();" +
  // Only superusers or tenant admins may search user accounts.
  "if(!_isSuperuser){" +
      "var _uid=String(e.auth.id||'');" +
      "if(!_uid){_reply(403,{ok:false,error:{code:403,message:'only tenant admins can search users'}});return;}" +
      "try{" +
          "var _uts=$app.findRecordsByFilter('user_tenants','user={:u}','',0,0,{u:_uid});" +
          "var _isAdmin=false;" +
          "for(var _i2=0;_i2<_uts.length;_i2++){" +
              "var _ut=_uts[_i2];if(!_ut)continue;" +
              "var _roleId=String(_ut.get('role')||'');if(!_roleId)continue;" +
              "try{var _role=$app.findRecordById('roles',_roleId);if(_role&&String(_role.get('name')||'')==='admin'){_isAdmin=true;break;}}catch(_){}" +
          "}" +
          "if(!_isAdmin){_reply(403,{ok:false,error:{code:403,message:'only tenant admins can search users'}});return;}" +
      "}catch(_){_reply(403,{ok:false,error:{code:403,message:'failed to verify admin status'}});return;}" +
  "}" +
  "var _q=String(e.request.url.query().get('q')||'').trim();" +
  "if(!_q){_reply(200,{ok:true,users:[]});return;}" +
  "var _users=[];" +
  "try{" +
      // Tenant admins: restrict to exact-email matches so they can't
      // enumerate by substring. Superusers keep the substring search
      // (useful for admin tooling).
      "var _filter=_isSuperuser?('email~{:q}'):('email={:q}');" +
      "var _rows=$app.findRecordsByFilter('users',_filter,'',10,0,{q:_q});" +
      "for(var _i=0;_i<_rows.length;_i++){" +
          "var _r=_rows[_i];" +
          "if(!_r)continue;" +
          "_users.push({" +
              "id:_r.id," +
              "email:String((function(){try{return _r.get('email')||'';}catch(_e){return '';}})())," +
              "name:String((function(){try{return _r.get('name')||'';}catch(_e){return '';}})())" +
          "});" +
      "}" +
  "}catch(_e2){" +
      "console.log('[stjorna-users-search] search failed: '+(_e2&&(_e2.message||_e2)));" +
  "}" +
  "_reply(200,{ok:true,users:_users});";

routerAdd("GET", "/api/stjorna/users/search", new Function("e", USERS_SEARCH_BODY), $apis.requireAuth());
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
var TENANT_MEMBERS_BODY = "" +
  "function _reply(status,obj){" +
      "e.response.header().set('Content-Type','application/json; charset=utf-8');" +
      "e.response.header().set('Cache-Control','no-store');" +
      "e.string(status,JSON.stringify(obj));" +
  "}" +
  "if(!e.auth){_reply(401,{ok:false,error:{code:401,message:'unauthorized'}});return;}" +
  "var _tid=String(e.request.pathValue('id')||'');" +
  "if(!_tid){_reply(400,{ok:false,error:{code:400,message:'tenant id required'}});return;}" +
  "var _deny=function(){_reply(403,{ok:false,error:{code:403,message:'only admins of this tenant can list its members'}});};" +
  "if(!e.hasSuperuserAuth()){" +
      "var _uid=String(e.auth.id||'');" +
      "if(!_uid){_deny();return;}" +
      "var _isAdmin=false;" +
      "try{" +
          "var _mine=$app.findRecordsByFilter('user_tenants','user={:u} && tenant={:t}','',0,0,{u:_uid,t:_tid});" +
          "for(var _i=0;_i<_mine.length;_i++){" +
              "var _rid=String(_mine[_i].get('role')||'');if(!_rid)continue;" +
              "try{var _role=$app.findRecordById('roles',_rid);if(_role&&String(_role.get('name')||'')==='admin'){_isAdmin=true;break;}}catch(_){}" +
          "}" +
      "}catch(_){}" +
      "if(!_isAdmin){_deny();return;}" +
  "}" +
  "var _members=[];" +
  "try{" +
      "var _rows=$app.findRecordsByFilter('user_tenants','tenant={:t}','',0,0,{t:_tid});" +
      "var _seen={};" +
      "for(var _j=0;_j<_rows.length;_j++){" +
          "var _mu=String(_rows[_j].get('user')||'');" +
          "if(!_mu||_seen[_mu])continue;_seen[_mu]=true;" +
          "try{" +
              "var _u=$app.findRecordById('users',_mu);" +
              "_members.push({id:_u.id,name:String(_u.get('name')||''),email:String(_u.get('email')||'')});" +
          "}catch(_){}" +
      "}" +
  "}catch(_e){" +
      "console.log('[stjorna-users-search] members lookup failed: '+(_e&&(_e.message||_e)));" +
      "_reply(500,{ok:false,error:{code:500,message:'members lookup failed'}});return;" +
  "}" +
  "_reply(200,{ok:true,members:_members});";

routerAdd("GET", "/api/stjorna/tenants/{id}/members", new Function("e", TENANT_MEMBERS_BODY), $apis.requireAuth());
console.log("[stjorna-users-search] registered GET /api/stjorna/tenants/{id}/members");
