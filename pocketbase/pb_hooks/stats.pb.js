// STJÓRNA v3 — per-tenant statistics
//
// Custom route:
//   GET /api/stjorna/stats[?tenant=<id>]
//
// Returns a single snapshot object per tenant:
//   - counts (categories, products, media, users)
//   - storage (sum of media.size, largest media, per-mime breakdown)
//   - activity (last 30 days)
//
// Auth (mirrors backup.pb.js IMPORT handler at L343-351):
//   - PB superuser (JWT type=admin) → can query any tenant via ?tenant=
//   - STJÓRN A user (JWT type=authRecord) → can query own tenant only.
//     The query param is IGNORED for tenant users so an admin can't
//     craft a URL that flips their view to someone else's tenant by
//     piggybacking on a tenant user's session.
//   - No bearer / unknown JWT → 401.
//
// Why server-side aggregation instead of FE-side getFullList + fold:
//   STJÓRN A's `media` collections can hold tens of thousands of rows
//   per tenant. Pulling every record just to sum `size` would chew
//   bandwidth + memory on both ends. One server-side scan over the
//   same rows gives us all five aggregates at once (sum, max, mime
//   map, count, activity timestamps) with one HTTP round-trip.
//
// PB 0.22.7 JSVM notes (same gotchas as api_keys.pb.js /
// backup.pb.js — handlers are string-concatenated and wrapped in
//   `new Function("c", BODY)` to dodge loader/executor VM closures):
//   - `findRecordsByFilter` JS bindings are flaky on this goja build.
//     Use `findRecordsByExpr(name)` then JS-side filter.
//   - Pass collection NAME (string) to `findRecordById`/`findCollectionByNameOrId`.
//   - Date fields come back as a goja time.Time wrapper, not a JS Date.
//     Normalise via `String(v).replace(' ', 'T')` then `Date.parse`.
//   - Row.get can throw on rows missing a field — wrap each access in
//     try/catch.

console.log("[stjorna-stats] loading");

// ---------------------------------------------------------------------------
// Shared helpers (inlined into the handler body)
// ---------------------------------------------------------------------------

var JSON_REPLY_FN =
    "function _reply(status,obj){" +
        "var body=JSON.stringify(obj);" +
        "c.response().header().set('Content-Type','application/json; charset=utf-8');" +
        "c.response().header().set('Cache-Control','no-store');" +
        "c.string(status,body);" +
    "}";

// Safe row.get — returns null if the field is missing or row is weird.
var GET_R_FN =
    "var _getR=function(_r,_k){try{if(_r&&typeof _r.get==='function')return _r.get(_k);}catch(_eg){}return null;};";

// Normalise a PB date field to ms. Returns 0 if unparseable.
// goja returns dates as a time.Time wrapper that:
//   - has .getTime() if the binder went the Date route, or
//   - toString()s as "YYYY-MM-DD HH:MM:SS.SSSZ" (with a space, not T).
// JS Date.parse can't handle the space, so swap first.
var DATE_MS_FN =
    "function _toMs(v){" +
        "if(v==null)return 0;" +
        "if(typeof v==='number')return v;" +
        "if(typeof v==='object'&&typeof v.getTime==='function'){" +
            "var g=v.getTime();" +
            "return isNaN(g)?0:g;" +
        "}" +
        "var s=String(v).replace(' ','T');" +
        "var p=Date.parse(s);" +
        "return isNaN(p)?0:p;" +
    "}";

// ---------------------------------------------------------------------------
// GET /api/stjorna/stats[?tenant=<id>]
// ---------------------------------------------------------------------------

var STATS_BODY = "" +
    JSON_REPLY_FN +
    GET_R_FN +
    DATE_MS_FN +
    // ---- Auth -----------------------------------------------------------
    "var _h=String(c.request().header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
    "if(!_h){_reply(401,{ok:false,error:{code:401,message:'missing bearer token'}});return;}" +
    "var _p={};try{_p=$security.parseUnverifiedJWT(_h)||{};}catch(_ea){_p={};}" +
    "var _authType=String(_p.type||'');" +
    "var _authId=String(_p.id||'');" +
    "if(_authType!=='admin'&&_authType!=='authRecord'){" +
        "_reply(401,{ok:false,error:{code:401,message:'unrecognized token type'}});return;" +
    "}" +
    // ---- Resolve target tenant -----------------------------------------
    // Admin: must supply ?tenant=<id>. We DO NOT default to anything — that
    // would let an admin accidentally see all tenants' stats at once.
    // Tenant user: derive from their own users record, ignore ?tenant=.
    "var _tenantId='';" +
    "var _userTenant='';" +
    "if(_authType==='admin'){" +
        "_tenantId=String(c.queryParam('tenant')||'').trim();" +
        "if(!_tenantId){_reply(400,{ok:false,error:{code:400,message:'tenant query param is required for admin callers'}});return;}" +
        "_userTenant=_tenantId;" +
    "}else{" +
    // Tenant user. Tenant membership lives in the `user_tenants` join
    // collection (NOT on the users row — STJÓRN A's `users` collection
    // is PB's built-in `_pb_users_auth_`, where every non-auth schema
    // field is silently dropped on create). For users in multiple
    // tenants, the `last_tenant` field on the auth record (written by
    // STJÓRN A's switchTenant) is the tiebreaker.
    "if(!_authId){_reply(401,{ok:false,error:{code:401,message:'token missing record id'}});return;}" +
    "var _lastTenant='';" +
    "try{var _au=$app.dao().findRecordById('_pb_users_auth_',_authId);_lastTenant=String(_getR(_au,'last_tenant')||'');}catch(_eau){}" +
    "var _userTenants=null;" +
    "try{_userTenants=$app.dao().findRecordsByExpr('user_tenants')||[];}catch(_eut){_userTenants=[];}" +
    "var _memberships=[];" +
    "for(var _mi2=0;_mi2<_userTenants.length;_mi2++){" +
        "var _ut=_userTenants[_mi2];" +
        "if(!_ut)continue;" +
        "if(String(_getR(_ut,'user'))===_authId)_memberships.push(String(_getR(_ut,'tenant')||''));" +
    "}" +
    // Dedup + drop empties.
    "var _seen={};var _unique=[];" +
    "for(var _ui=0;_ui<_memberships.length;_ui++){var _t=_memberships[_ui];if(_t&&!_seen[_t]){_seen[_t]=1;_unique.push(_t);}}" +
    "if(_unique.length===0){_reply(403,{ok:false,error:{code:403,message:'user has no tenant membership'}});return;}" +
    // Resolve: prefer last_tenant if it's a real membership.
    "if(_lastTenant&&_seen[_lastTenant]){" +
        "_userTenant=_lastTenant;" +
    "}else{" +
        "_userTenant=_unique[0];" +
    "}" +
    // Hardening: if a tenant user passes ?tenant=<other>, force 403.
    // Stops a UI bug or bookmarked URL from leaking cross-tenant data.
    "var _reqTenant=String(c.queryParam('tenant')||'').trim();" +
    "if(_reqTenant&&_reqTenant!==_userTenant){" +
        "_reply(403,{ok:false,error:{code:403,message:'cannot query stats for a different tenant'}});return;" +
    "}" +
    "_tenantId=_userTenant;" +
    "}" +
    // ---- Verify tenant exists ------------------------------------------
    "var _tenant=null;" +
    "try{_tenant=$app.dao().findRecordById('tenants',_tenantId);}catch(_et){_reply(404,{ok:false,error:{code:404,message:'tenant not found'}});return;}" +
    "if(!_tenant){_reply(404,{ok:false,error:{code:404,message:'tenant not found'}});return;}" +
    // ---- Helpers for the aggregation loop ------------------------------
    // Safe per-collection fetch. `findRecordsByExpr` returns ALL rows; we
    // post-filter by `tenant` in JS. Cheap on STJÓRN A's typical tenant
    // sizes; for very large tenants this should become a rollup table.
    "function _loadAll(name){" +
        "try{return $app.dao().findRecordsByExpr(name)||[];}" +
        "catch(_e){console.log('[stjorna-stats] '+name+' fetch failed: '+(_e&&(_e.message||_e)));return [];}" +
    "}" +
    "function _byTenant(rows,id){" +
        "var out=[];" +
        "if(!rows)return out;" +
        "for(var i=0;i<rows.length;i++){" +
            "var r=rows[i];" +
            "if(!r)continue;" +
            "if(String(_getR(r,'tenant'))===id)out.push(r);" +
        "}" +
        "return out;" +
    "}" +
    // ---- Fetch all relevant collections --------------------------------
    "var _cats=_byTenant(_loadAll('categories'),_tenantId);" +
    "var _prods=_byTenant(_loadAll('products'),_tenantId);" +
    "var _mediaRows=_byTenant(_loadAll('media'),_tenantId);" +
    // Tenant user count comes from `user_tenants`, NOT `users` — STJÓRN A's
    // `users` collection is PB's built-in `_pb_users_auth_`, where every
    // non-auth field (including `tenant`) is silently dropped on create.
    // Tenant membership is tracked in the `user_tenants` join table (see
    // frontend/src/stores/auth.ts:loadTenants). PB superusers live in
    // `_admins` and are intentionally NOT counted per-tenant — they have
    // cross-tenant access and adding them to every tenant's user count
    // would mislead.
    "var _userMemberships=_byTenant(_loadAll('user_tenants'),_tenantId);" +
    // ---- Storage aggregation -------------------------------------------
    "var _mediaBytes=0;" +
    "var _largest=null;" +
    "var _mimeMap={};" + // { mime: { count, bytes } }
    "var _mediaCount=_mediaRows.length;" +
    "for(var _mi=0;_mi<_mediaRows.length;_mi++){" +
        "var _mr=_mediaRows[_mi];" +
        "var _sz=0;try{var _n=_getR(_mr,'size');if(_n)_sz=Number(_n)||0;}catch(_esm){}" +
        "if(_sz<0||!isFinite(_sz))_sz=0;" +
        "var _mime='';try{_mime=String(_getR(_mr,'mime_type')||'');}catch(_emm){}" +
        "if(!_mime)_mime='application/octet-stream';" +
        "if(!_mimeMap[_mime])_mimeMap[_mime]={count:0,bytes:0};" +
        "_mimeMap[_mime].count+=1;" +
        "_mimeMap[_mime].bytes+=_sz;" +
        "_mediaBytes+=_sz;" +
        "if(!_largest||_sz>_largest.bytes){" +
            "_largest={id:_mr.id,filename:'',bytes:_sz,mime_type:_mime};" +
            "try{_largest.filename=String(_getR(_mr,'filename')||_getR(_mr,'original_name')||'');}catch(_efm){}" +
        "}" +
    "}" +
    // ---- Per-mime breakdown (sorted by bytes desc) ---------------------
    "var _byMime=[];" +
    "for(var _mk in _mimeMap){" +
        "if(Object.prototype.hasOwnProperty.call(_mimeMap,_mk)){" +
            "_byMime.push({mime_type:_mk,count:_mimeMap[_mk].count,bytes:_mimeMap[_mk].bytes});" +
        "}" +
    "}" +
    "_byMime.sort(function(a,b){return b.bytes-a.bytes;});" +
    // ---- Activity (last 30 days) ---------------------------------------
    "var _nowMs=Date.now();" +
    "var _windowMs=30*24*60*60*1000;" +
    "var _cutoff=_nowMs-_windowMs;" +
    "var _prodCreated=0,_prodUpdated=0;" +
    "var _catCreated=0;" +
    "var _mediaUploaded=0;" +
    "for(var _pi=0;_pi<_prods.length;_pi++){" +
        "var _pr=_prods[_pi];" +
        "if(_toMs(_getR(_pr,'created'))>=_cutoff)_prodCreated++;" +
        "var _upd=_toMs(_getR(_pr,'updated'));" +
        "if(_upd>=_cutoff&&_upd!==_toMs(_getR(_pr,'created')))_prodUpdated++;" +
    "}" +
    "for(var _ci=0;_ci<_cats.length;_ci++){" +
        "if(_toMs(_getR(_cats[_ci],'created'))>=_cutoff)_catCreated++;" +
    "}" +
    "for(var _mdi=0;_mdi<_mediaRows.length;_mdi++){" +
        "if(_toMs(_getR(_mediaRows[_mdi],'created'))>=_cutoff)_mediaUploaded++;" +
    "}" +
    // ---- Build response -------------------------------------------------
    "var _avg=(_mediaCount>0)?Math.round(_mediaBytes/_mediaCount):0;" +
    "var _plan='free';" +
    "try{_plan=String(_getR(_tenant,'plan')||'free');}catch(_ep){}" +
    "var _resp={" +
        "ok:true," +
        "tenant:{" +
            "id:_tenant.id," +
            "name:(function(){try{return String(_getR(_tenant,'name')||'');}catch(_en){return '';}})()," +
            "slug:(function(){try{return String(_getR(_tenant,'slug')||'');}catch(_esl){return '';}})()," +
            "plan:_plan," +
            "custom_domain:(function(){try{return String(_getR(_tenant,'custom_domain')||'');}catch(_ecd){return '';}})()" +
        "}," +
        "counts:{" +
            "categories:_cats.length," +
            "products:_prods.length," +
            "media:_mediaCount," +
            "users:_userMemberships.length" +
        "}," +
        "storage:{" +
            "media_bytes:_mediaBytes," +
            "media_count:_mediaCount," +
            "avg_media_bytes:_avg," +
            "largest_media:_largest," +
            "by_mime_type:_byMime" +
        "}," +
        "activity_30d:{" +
            "products_created:_prodCreated," +
            "products_updated:_prodUpdated," +
            "media_uploaded:_mediaUploaded," +
            "categories_created:_catCreated" +
        "}," +
        "generated_at:new Date().toISOString()" +
    "};" +
    "_reply(200,_resp);";

routerAdd("GET", "/api/stjorna/stats", new Function("c", STATS_BODY));
console.log("[stjorna-stats] registered GET /api/stjorna/stats");
