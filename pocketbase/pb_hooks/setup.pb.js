/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA — first-run setup helpers.
//
// Two custom routes that let the frontend /setup wizard create the very
// first PocketBase superuser without anyone having to touch `kubectl exec`
// or the PB installer URL:
//
//   GET  /api/stjorna/setup-status
//        → { superuserExists: <bool>, setupDone: <bool> }
//   POST /api/stjorna/setup-bootstrap-superuser
//        body: { email, password, passwordConfirm }
//        → { ok: true, id: <superuser-id> }
//
// Security model:
//   - Both routes are UNAUTHENTICATED on purpose — there's no admin yet.
//   - The bootstrap route refuses (HTTP 409) once any _superusers record
//     exists, so it cannot be used to mint additional superusers.
//   - Password minimum length is enforced server-side (10 chars).
//   - The route is registered in the `setup_status_body` /
//     `setup_bootstrap_body` form via `new Function("e", BODY)` to dodge
//     the loader/executor VM split documented in pocketbase-jsvm-hooks.

console.log("[stjorna-setup] loading");

var SETUP_JSON_REPLY =
    "function _reply(status,obj){" +
        "e.response.header().set('Content-Type','application/json; charset=utf-8');" +
        "e.string(status,JSON.stringify(obj));" +
    "}";

var SETUP_READ_BODY =
    "function _readBody(){" +
        "try{return readerToString(e.request.body,64*1024);}" +
        "catch(_e){return '';}" +
    "}";

// ---------------------------------------------------------------------------
// GET /api/stjorna/setup-status
// ---------------------------------------------------------------------------
var SETUP_STATUS_BODY =
    SETUP_JSON_REPLY +
    "var _exists=false;" +
    "try{" +
        "var _rows=$app.findRecordsByFilter('_superusers','','',0,0);" +
        "_exists=Array.isArray(_rows)&&_rows.length>0;" +
    "}catch(_e){}" +
    "var _done=false;" +
    "try{" +
        "var _settings=$app.findFirstRecordByFilter('instance_settings','setup_done=true',null,0);" +
        "_done=!!_settings;" +
    "}catch(_e){}" +
    "_reply(200,{superuserExists:_exists,setupDone:_done});";

routerAdd("GET", "/api/stjorna/setup-status", new Function("e", SETUP_STATUS_BODY));
console.log("[stjorna-setup] registered GET /api/stjorna/setup-status");

// ---------------------------------------------------------------------------
// POST /api/stjorna/setup-bootstrap-superuser
// ---------------------------------------------------------------------------
var SETUP_BOOTSTRAP_BODY =
    SETUP_JSON_REPLY +
    SETUP_READ_BODY +
    "var _raw='';" +
    "try{_raw=_readBody();}catch(_rb){_reply(400,{ok:false,error:{code:400,message:'could not read body'}});return;}" +
    "var _body=null;" +
    "try{_body=JSON.parse(_raw||'{}');}catch(_jp){_reply(400,{ok:false,error:{code:400,message:'invalid JSON body'}});return;}" +
    "var _email=String((_body&&_body.email)||'').trim().toLowerCase();" +
    "var _pw=String((_body&&_body.password)||'');" +
    "var _pwC=String((_body&&_body.passwordConfirm)||'');" +
    "if(!_email||_email.indexOf('@')<1){_reply(400,{ok:false,error:{code:400,message:'email is required'}});return;}" +
    "if(!_pw||_pw.length<10){_reply(400,{ok:false,error:{code:400,message:'password must be at least 10 characters'}});return;}" +
    "if(_pw!==_pwC){_reply(400,{ok:false,error:{code:400,message:'password and confirmation do not match'}});return;}" +
    // Refuse if a superuser already exists. This gate is the whole point of
    // the endpoint — it cannot be used to mint additional superusers once
    // the instance has been bootstrapped.
    "var _existing=null;" +
    "try{_existing=$app.findRecordsByFilter('_superusers','','',0,0);}catch(_ef){}" +
    "if(Array.isArray(_existing)&&_existing.length>0){" +
        "_reply(409,{ok:false,error:{code:409,message:'superuser already exists; use the admin login instead'}});" +
        "return;" +
    "}" +
    "try{" +
        "var _col=$app.findCollectionByNameOrId('_superusers');" +
        "if(!_col){_reply(500,{ok:false,error:{code:500,message:'_superusers collection not found'}});return;}" +
        "var _rec=new Record(_col);" +
        // PB auth-collection typed setters: hashing goes through PB's own
        // path so the stored hash matches what auth-with-password expects.
        "_rec.setEmail(_email);" +
        "_rec.setPassword(_pw);" +
        "_rec.setVerified(true);" +
        // The superusers.pb.js hook defaults missing `active` to true, but
        // we set it explicitly so the bootstrap result is obvious in the DB.
        "try{_rec.set('active',true);}catch(_ea){}" +
        "$app.save(_rec);" +
        "_reply(200,{ok:true,id:String(_rec.id||''),email:_email});" +
    "}catch(_es){" +
        "console.log('[stjorna-setup] bootstrap save failed: '+(_es&&_es.message));" +
        "_reply(500,{ok:false,error:{code:500,message:'could not create superuser: '+(_es&&_es.message||'unknown error')}});" +
        "return;" +
    "}";

routerAdd("POST", "/api/stjorna/setup-bootstrap-superuser", new Function("e", SETUP_BOOTSTRAP_BODY));
console.log("[stjorna-setup] registered POST /api/stjorna/setup-bootstrap-superuser");

console.log("[stjorna-setup] hooks loaded");
