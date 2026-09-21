/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA superuser helpers.
//
// - Default new `_superusers` records to active=true.
// - Block password login and token refresh for disabled superusers.
//
// OAuth2 is not supported for `_superusers` in PocketBase v0.40, so only
// password auth and refresh need to be guarded.
//
// The auth routes for `_superusers` do not fire the normal record-auth
// hooks, so we use a `routerUse` middleware to inspect those paths.
// Per-request handler bodies are inlined as strings because top-level
// helpers are not visible across the loader/executor VM boundary.

console.log("[stjorna-superusers] loading");

onRecordCreateRequest((e) => {
  try {
    var active = e.record.get("active");
    if (active === null || active === undefined || active === "") {
      e.record.set("active", true);
    }
  } catch (_) {
    e.record.set("active", true);
  }
  e.next();
}, "_superusers");

// `onRecordCreateRequest` only fires for API-driven record creates. The
// `pocketbase superuser upsert` CLI (used by entrypoint.sh's bootstrap
// path) and direct `$app.save()` from JSVM hooks bypass the API layer,
// so the above handler never sees those paths. Without this fallback a
// newly-inserted `_superusers` row can carry the schema's BoolField
// default (`active=false`) and the auth guard below then rejects the
// login with "Superuser account is disabled".
//
// `onRecordCreateExecute` fires for every record create — API, CLI,
// `$app.save()`, batch — right before the INSERT, so modifying `e.record`
// here gets persisted atomically with the row. PB docs explicitly call
// this out: "Modifications BEFORE the e.next() execute before the INSERT
// DB statement."
onRecordCreateExecute((e) => {
  try {
    if (e.record.get("active") !== true && e.record.get("active") !== 1) {
      e.record.set("active", true);
    }
  } catch (_) {}
  e.next();
}, "_superusers");

onRecordUpdateRequest((e) => {
  try {
    var active = e.record.get("active");
    if (active === null || active === undefined || active === "") {
      var old = $app.findRecordById("_superusers", e.record.id);
      e.record.set("active", old.get("active"));
    }
  } catch (_) {}
  e.next();
}, "_superusers");

var AUTH_GUARD_BODY = "" +
  "var _path=String(e.request.url.path||'');" +
  // Password login: read identity from the parsed request body.
  "if(_path==='/api/collections/_superusers/auth-with-password'||_path==='/api/admins/auth-with-password'){" +
      "try{" +
          "var _info=e.requestInfo();" +
          "var _identity=String(_info.body.identity||_info.data.identity||'');" +
          "if(_identity){" +
              "var _recs=$app.findRecordsByFilter('_superusers','email={:em}','',1,0,{em:_identity});" +
              "var _rec=_recs&&_recs.length>0?_recs[0]:null;" +
              "if(_rec){" +
                  "var _active=_rec.get('active');" +
                  "if(_active===false||_active==='false'||_active===0||_active==='0'){" +
                      "e.response.header().set('Content-Type','application/json; charset=utf-8');" +
                      "e.string(403,JSON.stringify({message:'Superuser account is disabled'}));" +
                      "return;" +
                  "}" +
              "}" +
          "}" +
      "}catch(_){}" +
  "}" +
  // Refresh: read id from the current token.
  "if(_path==='/api/collections/_superusers/auth-refresh'||_path==='/api/admins/auth-refresh'){" +
      "try{" +
          "var _h=String(e.request.header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
          "if(_h){" +
              "var _p=$security.parseUnverifiedJWT(_h)||{};" +
              "if(_p.type==='auth'&&_p.collectionId==='pbc_3142635823'&&_p.id){" +
                  "var _rec2=$app.findRecordById('_superusers',_p.id);" +
                  "var _active2=_rec2.get('active');" +
                  "if(_active2===false||_active2==='false'||_active2===0||_active2==='0'){" +
                      "e.response.header().set('Content-Type','application/json; charset=utf-8');" +
                      "e.string(403,JSON.stringify({message:'Superuser account is disabled'}));" +
                      "return;" +
                  "}" +
              "}" +
          "}" +
      "}catch(_){}" +
  "}" +
  "return e.next();";

routerUse(new Function("e", AUTH_GUARD_BODY));

console.log("[stjorna-superusers] hooks loaded");
