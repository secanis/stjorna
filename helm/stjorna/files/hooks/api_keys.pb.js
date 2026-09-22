// STJÓRNA v3 — API keys
//
// Custom routes (PB admin-only):
//   POST   /api/stjorna/api-keys             → issue. Returns plaintext exactly once.
//   GET    /api/stjorna/api-keys             → list metadata. Never returns secret.
//   DELETE /api/stjorna/api-keys/{id}        → revoke (sets revoked=true).
//   GET    /api/stjorna/api-keys/me          → introspect bearer (any caller).
//   POST   /api/stjorna/api-keys/exchange    → API key bearer → STJÓRNA user creds.
//
// Collection access:
//   The `api_keys` collection has ALL rules locked to null. STJÓRNA user
//   JWTs CANNOT list/get/create/update api_keys at all. Only PB superusers
//   (PB admins via `pb.admins.authWithPassword`) can use these routes.
//
// Auth (T-01): admin-only routes use $apis.requireSuperuserAuth() so PB
//   itself verifies the JWT signature. The inline ADMIN_AUTH_FN below
//   is kept as defense-in-depth (throws ForbiddenError if e.auth is not
//   a verified superuser) but no longer parses JWTs by hand.
//   Bearer-key routes (/me, /exchange) only accept the API key shape;
//   they do NOT consult any Authorization JWT.
//
// Key shape:
//   stjorna_<tenantShort6>_<keyShort6>.<secret40>
//   First half = prefix, public, indexed for O(1) lookup.
//   Second half = secret, hashed at rest (PB $security.sha256, deterministic
//   — see REPORT.md for the bcrypt-vs-sha256 trade-off note), returned once.
//
// Notes on PB v0.40.2 JSVM (mirror the patterns in openapi.pb.js /
// backup.pb.js — handlers are string-concatenated and wrapped in
//   `new Function("e", BODY)` to dodge loader/executor VM closures):
//   - e is a core.RequestEvent; e.request is *http.Request.
//   - e.auth is the verified AuthContext (null for anonymous, populated
//     by PB after a successful JWT verification).
//   - e.hasSuperuserAuth() returns true iff e.auth is a _superusers record.
//   - e.response.header().set(name, value) for response headers.
//   - e.string(status, body) for responses.
//   - e.request.url.query().get(name) for query params.
//   - e.request.header.get(name) for request headers.
//   - $app for DB; $security.sha256/randomString.

console.log("[stjorna-apikeys] loading");

// ---------------------------------------------------------------------------
// Helpers (inlined into each handler body via string concatenation)
// ---------------------------------------------------------------------------

var READ_BODY_FN =
    "function _readBody(){try{return readerToString(e.request.body,64*1024);}catch(_e){return '';}}";

// Constant-time-ish string compare — no early exit on mismatch.
var CMP_FN =
    "function _constEq(a,b){" +
        "if(!a||!b)return false;" +
        "a=String(a);b=String(b);" +
        "if(a.length!==b.length)return false;" +
        "var d=0;for(var i=0;i<a.length;i++)d|=(a.charCodeAt(i)^b.charCodeAt(i));" +
        "return d===0;" +
    "}";

// Defense-in-depth admin check. $apis.requireSuperuserAuth() middleware
// already enforces this at route registration; the inline check exists
// so a future code change can't accidentally drop the middleware and
// silently expose admin routes. Uses e.hasSuperuserAuth() (PB has
// already verified the JWT signature before populating e.auth).
var ADMIN_AUTH_FN =
    "if(!e.hasSuperuserAuth()){" +
        "e.response.header().set('Content-Type','application/json; charset=utf-8');" +
        "e.string(401,'{\"ok\":false,\"error\":{\"code\":401,\"message\":\"admin auth required\"}}');" +
        "return;" +
    "}";

var JSON_REPLY_FN =
    "function _reply(status,obj){" +
        "var body=JSON.stringify(obj);" +
        "e.response.header().set('Content-Type','application/json; charset=utf-8');" +
        "e.response.header().set('Cache-Control','no-store');" +
        "e.string(status,body);" +
    "}";

var KEY_SHAPE_FN =
    "function _keyShape(k){" +
        "if(typeof k!=='string')return false;" +
        "if(k.length<16||k.length>256)return false;" +
        "var p=k.split('.');" +
        "if(p.length!==2)return false;" +
        "if(p[0].indexOf('stjorna_')!==0)return false;" +
        "if(p[0].length<8||p[0].length>64)return false;" +
        "if(!/^[A-Za-z0-9_]+$/.test(p[0]))return false;" +
        "if(p[1].length<16||p[1].length>128)return false;" +
        "if(!/^[A-Za-z0-9]+$/.test(p[1]))return false;" +
        "return true;" +
    "}";

// Deterministic hashing: SHA-256 of the secret. Both issue and introspect
// compute the same hash so equality checks work. (Bcrypt-style
// `$security.hash` is non-deterministic and can't be re-verified without
// `$security.compareHash`, which is not always exposed. SHA-256 of an
// n-byte random secret is more than enough for this threat model — see
// REPORT.md.)
var CRYPTO_FN =
    "function _rand(n){" +
        "try{return $security.randomString(n).toLowerCase();}catch(_e){" +
            "var ch='abcdefghijklmnopqrstuvwxyz0123456789';" +
            "var buf=new Uint8Array(n);" +
            "try{crypto.getRandomValues(buf);}catch(_e2){for(var i=0;i<n;i++)buf[i]=Math.floor(Math.random()*256);}" +
            "var out='';for(var j=0;j<n;j++)out+=ch[buf[j]%ch.length];" +
            "return out;" +
        "}" +
    "}" +
    "function _hash(s){" +
        "try{return $security.sha256(s);}catch(_e){return '';}" +
    "}";

// ---------------------------------------------------------------------------
// POST /api/stjorna/api-keys  — issue
// ---------------------------------------------------------------------------
var ISSUE_BODY = "" +
    ADMIN_AUTH_FN +
    READ_BODY_FN +
    JSON_REPLY_FN +
    CRYPTO_FN +
    "var _raw=_readBody();" +
    "var _body={};try{_body=JSON.parse(_raw||'{}')||{};}catch(_e){_body={};}" +
    "var _tenantId=String(_body.tenant||'').trim();" +
    "var _name=String(_body.name||'').trim();" +
    "var _permissions=_body.permissions||null;" +
    "var _expires=_body.expires||null;" +
    "if(!_tenantId){_reply(400,{ok:false,error:{code:400,message:'tenant is required'}});return;}" +
    "if(!_name){_reply(400,{ok:false,error:{code:400,message:'name is required'}});return;}" +
    "if(_name.length>200){_reply(400,{ok:false,error:{code:400,message:'name too long'}});return;}" +
    // Verify tenant exists. tenants listRule is `null` → superuser-only,
    // which we already auth-checked above.
    "var _tenant=null;try{_tenant=$app.findRecordById('tenants',_tenantId);}catch(_et){_reply(404,{ok:false,error:{code:404,message:'tenant not found'}});return;}" +
    "if(!_tenant){_reply(404,{ok:false,error:{code:404,message:'tenant not found'}});return;}" +
    // Build key
    "var _tid=String(_tenant.id||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,6).toLowerCase()||'tenant';" +
    "var _prefix='stjorna_'+_tid+'_'+_rand(6);" +
    "var _secret=_rand(40);" +
    "var _fullKey=_prefix+'.'+_secret;" +
    "var _keyHash=_hash(_fullKey);" +
    "if(!_keyHash){_reply(500,{ok:false,error:{code:500,message:'hashing unavailable'}});return;}" +
    // ---- Create a STJÓRNA service user for this tenant --------------------
    // STJÓRNA's collection rules reference @request.auth — PB doesn't
    // inject a synthetic auth record for an STJÓRNA API key, so ren-
    // dering through the rules returns 0 rows. We mint a per-tenant
    // auth-record-internal "service user" at issue time and store its
    // credentials on the api_keys row. The /exchange route hands them
    // to the caller; the caller then does
    //   pb.collection('users').authWithPassword(email, password)
    // and uses the resulting JWT for /api/collections/* requests.
    //
    // The api_keys collection has all rules null — STJÓRNA user JWTs
    // cannot read `service_user_password`. Only PB admins and the
    // custom /exchange route can.
    "var _svcEmail='';" +
    "var _svcPassword='';" +
    "var _svcUserId='';" +
    "try{" +
        "_svcPassword=_rand(40);" +
        "_svcEmail='svc-'+_tid+'-'+_rand(8)+'@stjorna.internal';" +
        // PB auth records require `username` (auto-derived from email
        // when going through the SDK, but the DAO Record path needs
        // it set explicitly — save fails with "unable to save auth
        // record without username" otherwise).
        "var _svcUsername=_svcEmail.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80);" +
        // Find or create the auth collection. `users` in STJÓRNA IS
        // `_pb_users_auth_` — every non-auth field on a base record
        // there is silently dropped, but we only set email + password
        // which are the auth fields PB itself owns.
        "var _authCol=$app.findCollectionByNameOrId('_pb_users_auth_');" +
        "var _authCollName=_authCol?_authCol.name||'_pb_users_auth_':'_pb_users_auth_';" +
        "_authCol=$app.findCollectionByNameOrId(_authCollName);" +
        "var _existingUser=null;" +
        "try{_existingUser=$app.findFirstRecordByFilter(_authCollName,'email={:e}',{e:_svcEmail});}catch(_eu){}" +
        "if(_existingUser){_svcUserId=String(_existingUser.id||'');}" +
        "else{" +
            "var _u=new Record(_authCol);" +
            // setEmail / setPassword route through PB's auth-record
            // methods so the password hash lands correctly. Plain
            // set('password', ...) on an auth collection doesn't
            // hash it; the SDK's auth path is the only documented
            // way, but Record.setPassword exists too on this build.
            "_u.setUsername(_svcUsername);" +
            "_u.setEmail(_svcEmail);" +
            "_u.setPassword(_svcPassword);" +
            // verified=false is fine — the user will never log in
            // interactively, only via this exchange flow.
            "_u.setVerified(true);" +
            // Stamp the tenant on the auth record so STJÓRNA's
            // collection rules (`@request.auth.tenant = tenant`)
            // can evaluate to true. PB silently drops non-auth
            // fields on regular `set(...)` calls, so use the typed
            // helper if available, otherwise fall back to set().
            "try{if(typeof _u.set==='function')_u.set('tenant',_tenantId);else if(typeof _u.tenant!=='undefined')_u.tenant=_tenantId;}catch(_es){}" +
            "try{$app.save(_u);_svcUserId=String(_u.id||'');}catch(_esu){console.log('[stjorna-apikeys] svc user save failed: '+(_esu&&_esu.message))}" +
        "}" +
    "}catch(_eSvc){console.log('[stjorna-apikeys] svc user block error: '+(_eSvc&&_eSvc.message))}" +
    // ---- Persist the api_keys row ----
    "var _coll=$app.findCollectionByNameOrId('api_keys');" +
    "var _rec=new Record(_coll);" +
    "_rec.set('tenant',_tenantId);" +
    "_rec.set('name',_name);" +
    "_rec.set('prefix',_prefix);" +
    "_rec.set('key_hash',_keyHash);" +
    "if(_permissions){try{_rec.set('permissions',JSON.stringify(_permissions));}catch(_ep){}}" +
    "if(_expires)_rec.set('expires',String(_expires));" +
    "_rec.set('revoked',false);" +
    "if(_svcUserId){_rec.set('service_user_id',_svcUserId);_rec.set('service_user_email',_svcEmail);_rec.set('service_user_password',_svcPassword);}" +
    "try{$app.save(_rec);}catch(_es){_reply(500,{ok:false,error:{code:500,message:'persist failed: '+(_es.message||_es)}});return;}" +
    "var _resp={" +
        "ok:true," +
        "apiKey:{" +
            "id:_rec.id," +
            "tenant:_tenantId," +
            "name:_name," +
            "prefix:_prefix," +
            "permissions:_permissions," +
            "expires:_expires," +
            "revoked:false," +
            "service_user_email:_svcEmail," +
            "created:new Date().toISOString()" +
        "}," +
        "plaintext:_fullKey," +
        "warning:'Store this key now. It will not be shown again.'" +
    "};" +
    "_reply(200,_resp);";

routerAdd("POST", "/api/stjorna/api-keys", new Function("e", ISSUE_BODY), $apis.requireSuperuserAuth());
console.log("[stjorna-apikeys] registered POST /api/stjorna/api-keys");

// ---------------------------------------------------------------------------
// GET /api/stjorna/api-keys  — list metadata
// ---------------------------------------------------------------------------
var LIST_BODY = "" +
    ADMIN_AUTH_FN +
    JSON_REPLY_FN +
    // Single outer try/catch — anything thrown inside this body (a missing
    // collection, a PB JSVM quirk, a malformed field) is converted into a
    // clean 500 with the actual error message so the FE has something
    // useful to show instead of "Something went wrong".
    "try{" +
    "var _page=parseInt(e.request.url.query().get('page')||'1',10);" +
    "var _perPage=parseInt(e.request.url.query().get('perPage')||'50',10);" +
    "var _tenantId=String(e.request.url.query().get('tenant')||'');" +
    "if(!_page||_page<1)_page=1;" +
    "if(!_perPage||_perPage<1||_perPage>200)_perPage=50;" +
    "var _rows=[];" +
    "try{" +
        // using findRecordsByFilter
        // SQL-like expressions (backup.pb.js uses it). We post-filter +
        // paginate in JS so the row count stays in our hands regardless of
        // pagination niceties inside the expression engine.
        "_rows=$app.findRecordsByFilter('api_keys','','',0,0);" +
    "}catch(_el){_reply(500,{ok:false,error:{code:500,message:'list query failed: '+(_el.message||_el)}});return;}" +
    // JS-side filter (tenant match + not revoked) + sort + paginate.
    "var _filtered=[];" +
    "for(var _i=0;_i<(_rows||[]).length;_i++){" +
        "var _r=_rows[_i];" +
        "if(!_r||typeof _r.get!=='function')continue;" +
        // Skip revoked rows AND rows missing a usable prefix. The prefix
        // is the only thing the introspect handler uses to look up a
        // record, so anything without a valid stjorna_* prefix is junk
        // from the caller's perspective. This also shields the FE from
        // rows left behind by partial upgrades or buggy tooling.
        "try{if(_r.get('revoked'))continue;}catch(_eRev){}" +
        "var _rp='';try{_rp=String(_r.get('prefix')||'');}catch(_eP){}" +
        "if(_rp.indexOf('stjorna_')!==0)continue;" +
        "if(_tenantId){var _rt='';try{_rt=String(_r.get('tenant'));}catch(_eT){}if(_rt!==_tenantId)continue;}" +
        "_filtered.push(_r);" +
    "}" +
    "_filtered.sort(function(a,b){var _ca='';var _cb='';try{_ca=String(a.get('created')||'');}catch(_ea){}try{_cb=String(b.get('created')||'');}catch(_eb){}return _cb.localeCompare(_ca);});" +
    "var _total=_filtered.length;" +
    "var _start=(_page-1)*_perPage;_rows=_filtered.slice(_start,_start+_perPage);" +
    "var _items=(_rows||[]).map(function(r){" +
        "var _perms=null;" +
        "try{var _p=r.get('permissions');if(_p&&typeof _p==='string')_perms=JSON.parse(_p);else if(_p)_perms=_p;}catch(_ep){}" +
        "return {" +
            "id:r.id," +
            "tenant:(function(){try{return r.get('tenant');}catch(_et){return '';}})()," +
            "name:r.get('name')," +
            "prefix:r.get('prefix')," +
            "permissions:_perms," +
            "last_used:r.get('last_used')||null," +
            "expires:r.get('expires')||null," +
            "revoked:(function(){try{return !!r.get('revoked');}catch(_er){return false;}})()," +
            "created:(function(){try{return r.get('created')||null;}catch(_ec){return null;}})()" +
        "};" +
    "});" +
    "_reply(200,{ok:true,items:_items,page:_page,perPage:_perPage,totalItems:_total});" +
    "}catch(_eAll){console.log('[stjorna-apikeys] LIST outer error: '+((_eAll&&_eAll.stack)||(_eAll&&_eAll.message)||_eAll));_reply(500,{ok:false,error:{code:500,message:'list handler crashed: '+((_eAll&&_eAll.message)||String(_eAll))}});return;}" ;

routerAdd("GET", "/api/stjorna/api-keys", new Function("e", LIST_BODY), $apis.requireSuperuserAuth());
console.log("[stjorna-apikeys] registered GET /api/stjorna/api-keys");

// ---------------------------------------------------------------------------
// DELETE /api/stjorna/api-keys/{id}  — revoke
// ---------------------------------------------------------------------------
// PB v0.40.2 uses `/{id...}` for wildcard path params; read with
// e.request.pathValue('id').
var REVOKE_BODY = "" +
    ADMIN_AUTH_FN +
    JSON_REPLY_FN +
    "var _id=String(e.request.pathValue('id')||'');" +
    "if(!_id){_reply(400,{ok:false,error:{code:400,message:'id required'}});return;}" +
    // Pass the collection NAME (string), not the Collection object.
    "var _rec=null;try{_rec=$app.findRecordById('api_keys',_id);}catch(_en){_reply(404,{ok:false,error:{code:404,message:'not found'}});return;}" +
    "_rec.set('revoked',true);" +
    "try{$app.save(_rec);}catch(_es){_reply(500,{ok:false,error:{code:500,message:'revoke failed: '+(_es.message||_es)}});return;}" +
    "_reply(200,{ok:true,id:_id,revoked:true});";

routerAdd("DELETE", "/api/stjorna/api-keys/{id...}", new Function("e", REVOKE_BODY), $apis.requireSuperuserAuth());
console.log("[stjorna-apikeys] registered DELETE /api/stjorna/api-keys/{id...}");

// ---------------------------------------------------------------------------
// GET /api/stjorna/api-keys/me  — introspect
// ---------------------------------------------------------------------------
var INTROSPECT_BODY = "" +
    JSON_REPLY_FN +
    KEY_SHAPE_FN +
    CRYPTO_FN +
    CMP_FN +
    "var _h=String(e.request.header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
    "if(!_h){_reply(401,{ok:false,error:{code:401,message:'missing API key'}});return;}" +
    "if(!_keyShape(_h)){_reply(401,{ok:false,error:{code:401,message:'malformed API key'}});return;}" +
    "var _prefix=_h.split('.')[0];" +
    // The ISSUE handler stored `key_hash = sha256(fullKey)`. We must
    // re-hash the same fullKey and constant-time compare.
    "var _computedHash=_hash(_h);" +
    "var _rec=null;" +
    // using findRecordsByFilter
    "var _all=null;try{_all=$app.findRecordsByFilter('api_keys','','',0,0);}catch(_e1){}" +
    "var _getR=function(_r,_k){try{return _r.get(_k);}catch(_eg){return null;}};" +
    "if(_all){for(var _i2=0;_i2<_all.length;_i2++){var _r=_all[_i2];if(!_r||typeof _r.get!=='function')continue;if(String(_getR(_r,'prefix'))===_prefix&&!_getR(_r,'revoked')){_rec=_r;break;}}}" +
    "if(!_rec){_reply(401,{ok:false,error:{code:401,message:'invalid API key'}});return;}" +
    "var _stored=String(_getR(_rec,'key_hash')||'');" +
    "if(!_constEq(_computedHash,_stored)){_reply(401,{ok:false,error:{code:401,message:'invalid API key'}});return;}" +
    "var _exp=_getR(_rec,'expires');" +
    "if(_exp){" +
        // PB returns dates as a goja time.Time bridged into a wrapper object
        // (not a JS Date and not a plain string). Normalise to ms either way:
        //   - if it has getTime() (a Date-like), use it directly,
        //   - otherwise toString() and try Date.parse on the resulting string.
        //   The resulting string is PB's `YYYY-MM-DD HH:MM:SS.SSSZ` form
        //   which JS Date.parse can NOT handle, so we swap the space for a
        //   `T` first.
        "var _ms=0;" +
        "if(typeof _exp.getTime==='function'&&!isNaN(_exp.getTime())){" +
            "_ms=_exp.getTime();" +
        "}else{" +
            "var _str=String(_exp).replace(' ','T');" +
            "_ms=Date.parse(_str);" +
        "}" +
        "if(_ms&&!isNaN(_ms)&&_ms<Date.now()){_reply(401,{ok:false,error:{code:401,message:'expired'}});return;}" +
    "}" +
    // Best-effort last_used update.
    "try{_rec.set('last_used',new Date().toISOString().replace('T',' ').replace(/\\..*$/,'Z'));$app.save(_rec);}catch(_eu){}" +
    "var _permsOut=null;" +
    "try{var _pp=_getR(_rec,'permissions');if(_pp&&typeof _pp==='string')_permsOut=JSON.parse(_pp);else if(_pp)_permsOut=_pp;}catch(_ep2){}" +
    "_reply(200,{" +
        "ok:true," +
        "tenant:_getR(_rec,'tenant')," +
        "id:_rec.id," +
        "prefix:_prefix," +
        "permissions:_permsOut," +
        "expires:_exp||null" +
    "});";

routerAdd("GET", "/api/stjorna/api-keys/me", new Function("e", INTROSPECT_BODY));
console.log("[stjorna-apikeys] registered GET /api/stjorna/api-keys/me");

// ---------------------------------------------------------------------------
// POST /api/stjorna/api-keys/exchange — API key bearer → STJÓRNA user credentials
// ---------------------------------------------------------------------------
// Accepts the API key as a bearer (Authorization: Bearer stjorna_….) or in the
// JSON body { key: "stjorna_…" }. Returns:
//   { ok, tenant, email, password }
// The caller then does
//   pb.collection('users').authWithPassword(email, password)
// against its own STJÓRNA frontend and uses the resulting JWT for the
// regular /api/collections/* routes.
//
// Why this exists: STJÓRNA's collection rules reference @request.auth.
// PB only injects an auth record when it can verify a user JWT — an
// STJÓRNA API key is not a JWT PB recognises, so rules reject reads
// (returns 200 with `items: []`). Service-user exchange gives the
// caller a real STJÓRNA user JWT that passes the rules.

var EXCHANGE_BODY = "" +
    JSON_REPLY_FN +
    READ_BODY_FN +
    KEY_SHAPE_FN +
    CRYPTO_FN +
    CMP_FN +
    // Read bearer OR body.
    "var _h=String(e.request.header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
    "var _raw=_readBody();" +
    "var _body={};try{_body=JSON.parse(_raw||'{}')||{};}catch(_e){_body={};}" +
    "var _key=_h||String(_body.key||'').trim();" +
    "if(!_key){_reply(400,{ok:false,error:{code:400,message:'API key required (Authorization bearer or JSON body {key})'}});return;}" +
    "if(!_keyShape(_key)){_reply(401,{ok:false,error:{code:401,message:'malformed API key'}});return;}" +
    "var _prefix=_key.split('.')[0];" +
    "var _computedHash=_hash(_key);" +
    // using findRecordsByFilter
    "var _rec=null;" +
    "var _all=null;try{_all=$app.findRecordsByFilter('api_keys','','',0,0);}catch(_e1){}" +
    "var _getR=function(_r,_k){try{return _r.get(_k);}catch(_eg){return null;}};" +
    "if(_all){for(var _i3=0;_i3<_all.length;_i3++){var _r=_all[_i3];if(!_r||typeof _r.get!=='function')continue;if(String(_getR(_r,'prefix'))===_prefix&&!_getR(_r,'revoked')){_rec=_r;break;}}}" +
    "if(!_rec){_reply(401,{ok:false,error:{code:401,message:'invalid API key'}});return;}" +
    "var _stored=String(_getR(_rec,'key_hash')||'');" +
    "if(!_constEq(_computedHash,_stored)){_reply(401,{ok:false,error:{code:401,message:'invalid API key'}});return;}" +
    // Expiry check.
    "var _exp=_getR(_rec,'expires');" +
    "if(_exp){" +
        "var _ms=0;" +
        "if(typeof _exp.getTime==='function'&&!isNaN(_exp.getTime())){_ms=_exp.getTime();}" +
        "else{var _str=String(_exp).replace(' ','T');_ms=Date.parse(_str);}" +
        "if(_ms&&!isNaN(_ms)&&_ms<Date.now()){_reply(401,{ok:false,error:{code:401,message:'expired'}});return;}" +
    "}" +
    // Resolve tenant_id from the api_keys row. Needed both for the
    // legacy-backfill path below (we have to mint a fresh service
    // user pinned to this tenant) and for the response.
    "var _tenantId=String(_getR(_rec,'tenant')||'');" +
    "if(!_tenantId){_reply(500,{ok:false,error:{code:500,message:'api_keys row missing tenant'}});return;}" +
    // Lazy backfill: keys issued before this feature shipped have no
    // service_user_* fields. Instead of bouncing the caller with a
    // 409, mint a fresh service user now and stamp the credentials on
    // the existing row. Equivalent to a re-issue minus the new
    // plaintext (the user already has their existing key).
    "var _svcId=String(_getR(_rec,'service_user_id')||'');" +
    "var _svcEmail=String(_getR(_rec,'service_user_email')||'');" +
    "var _svcPassword=String(_getR(_rec,'service_user_password')||'');" +
    "var _backfilled=false;" +
    "if(!_svcId||!_svcEmail||!_svcPassword){" +
        "try{" +
            // Mirror the service-user minting from the ISSUE handler.
            "_svcPassword=_rand(40);" +
            "var _tid=String(_tenantId).replace(/[^a-zA-Z0-9]/g,'').slice(0,6).toLowerCase()||'tenant';" +
            "_svcEmail='svc-'+_tid+'-'+_rand(8)+'@stjorna.internal';" +
            "var _svcUsername=_svcEmail.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80);" +
            "var _authCol=$app.findCollectionByNameOrId('_pb_users_auth_');" +
            "var _u=new Record(_authCol);" +
            "_u.setUsername(_svcUsername);" +
            "_u.setEmail(_svcEmail);" +
            "_u.setPassword(_svcPassword);" +
            "_u.setVerified(true);" +
            "$app.save(_u);" +
            "_svcId=String(_u.id||'');" +
            // Persist onto the existing api_keys row.
            "_rec.set('service_user_id',_svcId);" +
            "_rec.set('service_user_email',_svcEmail);" +
            "_rec.set('service_user_password',_svcPassword);" +
            "$app.save(_rec);" +
            "_backfilled=true;" +
        "}catch(_eBack){" +
            "_reply(500,{ok:false,error:{code:500,message:'legacy backfill failed: '+(_eBack&&_eBack.message||_eBack)}});return;" +
        "}" +
    "}" +
    // Verify the auth record still exists (defensive — could have been
    // wiped by an admin manually). If missing, refuse rather than mint
    // a broken JWT.
    "try{" +
        "var _uCheck=$app.findRecordById('_pb_users_auth_',_svcId);" +
        "if(!_uCheck||String(_getR(_uCheck,'email')||'')!==_svcEmail){" +
            "_reply(500,{ok:false,error:{code:500,message:'service user record missing or email mismatch — re-issue the key'}});return;" +
        "}" +
    "}catch(_em){" +
        "_reply(500,{ok:false,error:{code:500,message:'service user lookup failed — re-issue the key'}});return;" +
    "}" +
    // Best-effort last_used update.
    "try{_rec.set('last_used',new Date().toISOString().replace('T',' ').replace(/\\..*$/,'Z'));$app.save(_rec);}catch(_eu){}" +
    "var _tenantOut=String(_getR(_rec,'tenant')||'');" +
    "var _permsOut=null;" +
    "try{var _pp=_getR(_rec,'permissions');if(_pp&&typeof _pp==='string')_permsOut=JSON.parse(_pp);else if(_pp)_permsOut=_pp;}catch(_ep2){}" +
    "_reply(200,{" +
        "ok:true," +
        "tenant:_tenantOut," +
        "email:_svcEmail," +
        "password:_svcPassword," +
        "backfilled:_backfilled," +
        "instructions:'POST these credentials to /api/collections/users/auth-with-password to receive a JWT, then send that JWT as Bearer for /api/collections/* requests.' ," +
        "permissions:_permsOut" +
    "});";

routerAdd("POST", "/api/stjorna/api-keys/exchange", new Function("e", EXCHANGE_BODY));
console.log("[stjorna-apikeys] registered POST /api/stjorna/api-keys/exchange");

console.log("[stjorna-apikeys] all routes registered");
