/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA — first-run setup helpers.
//
// Two custom routes that let the frontend /setup wizard create the very
// first PocketBase superuser without anyone having to touch `kubectl exec`
// or the PB installer URL:
//
//   GET  /api/stjorna/setup-status
//        → { superuserExists: <bool>, setupDone: <bool>,
//            setupTokenRequired: true, setupTokenSource: "env" | "log" }
//   POST /api/stjorna/setup-bootstrap-superuser
//        header: X-Stjorna-Setup-Token: <token>
//        body:   { email, password, passwordConfirm }
//        → { ok: true, id: <superuser-id>, email }
//
// Security model (T-04):
//   - The status route is UNAUTHENTICATED on purpose — there's no admin
//     yet, and it only reveals two booleans.
//   - The bootstrap route requires a one-time SETUP TOKEN in the
//     `X-Stjorna-Setup-Token` header. The token comes from the
//     `STJORNA_SETUP_TOKEN` env var; when that is unset (or too short) a
//     random token is generated at boot and printed to the server log —
//     the same trust model as PB's own installer URL or Jenkins'
//     initialAdminPassword: whoever can read the container log / env is
//     the operator. The comparison is constant-time ($security.equal).
//   - The bootstrap route refuses (HTTP 409) once `instance_settings.
//     setup_done = true`, even if `_superusers` is empty. The wizard can
//     never be re-run to re-seed an admin on an already configured
//     instance; use the `pocketbase superuser upsert` CLI for recovery.
//   - The bootstrap route refuses (HTTP 409) once any real `_superusers`
//     record exists, so it cannot be used to mint additional superusers.
//   - The existence check and the INSERT run inside
//     `$app.runInTransaction`, so two concurrent bootstrap requests
//     cannot both succeed (PB serialises write transactions on its
//     non-concurrent DB connection).
//   - Password minimum length is enforced server-side (10 chars).
//   - Handler bodies are built as strings and registered via
//     `new Function("e", BODY)` to dodge the loader/executor VM split
//     documented in pocketbase-jsvm-hooks. Load-time values (the setup
//     token, the placeholder email) are baked into the body as literals.

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

// PocketBase v0.40 seeds a placeholder record into `_superusers` on every
// fresh data directory so the dashboard installer UI can authenticate
// during the bootstrap flow. The placeholder has email
// "__pbinstaller@example.com" and an invalid password hash — it cannot
// actually be used to log in. We must NOT count it as a real admin or
// the bootstrap endpoint will refuse (HTTP 409) on every fresh install.
// PB also deletes the placeholder itself once the user finishes the
// installer UI flow, but since the wizard bypasses the installer we just
// filter it out everywhere.
var PB_INSTALLER_PLACEHOLDER_EMAIL = "__pbinstaller@example.com";

// Shared snippet: `_realSuperuserExists(app)` → bool. Runs against the
// passed app (either $app or the transaction app).
var SETUP_SUPERUSER_EXISTS_FN =
    "function _realSuperuserExists(_app){" +
        "var _ph=" + JSON.stringify(PB_INSTALLER_PLACEHOLDER_EMAIL) + ";" +
        "var _rows=_app.findRecordsByFilter('_superusers','email!={:ph}','',0,0,{ph:_ph});" +
        "return Array.isArray(_rows)&&_rows.length>0;" +
    "}";

// Shared snippet: `_setupDone()` → bool. `instance_settings` may not exist
// yet on a fresh install (user migrations run at serve time), so every
// failure counts as "not done".
var SETUP_DONE_FN =
    "function _setupDone(){" +
        "try{" +
            "var _s=$app.findFirstRecordByFilter('instance_settings','setup_done=true');" +
            "return !!_s;" +
        "}catch(_e){return false;}" +
    "}";

// ---------------------------------------------------------------------------
// Setup token (resolved once at load time, baked into the handler body)
// ---------------------------------------------------------------------------
var SETUP_TOKEN_MIN_LENGTH = 16;
var SETUP_TOKEN = "";
var SETUP_TOKEN_SOURCE = "env";
try {
    SETUP_TOKEN = String($os.getenv("STJORNA_SETUP_TOKEN") || "").trim();
} catch (_e) {
    SETUP_TOKEN = "";
}
if (SETUP_TOKEN && SETUP_TOKEN.length < SETUP_TOKEN_MIN_LENGTH) {
    console.log(
        "[stjorna-setup] WARNING: STJORNA_SETUP_TOKEN is shorter than " +
        SETUP_TOKEN_MIN_LENGTH + " characters and will be IGNORED; a random token is generated instead"
    );
    SETUP_TOKEN = "";
}
if (!SETUP_TOKEN) {
    SETUP_TOKEN = $security.randomString(40);
    SETUP_TOKEN_SOURCE = "log";
}

// Print the generated token only while it is actually useful, i.e. no real
// superuser exists yet. On an established instance the banner would just
// be noise (the route 409s anyway).
//
// The lookup cannot run at load time: hook files are evaluated before the
// app has finished bootstrapping and any `$app` DB call panics with a nil
// pointer (verified against PB v0.40.4). `onBootstrap` fires right after
// hooks are loaded; after `e.next()` the DB is initialised and the system
// `_superusers` collection exists. (`onServe` is NOT usable from a hook
// file in this PB version — registration fails at load.)
if (SETUP_TOKEN_SOURCE === "log") {
    var SETUP_BANNER_BODY =
        "e.next();" +
        SETUP_SUPERUSER_EXISTS_FN +
        "var _print=true;" +
        "try{if(_realSuperuserExists($app)){_print=false;}}catch(_e){}" +
        "if(!_print){return;}" +
        "var _tok=" + JSON.stringify(SETUP_TOKEN) + ";" +
        "console.log('[stjorna-setup] ==============================================================');" +
        "console.log('[stjorna-setup] No superuser exists yet. To create the first one, open the');" +
        "console.log('[stjorna-setup] /setup wizard and enter this one-time setup token:');" +
        "console.log('[stjorna-setup]');" +
        "console.log('[stjorna-setup]     STJORNA_SETUP_TOKEN='+_tok);" +
        "console.log('[stjorna-setup]');" +
        "console.log('[stjorna-setup] (set the STJORNA_SETUP_TOKEN env var to choose your own, or set');" +
        "console.log('[stjorna-setup]  PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD to skip the wizard)');" +
        "console.log('[stjorna-setup] ==============================================================');";
    onBootstrap(new Function("e", SETUP_BANNER_BODY));
}

// ---------------------------------------------------------------------------
// GET /api/stjorna/setup-status
// ---------------------------------------------------------------------------
var SETUP_STATUS_BODY =
    SETUP_JSON_REPLY +
    SETUP_SUPERUSER_EXISTS_FN +
    SETUP_DONE_FN +
    "var _exists=false;" +
    "try{_exists=_realSuperuserExists($app);}catch(_e){}" +
    "_reply(200,{" +
        "superuserExists:_exists," +
        "setupDone:_setupDone()," +
        "setupTokenRequired:true," +
        "setupTokenSource:" + JSON.stringify(SETUP_TOKEN_SOURCE) +
    "});";

routerAdd("GET", "/api/stjorna/setup-status", new Function("e", SETUP_STATUS_BODY));
console.log("[stjorna-setup] registered GET /api/stjorna/setup-status");

// ---------------------------------------------------------------------------
// POST /api/stjorna/setup-bootstrap-superuser
// ---------------------------------------------------------------------------
// Check order: token (401) → body validation (400) → setup_done (409) →
// superuser exists (409) → transaction { re-check (409) + INSERT }.
var SETUP_BOOTSTRAP_BODY =
    SETUP_JSON_REPLY +
    SETUP_READ_BODY +
    SETUP_SUPERUSER_EXISTS_FN +
    SETUP_DONE_FN +
    // --- 1. setup token -------------------------------------------------
    "var _tok=String(e.request.header.get('X-Stjorna-Setup-Token')||'').trim();" +
    "if(!_tok||!$security.equal(_tok," + JSON.stringify(SETUP_TOKEN) + ")){" +
        "_reply(401,{ok:false,error:{code:401,message:'missing or invalid setup token (STJORNA_SETUP_TOKEN env var, or the token printed in the PocketBase server log at startup)'}});" +
        "return;" +
    "}" +
    // --- 2. body validation ---------------------------------------------
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
    // --- 3. setup already completed -------------------------------------
    "if(_setupDone()){" +
        "_reply(409,{ok:false,error:{code:409,message:'setup already completed; create additional superusers from the PocketBase admin UI or the `pocketbase superuser upsert` CLI'}});" +
        "return;" +
    "}" +
    // --- 4. superuser already exists (fast path, outside the tx) ----------
    "var _existsPre=false;" +
    "try{_existsPre=_realSuperuserExists($app);}catch(_ef){}" +
    "if(_existsPre){" +
        "_reply(409,{ok:false,error:{code:409,message:'superuser already exists; use the admin login instead'}});" +
        "return;" +
    "}" +
    // --- 5. transaction: re-check + insert --------------------------------
    "var _newId='';" +
    "try{" +
        "$app.runInTransaction(function(txApp){" +
            "if(_realSuperuserExists(txApp)){throw new Error('STJORNA_SUPERUSER_EXISTS');}" +
            "var _col=txApp.findCollectionByNameOrId('_superusers');" +
            "if(!_col){throw new Error('_superusers collection not found');}" +
            "var _rec=new Record(_col);" +
            // PB auth-collection typed setters: hashing goes through PB's
            // own path so the stored hash matches what auth-with-password
            // expects.
            "_rec.setEmail(_email);" +
            "_rec.setPassword(_pw);" +
            "_rec.setVerified(true);" +
            // The superusers.pb.js hook defaults missing `active` to true,
            // but we set it explicitly so the bootstrap result is obvious
            // in the DB.
            "try{_rec.set('active',true);}catch(_ea){}" +
            "txApp.save(_rec);" +
            "_newId=String(_rec.id||'');" +
        "});" +
    "}catch(_es){" +
        "var _msg=String((_es&&_es.message)||_es||'unknown error');" +
        "if(_msg.indexOf('STJORNA_SUPERUSER_EXISTS')>=0){" +
            "_reply(409,{ok:false,error:{code:409,message:'superuser already exists; use the admin login instead'}});" +
            "return;" +
        "}" +
        "console.log('[stjorna-setup] bootstrap save failed: '+_msg);" +
        "_reply(500,{ok:false,error:{code:500,message:'could not create superuser: '+_msg}});" +
        "return;" +
    "}" +
    "console.log('[stjorna-setup] first superuser created: '+_email);" +
    "_reply(200,{ok:true,id:_newId,email:_email});";

routerAdd("POST", "/api/stjorna/setup-bootstrap-superuser", new Function("e", SETUP_BOOTSTRAP_BODY));
console.log("[stjorna-setup] registered POST /api/stjorna/setup-bootstrap-superuser");

console.log("[stjorna-setup] hooks loaded (setup token source: " + SETUP_TOKEN_SOURCE + ")");
