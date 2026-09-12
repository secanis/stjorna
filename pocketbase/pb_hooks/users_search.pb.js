/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA user search for tenant admins.
//
// Endpoint: GET /api/stjorna/users/search?q=<email>
//
// Auth:
//   - superuser: any query
//   - tenant admin: any query (result is limited and will be linked to the
//     admin's tenant by the caller)
//
// Why a custom route? The `users` collection list rule is locked so regular
// users cannot enumerate accounts. Tenant admins still need to find existing
// users when adding them to a tenant.

console.log("[stjorna-users-search] loading");

var USERS_SEARCH_BODY = "" +
  "function _reply(status,obj){" +
      "var body=JSON.stringify(obj);" +
      "e.response.header().set('Content-Type','application/json; charset=utf-8');" +
      "e.response.header().set('Cache-Control','no-store');" +
      "e.string(status,body);" +
  "}" +
  "var _h=String(e.request.header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
  "if(!_h){_reply(401,{ok:false,error:{code:401,message:'missing bearer token'}});return;}" +
  "var _p={};try{_p=$security.parseUnverifiedJWT(_h)||{};}catch(_ea){_p={};}" +
  "var _isSuperuser=_p.type==='auth'&&_p.collectionId==='pbc_3142635823';" +
  "var _isUser=_p.type==='auth'&&_p.collectionId==='_pb_users_auth_';" +
  "if(!_isSuperuser&&!_isUser){_reply(401,{ok:false,error:{code:401,message:'unrecognized token type'}});return;}" +
  // Only superusers or tenant admins may search user accounts.
  "if(!_isSuperuser){" +
      "try{" +
          "var _uts=$app.findRecordsByFilter('user_tenants','user={:u}','',0,0,{u:_p.id});" +
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
      "var _rows=$app.findRecordsByFilter('users','email~{:q}','',10,0,{q:_q});" +
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

routerAdd("GET", "/api/stjorna/users/search", new Function("e", USERS_SEARCH_BODY));
console.log("[stjorna-users-search] registered GET /api/stjorna/users/search");
