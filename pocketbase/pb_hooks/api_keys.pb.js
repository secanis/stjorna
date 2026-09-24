// STJÓRNA v3 — API keys (T-05 redesign)
//
// Custom routes (PB admin-only):
//   POST   /api/stjorna/api-keys             → issue. Returns the API key
//                                            plaintext EXACTLY ONCE.
//   GET    /api/stjorna/api-keys             → list metadata. Never
//                                            returns the plaintext key
//                                            nor any service-user
//                                            credential.
//   DELETE /api/stjorna/api-keys/{id}        → revoke. Deletes the
//                                            underlying service user +
//                                            refreshes tokenKey so every
//                                            live JWT issued to it stops
//                                            working instantly.
//   GET    /api/stjorna/api-keys/me          → introspect bearer (no
//                                            JWT — just confirms the
//                                            key shape and tenant).
//   POST   /api/stjorna/api-keys/exchange    → API key bearer → short-
//                                            lived auth JWT. NEVER
//                                            returns the service-user
//                                            password.
//
// Collection access:
//   The `api_keys` collection has ALL rules locked to null. STJÓRN A
//   user JWTs CANNOT list/get/create/update api_keys at all. Only PB
//   superusers (PB admins via `pb.admins.authWithPassword`) can use
//   the issue / list / revoke routes.
//
// Auth (T-01): admin-only routes use $apis.requireSuperuserAuth() so PB
//   itself verifies the JWT signature. The inline ADMIN_AUTH_FN below
//   is kept as defense-in-depth (throws ForbiddenError if e.auth is
//   not a verified superuser) but no longer parses JWTs by hand.
//   Bearer-key routes (/me, /exchange) only accept the API key shape;
//   they do NOT consult any Authorization JWT.
//
// Key shape:
//   stjorna_<tenantShort6>_<keyShort6>.<secret40>
//   First half = prefix, public, UNIQUE-indexed for O(log n) lookup.
//   Second half = secret, hashed at rest (PB $security.sha256, de-
//   terministic — see the bcrypt-vs-sha256 trade-off note in the T-05
//   PR description), returned once on issue.
//
// Service user (T-05):
//   At issue time we create a per-tenant auth record in `_pb_users_
//   auth_` whose password is a 40-byte random string nobody knows. PB
//   hashes the password on save; the api_keys row stores only the
//   auth-record id + email. To use the key the caller POSTs to
//   `/exchange`, which verifies the bearer hash against api_keys
//   and mints a fresh PB auth token via `$auth record.newAuthToken()`.
//   No plaintext password ever crosses the wire after issue.
//   On revoke we delete the auth record and call `refreshTokenKey()`
//   first so any JWTs already issued to it stop working. (Token-key
//   rotation is the only thing that survives the user being deleted,
//   but it's the right signal for `auth records of this token-key`.)
//
// Notes on PB v0.40.2 JSVM:
//   - e is a core.RequestEvent; e.request is *http.Request.
//   - e.auth is the verified AuthContext (null for anonymous).
//   - e.hasSuperuserAuth() returns true iff e.auth is a _superusers
//     record. PB already verified the JWT signature.
//   - e.response.header().set(name, value) for response headers.
//   - e.string(status, body) for responses.
//   - e.request.url.query().get(name) for query params.
//   - e.request.header.get(name) for request headers.
//   - e.requestInfo().body for parsed JSON in POST handlers.
//   - $app for DB; $security.sha256/randomString; readerToString for
//     raw bodies.
//   - record.newAuthToken() mints a fresh JWT string for a loaded
//     auth-record. Validated against PB v0.40.4.
//   - record.refreshTokenKey() invalidates every existing token for
//     that record. Validated against PB v0.40.4.

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
// already enforces this at route registration; the inline check is a
// belt-and-braces guarantee in case a future refactor drops the
// middleware. Uses e.hasSuperuserAuth() (PB has already verified the JWT
// signature before populating e.auth).
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

// Deterministic hashing: SHA-256 of the full key (prefix.secret). Both
// issue and introspect/exchange compute the same hash so equality checks
// work. SHA-256 of an n-byte random secret is more than enough here.
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

// Look up the api_keys row by prefix using the UNIQUE-indexed finder.
// Returns null on miss. Mirrors what migration 1770001200 added.
var LOOKUP_PREFIX_FN =
    "function _lookupByPrefix(prefix){" +
        "var p=String(prefix||'');" +
        "if(!p)return null;" +
        "try{" +
            "var r=$app.findFirstRecordByFilter('api_keys'," +
                "'prefix={:p} && revoked=false'," +
                "{p:p});" +
            "return r||null;" +
        "}catch(_e){return null;}" +
    "}";

// Ensure a per-tenant viewer membership for a service user. Idempotent.
// We use `viewer` as the safe default — future T-05 follow-ups can branch
// on `permissions` to escalate to editor/admin if explicitly requested.
//
// `source` is now a SelectField (T-03 migration 1770001100). The
// allowed values are 'oidc' / 'manual' / ''. The handler tries
// 'manual' first; if the column has been hardened even further
// (e.g. closed to legacy ''), the catch swallows the rejection so
// the membership still gets created.
var SVC_MEMBERSHIP_FN =
    "function _ensureSvcMembership(_uid,_tid){" +
        "var _ex=[];try{_ex=$app.findRecordsByFilter('user_tenants','user={:u} && tenant={:t}','',1,0,{u:_uid,t:_tid});}catch(_e){}" +
        "if(_ex&&_ex.length>0)return;" +
        "var _role=$app.findFirstRecordByFilter('roles','name={:n}',{n:'viewer'});" +
        "if(!_role)return;" +
        "var _ut=new Record($app.findCollectionByNameOrId('user_tenants'));" +
        "_ut.set('user',_uid);" +
        "_ut.set('tenant',_tid);" +
        "_ut.set('role',_role.id);" +
        "try{_ut.set('source','manual');}catch(_es){}" +
        "try{$app.save(_ut);}catch(_eSave){}" +
    "}";

// Resolve the viewer role id once — captured at request time so
// repeated role lookups don't fight the row-cache.
var ROLE_VIEWER_ID_FN =
    "var _viewerRoleId='';" +
    "try{var _vr=$app.findFirstRecordByFilter('roles','name={:n}',{n:'viewer'});if(_vr)_viewerRoleId=String(_vr.id||'');}catch(_e){}";

// ---------------------------------------------------------------------------
// POST /api/stjorna/api-keys  — issue
// ---------------------------------------------------------------------------
var ISSUE_BODY = "" +
    ADMIN_AUTH_FN +
    READ_BODY_FN +
    JSON_REPLY_FN +
    CRYPTO_FN +
    ROLE_VIEWER_ID_FN +
    SVC_MEMBERSHIP_FN +
    "var _raw=_readBody();" +
    "var _body={};try{_body=JSON.parse(_raw||'{}')||{};}catch(_e){_body={};}" +
    "var _tenantId=String(_body.tenant||'').trim();" +
    "var _name=String(_body.name||'').trim();" +
    "var _permissions=_body.permissions||null;" +
    "var _expires=_body.expires||null;" +
    "if(!_tenantId){_reply(400,{ok:false,error:{code:400,message:'tenant is required'}});return;}" +
    "if(!_name){_reply(400,{ok:false,error:{code:400,message:'name is required'}});return;}" +
    "if(_name.length>200){_reply(400,{ok:false,error:{code:400,message:'name too long'}});return;}" +
    // Verify tenant exists. The tenants collection rules (T-02) lock
    // list/view to tenant-membership; superuser bypasses those, which is
    // why the admin-auth check above is mandatory.
    "var _tenant=null;try{_tenant=$app.findRecordById('tenants',_tenantId);}catch(_et){_reply(404,{ok:false,error:{code:404,message:'tenant not found'}});return;}" +
    "if(!_tenant){_reply(404,{ok:false,error:{code:404,message:'tenant not found'}});return;}" +
    // Build prefix + secret.
    "var _tid=String(_tenant.id||'').replace(/[^a-zA-Z0-9]/g,'').slice(0,6).toLowerCase()||'tenant';" +
    "var _prefix='stjorna_'+_tid+'_'+_rand(6);" +
    "var _secret=_rand(40);" +
    "var _fullKey=_prefix+'.'+_secret;" +
    "var _keyHash=_hash(_fullKey);" +
    "if(!_keyHash){_reply(500,{ok:false,error:{code:500,message:'hashing unavailable'}});return;}" +
    // Create a per-tenant service user with a random password nobody
    // knows. T-05: no plaintext password ever leaves the server
    // again — /exchange mints a fresh JWT on demand.
    "var _svcEmail='';" +
    "var _svcUserId='';" +
    "try{" +
        "_svcEmail='svc-'+_tid+'-'+_rand(8)+'@stjorna.internal';" +
        "var _svcPw=_rand(40);" +
        "var _authCol=$app.findCollectionByNameOrId('users');" +
        // Reuse a pre-existing user with this email if any (defensive
        // — duplicate emails would 400 on save).
        "var _existing=null;" +
        "try{_existing=$app.findFirstRecordByFilter('users','email={:e}',{e:_svcEmail});}catch(_eu){}" +
        "if(_existing){_svcUserId=String(_existing.id||'');}" +
        "else{" +
            "var _u=new Record(_authCol);" +
            "_u.setEmail(_svcEmail);" +
            "_u.setPassword(_svcPw);" +
            "_u.setVerified(true);" +
            "$app.save(_u);" +
            "_svcUserId=String(_u.id||'');" +
        "}" +
    "}catch(_eSvc){_reply(500,{ok:false,error:{code:500,message:'service user create failed: '+(_eSvc&&_eSvc.message||_eSvc)}});return;}" +
    "if(!_svcUserId){_reply(500,{ok:false,error:{code:500,message:'service user id missing'}});return;}" +
    // Pin the service user as a viewer of the tenant.
    "try{_ensureSvcMembership(_svcUserId,_tenantId);}catch(_eMem){_reply(500,{ok:false,error:{code:500,message:'service user membership failed: '+(_eMem&&_eMem.message||_eMem)}});return;}" +
    // Persist the api_keys row. Notice: no service_user_password.
    "var _coll=$app.findCollectionByNameOrId('api_keys');" +
    "var _rec=new Record(_coll);" +
    "_rec.set('tenant',_tenantId);" +
    "_rec.set('name',_name);" +
    "_rec.set('prefix',_prefix);" +
    "_rec.set('key_hash',_keyHash);" +
    "if(_permissions){try{_rec.set('permissions',JSON.stringify(_permissions));}catch(_ep){}}" +
    "if(_expires)_rec.set('expires',String(_expires));" +
    "_rec.set('revoked',false);" +
    "_rec.set('service_user_id',_svcUserId);" +
    "_rec.set('service_user_email',_svcEmail);" +
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
            "created:new Date().toISOString()" +
        "}," +
        // Plaintext key is returned EXACTLY once — there is no path to
        // retrieve it again. The bearer is the only secret; store it
        // client-side like a JWT.
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
    "try{" +
    "var _page=parseInt(e.request.url.query().get('page')||'1',10);" +
    "var _perPage=parseInt(e.request.url.query().get('perPage')||'50',10);" +
    "var _tenantId=String(e.request.url.query().get('tenant')||'');" +
    "if(!_page||_page<1)_page=1;" +
    "if(!_perPage||_perPage<1||_perPage>200)_perPage=50;" +
    // Load only non-revoked rows. The prefix-uniqueness index keeps this
    // small; we still post-filter by tenant in JS for explicit queries.
    "var _rows=[];" +
    "try{" +
        "_rows=$app.findRecordsByFilter('api_keys','revoked=false','',0,0);" +
    "}catch(_el){_reply(500,{ok:false,error:{code:500,message:'list query failed: '+(_el.message||_el)}});return;}" +
    "var _getR=function(_r,_k){try{return _r.get(_k);}catch(_eg){return null;}};" +
    "var _filtered=[];" +
    "for(var _i=0;_i<(_rows||[]).length;_i++){" +
        "var _r=_rows[_i];" +
        "if(!_r||typeof _r.get!=='function')continue;" +
        "var _rp='';try{_rp=String(_getR(_r,'prefix')||'');}catch(_eP){}" +
        "if(_rp.indexOf('stjorna_')!==0)continue;" +
        "if(_tenantId){var _rt='';try{_rt=String(_getR(_r,'tenant'));}catch(_eT){}if(_rt!==_tenantId)continue;}" +
        "_filtered.push(_r);" +
    "}" +
    "_filtered.sort(function(a,b){var _ca='';var _cb='';try{_ca=String(a.get('created')||'');}catch(_ea){}try{_cb=String(b.get('created')||'');}catch(_eb){}return _cb.localeCompare(_ca);});" +
    "var _total=_filtered.length;" +
    "var _start=(_page-1)*_perPage;_rows=_filtered.slice(_start,_start+_perPage);" +
    "var _items=(_rows||[]).map(function(r){" +
        "var _perms=null;" +
        "try{var _p=_getR(r,'permissions');if(_p&&typeof _p==='string')_perms=JSON.parse(_p);else if(_p)_perms=_p;}catch(_ep){}" +
        "return {" +
            "id:r.id," +
            "tenant:(()=>{try{return _getR(r,'tenant');}catch(_et){return '';}})()," +
            "name:_getR(r,'name')," +
            "prefix:_getR(r,'prefix')," +
            "permissions:_perms," +
            "last_used:_getR(r,'last_used')||null," +
            "expires:_getR(r,'expires')||null," +
            "revoked:!!_getR(r,'revoked')," +
            "created:(function(){try{return _getR(r,'created')||null;}catch(_ec){return null;}})()" +
        "};" +
    "});" +
    "_reply(200,{ok:true,items:_items,page:_page,perPage:_perPage,totalItems:_total});" +
    "}catch(_eAll){console.log('[stjorna-apikeys] LIST outer error: '+((_eAll&&_eAll.stack)||(_eAll&&_eAll.message)||_eAll));_reply(500,{ok:false,error:{code:500,message:'list handler crashed: '+((_eAll&&_eAll.message)||String(_eAll))}});return;}" ;

routerAdd("GET", "/api/stjorna/api-keys", new Function("e", LIST_BODY), $apis.requireSuperuserAuth());
console.log("[stjorna-apikeys] registered GET /api/stjorna/api-keys");

// ---------------------------------------------------------------------------
// DELETE /api/stjorna/api-keys/{id}  — revoke
// ---------------------------------------------------------------------------
// T-05: revoke is now real. We (a) flip revoked=true on the api_keys
// row, (b) delete the underlying service user from `_pb_users_auth_`,
// then (c) refresh the auth record's tokenKey so every live JWT
// issued to it before the delete stops working. Order matters: refresh
// BEFORE delete, because record.delete() makes the record unreachable
// for further method calls.
var REVOKE_BODY = "" +
    ADMIN_AUTH_FN +
    JSON_REPLY_FN +
    "var _id=String(e.request.pathValue('id')||'');" +
    "if(!_id){_reply(400,{ok:false,error:{code:400,message:'id required'}});return;}" +
    "var _rec=null;try{_rec=$app.findRecordById('api_keys',_id);}catch(_en){_reply(404,{ok:false,error:{code:404,message:'not found'}});return;}" +
    "if(!_rec){_reply(404,{ok:false,error:{code:404,message:'not found'}});return;}" +
    "var _svcId=String((function(){try{return _rec.get('service_user_id');}catch(_e){return '';}})()||'');" +
    // 1. flip revoked=true (idempotent — revoke-twice returns 200).
    "_rec.set('revoked',true);" +
    "try{$app.save(_rec);}catch(_es){_reply(500,{ok:false,error:{code:500,message:'revoke save failed: '+(_es.message||_es)}});return;}" +
    // 2. tear down the service user: refreshTokenKey first (in case any
    // JWTs already exist for this record id), then delete the record.
    "if(_svcId){" +
        "try{" +
            "var _sr=$app.findRecordById('users',_svcId);" +
            "if(_sr){" +
                "if(typeof _sr.refreshTokenKey==='function'){" +
                    "try{_sr.refreshTokenKey();}catch(_eR){console.log('[stjorna-apikeys] refreshTokenKey on '+_svcId+': '+(_eR&&_eR.message));}" +
                "}" +
                "try{$app.delete(_sr);}catch(_eD){console.log('[stjorna-apikeys] delete svc user '+_svcId+': '+(_eD&&_eD.message));}" +
            "}" +
        "}catch(_eS){console.log('[stjorna-apikeys] svc-user teardown failed: '+(_eS&&_eS.message));}" +
    "}" +
    "_reply(200,{ok:true,id:_id,revoked:true});";

routerAdd("DELETE", "/api/stjorna/api-keys/{id...}", new Function("e", REVOKE_BODY), $apis.requireSuperuserAuth());
console.log("[stjorna-apikeys] registered DELETE /api/stjorna/api-keys/{id...}");

// ---------------------------------------------------------------------------
// GET /api/stjorna/api-keys/me  — introspect (bearer-only)
// ---------------------------------------------------------------------------
// Cheap: hashes the bearer, looks up the row, returns tenant + permis-
// sions metadata. NEVER mints a JWT (that's what /exchange is for).
var INTROSPECT_BODY = "" +
    JSON_REPLY_FN +
    KEY_SHAPE_FN +
    CRYPTO_FN +
    CMP_FN +
    LOOKUP_PREFIX_FN +
    "var _h=String(e.request.header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
    "if(!_h){_reply(401,{ok:false,error:{code:401,message:'missing API key'}});return;}" +
    "if(!_keyShape(_h)){_reply(401,{ok:false,error:{code:401,message:'malformed API key'}});return;}" +
    "var _prefix=_h.split('.')[0];" +
    "var _computedHash=_hash(_h);" +
    "var _rec=_lookupByPrefix(_prefix);" +
    "if(!_rec){_reply(401,{ok:false,error:{code:401,message:'invalid API key'}});return;}" +
    "var _getR=function(_r,_k){try{return _r.get(_k);}catch(_eg){return null;}};" +
    "var _stored=String(_getR(_rec,'key_hash')||'');" +
    "if(!_constEq(_computedHash,_stored)){_reply(401,{ok:false,error:{code:401,message:'invalid API key'}});return;}" +
    "var _exp=_getR(_rec,'expires');" +
    "var _expMs=0;" +
    "if(_exp){" +
        "if(typeof _exp.getTime==='function'&&!isNaN(_exp.getTime())){_expMs=_exp.getTime();}" +
        "else{var _str=String(_exp).replace(' ','T');_expMs=Date.parse(_str);}" +
        "if(_expMs&&!isNaN(_expMs)&&_expMs<Date.now()){_reply(401,{ok:false,error:{code:401,message:'expired'}});return;}" +
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
        "expires:_expMs||null" +
    "});";

routerAdd("GET", "/api/stjorna/api-keys/me", new Function("e", INTROSPECT_BODY));
console.log("[stjorna-apikeys] registered GET /api/stjorna/api-keys/me");

// ---------------------------------------------------------------------------
// POST /api/stjorna/api-keys/exchange — API key bearer → STJÓRN A JWT
// ---------------------------------------------------------------------------
// T-05: this is the headline change. The old endpoint returned the
// plaintext service-user password; the caller then did
// `pb.collection('users').authWithPassword(email, password)` to get a
// JWT. The new endpoint mints the JWT server-side. There is no path
// from issue to /exchange that exposes the password.
var EXCHANGE_BODY = "" +
    JSON_REPLY_FN +
    READ_BODY_FN +
    KEY_SHAPE_FN +
    CRYPTO_FN +
    CMP_FN +
    LOOKUP_PREFIX_FN +
    SVC_MEMBERSHIP_FN +
    // Read bearer OR body.
    "var _h=String(e.request.header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
    "var _raw=_readBody();" +
    "var _body={};try{_body=JSON.parse(_raw||'{}')||{};}catch(_e){_body={};}" +
    "var _key=_h||String(_body.key||'').trim();" +
    "if(!_key){_reply(400,{ok:false,error:{code:400,message:'API key required (Authorization bearer or JSON body {key})'}});return;}" +
    "if(!_keyShape(_key)){_reply(401,{ok:false,error:{code:401,message:'malformed API key'}});return;}" +
    "var _prefix=_key.split('.')[0];" +
    "var _computedHash=_hash(_key);" +
    "var _rec=_lookupByPrefix(_prefix);" +
    "if(!_rec){_reply(401,{ok:false,error:{code:401,message:'invalid API key'}});return;}" +
    "var _getR=function(_r,_k){try{return _r.get(_k);}catch(_eg){return null;}};" +
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
    "var _tenantId=String(_getR(_rec,'tenant')||'');" +
    "if(!_tenantId){_reply(500,{ok:false,error:{code:500,message:'api_keys row missing tenant'}});return;}" +
    // Resolve the service user. Old rows might be missing
    // service_user_id (legacy / pre-T-05). Refuse with a clear
    // message — re-issue the key.
    "var _svcId=String(_getR(_rec,'service_user_id')||'');" +
    "var _svcEmail=String(_getR(_rec,'service_user_email')||'');" +
    "if(!_svcId||!_svcEmail){" +
        "_reply(409,{ok:false,legacy:true,error:{code:409,message:'key predates the T-05 redesign — re-issue it from the admin UI'}});" +
        "return;" +
    "}" +
    // Self-heal membership (handles pre-T-02 keys whose service user
    // doesn't have a user_tenants row).
    "try{_ensureSvcMembership(_svcId,_tenantId);}catch(_eMem){}" +
    // Load the service user, mint a fresh JWT.
    "var _svcRec=null;" +
    "try{_svcRec=$app.findRecordById('users',_svcId);}catch(_eSvc){}" +
    "if(!_svcRec){_reply(500,{ok:false,error:{code:500,message:'service user missing — re-issue the key'}});return;}" +
    "var _token='';" +
    "try{_token=String(_svcRec.newAuthToken()||'');}catch(_eTok){_reply(500,{ok:false,error:{code:500,message:'token mint failed: '+(_eTok&&_eTok.message||_eTok)}});return;}" +
    "if(!_token){_reply(500,{ok:false,error:{code:500,message:'token mint returned empty'}});return;}" +
    // Best-effort last_used update.
    "try{_rec.set('last_used',new Date().toISOString().replace('T',' ').replace(/\\..*$/,'Z'));$app.save(_rec);}catch(_eu){}" +
    "var _tenantOut=String(_getR(_rec,'tenant')||'');" +
    "var _permsOut=null;" +
    "try{var _pp=_getR(_rec,'permissions');if(_pp&&typeof _pp==='string')_permsOut=JSON.parse(_pp);else if(_pp)_permsOut=_pp;}catch(_ep2){}" +
    // Response shape — NO `password` field. The token is the only
    // thing the caller needs.
    "_reply(200,{" +
        "ok:true," +
        "tenant:_tenantOut," +
        "token:_token," +
        "record:{" +
            "id:_svcRec.id," +
            "email:_svcEmail" +
        "}," +
        "permissions:_permsOut," +
        "instructions:'Send the token as `Authorization: Bearer …` for /api/collections/* requests. The token is short-lived (PB default ~14 days); re-exchange when it expires.'" +
    "});";

routerAdd("POST", "/api/stjorna/api-keys/exchange", new Function("e", EXCHANGE_BODY));
console.log("[stjorna-apikeys] registered POST /api/stjorna/api-keys/exchange");

console.log("[stjorna-apikeys] all routes registered");
