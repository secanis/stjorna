// STJÓRNA v3 — backup & restore routes
//
// Three custom routes:
//   GET  /api/backup/json   — admin only, full data manifest
//   GET  /api/backup/zip    — admin only, manifest + media files as ZIP
//   POST /api/backup/import — admin or tenant-admin, body is JSON
//                              { tenant, source, data_base64 }
//                              source = "v1" (old STJÓRNA JSON) or
//                                       "v3" (v3 JSON or ZIP, base64)
//                              data_base64 = base64(file content)
//
// Notes on v0.22.7 JSVM:
//   - c is an echo.Context. c.request() is *http.Request.
//   - c.response() is *echo.Response. Use c.response().header().set().
//   - c.string(200, str), c.blob(200, contentType, []byte) for responses.
//   - c.queryParam(name) for query params.
//   - readerToString(r, maxBytes) reads an io.Reader into a JS string.
//   - $app.dao() for DB access.
//   - $os.readFile(path) returns []byte (Uint8Array-like in goja).
//   - $security.parseUnverifiedJWT(token) decodes JWT payload safely.
//
// All handlers are inlined as `new Function("c", BODY)` to avoid the
// loader/executor VM closure issue (see openapi.pb.js for the pattern).

console.log("[stjorna-backup] loading");

// ---------------------------------------------------------------------------
// Helpers (string-concatenated into each handler body that needs them)
// ---------------------------------------------------------------------------

var B64_DECODE_FN =
    "var _B='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';" +
    "var _L={};var _i=0;while(_i<_B.length){_L[_B[_i]]=_i;_i=_i+1;}" +
    "function b64decode(s){" +
        "s=String(s).replace(/[^A-Za-z0-9+/=]/g,'');" +
        "while(s.length%4)s=s+'=';" +
        "var out=[];var buf=0;var bits=0;var j=0;" +
        "while(j<s.length){" +
            "var ch=s[j];j=j+1;" +
            "if(ch==='=')break;" +
            "var v=_L[ch];if(v===undefined)continue;" +
            "buf=(buf<<6)|v;bits=bits+6;" +
            "if(bits>=8){bits=bits-8;out.push((buf>>bits)&0xFF);}" +
        "}return out;" +
    "}";

var SLUGIFY_FN =
    "function _slugify(s){" +
        "return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,100);" +
    "}";

// UTF-8 decoder (pure JS). goja's String.fromCharCode treats each byte as
// a Latin-1 char, which mangles UTF-8 multi-byte sequences (e.g. 0xC3 0xA4
// for "ä" becomes "Ã¤"). This decoder emits proper code points including
// surrogate pairs for codepoints > 0xFFFF (emoji, supplementary plane).
var UTF8_DECODE_FN =
    "function _bytesToUtf8(b){" +
        "var out='';" +
        "var i=0;" +
        "while(i<b.length){" +
            "var c=b[i]&0xFF;" +
            "if(c<0x80){out+=String.fromCharCode(c);i=i+1;continue;}" +
            "var need=0;" +
            "if((c&0xE0)===0xC0){need=1;c=c&0x1F;}" +
            "else if((c&0xF0)===0xE0){need=2;c=c&0x0F;}" +
            "else if((c&0xF8)===0xF0){need=3;c=c&0x07;}" +
            "else{out+=String.fromCharCode(0xFFFD);i=i+1;continue;}" +
            "if(i+need>=b.length){out+=String.fromCharCode(0xFFFD);break;}" +
            "var ok=true;" +
            "for(var k=0;k<need;k++){" +
                "var n=b[i+1+k];" +
                "if((n&0xC0)!==0x80){ok=false;break;}" +
                "c=(c<<6)|(n&0x3F);" +
            "}" +
            "if(!ok){out+=String.fromCharCode(0xFFFD);i=i+1;continue;}" +
            "if(c>0xFFFF){" +
                "c=c-0x10000;" +
                "out+=String.fromCharCode(0xD800+(c>>10));" +
                "out+=String.fromCharCode(0xDC00+(c&0x3FF));" +
            "}else{" +
                "out+=String.fromCharCode(c);" +
            "}" +
            "i=i+need+1;" +
        "}" +
        "return out;" +
    "}";

var JSON_HELPER_FN =
    "function J(v){" +
        "if(v===undefined||v===null)return '{}';" +
        "if(typeof v==='string')return v;" +
        "return JSON.stringify(v);" +
    "}";

var STR_TO_BYTES_FN =
    "function _strToBytes(s){" +
        "var b=new Array(s.length);" +
        "for(var i=0;i<s.length;i++)b[i]=s.charCodeAt(i)&0xFF;" +
        "return b;" +
    "}" +
    // UTF-8 encode a JS string (UTF-16) to bytes. Inverse of _bytesToUtf8.
    "function _strToUtf8Bytes(s){" +
        "var b=[];" +
        "for(var i=0;i<s.length;i++){" +
            "var c=s.charCodeAt(i);" +
            "if(c>=0xD800&&c<=0xDBFF&&i+1<s.length){" +
                "var c2=s.charCodeAt(i+1);" +
                "if(c2>=0xDC00&&c2<=0xDFFF){" +
                    "c=0x10000+((c&0x3FF)<<10)+(c2&0x3FF);" +
                    "i=i+1;" +
                "}" +
            "}" +
            "if(c<0x80){b.push(c);}" +
            "else if(c<0x800){b.push(0xC0|(c>>6));b.push(0x80|(c&0x3F));}" +
            "else if(c<0x10000){b.push(0xE0|(c>>12));b.push(0x80|((c>>6)&0x3F));b.push(0x80|(c&0x3F));}" +
            "else{" +
                // c is the full codepoint (U+10000..U+10FFFF).
                // Split 21 bits as: 3 (top) + 6 + 6 + 6 from MSB to LSB.
                "b.push(0xF0|((c>>18)&0x07));" +
                "b.push(0x80|((c>>12)&0x3F));" +
                "b.push(0x80|((c>>6)&0x3F));" +
                "b.push(0x80|(c&0x3F));" +
            "}" +
        "}" +
        "return b;" +
    "}" +
    "function _w32(a,o,v){a[o]=v&0xFF;a[o+1]=(v>>>8)&0xFF;a[o+2]=(v>>>16)&0xFF;a[o+3]=(v>>>24)&0xFF;}" +
    "function _w16(a,o,v){a[o]=v&0xFF;a[o+1]=(v>>>8)&0xFF;}" +
    // JSON-encode a value for PB's json-typed fields (custom_fields).
    //   - undefined/null  -> '{}' (fallback to empty)
    //   - string          -> pass through (PB's JsonMap unmarshals JSON strings)
    //   - object/array    -> JSON.stringify (the defensive case: prevents
    //                         goja's implicit toString() fallback that would
    //                         store the literal "[object Object]" in the column)
    "function J(v){" +
        "if(v===undefined||v===null)return '{}';" +
        "if(typeof v==='string')return v;" +
        "return JSON.stringify(v);" +
    "}";

// auth snippet: reads Authorization header, decodes JWT, sets `authType`.
// If type is not in allowedTypes, returns 401 and stops execution (uses `return;`).
function authCheckSnippet(allowedTypes) {
    return "" +
        "var _h=String(c.request().header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
        "var _p={};" +
        "if(_h.length>0){" +
            "try{_p=$security.parseUnverifiedJWT(_h)||{};}catch(_e){_p={};}" +
        "}" +
        "var authType=_p.type||'';" +
        "var authId=_p.id||'';" +
        "if(" + JSON.stringify(allowedTypes) + ".indexOf(authType)<0){" +
            "c.response().header().set('Content-Type','application/json; charset=utf-8');" +
            "c.string(401,'{\"error\":\"unauthorized\"}');" +
            "return;" +
        "}";
}

// manifest builder: queries each collection and exports all records.
// Defines `manifest` JS object with shape { version, kind, schema_version,
// exported_at, collections: { <name>: [record, ...] } }.
var COLLECTION_NAMES = [
    "tenants",
    "roles",
    "user_tenants",
    "users",
    "categories",
    "products",
    "media",
    "product_media",
    "webhooks",
    "embed_configs",
    "instance_settings",
    "settings",
];

function manifestSnippet() {
    return "" +
        "var _cols=" + JSON.stringify(COLLECTION_NAMES) + ";" +
        "var manifest={" +
            "version:'3.0.0'," +
            "kind:'stjorna-backup'," +
            "schema_version:1," +
            "exported_at:new Date().toISOString()," +
            "collections:{}" +
        "};" +
        "for(var _i=0;_i<_cols.length;_i++){" +
            "var _n=_cols[_i];" +
            "var _arr=[];" +
            "try{" +
                "var _recs=$app.dao().findRecordsByExpr(_n);" +
                "for(var _r=0;_r<_recs.length;_r++){" +
                    "var _rec=_recs[_r];" +
                    "var _exp={};" +
                    "try{_exp=_rec.publicExport();}catch(_e){continue;}" +
                    "_exp.id=_rec.id;" +
                    "_arr.push(_exp);" +
                "}" +
            "}catch(_e){console.log('[stjorna-backup] collection '+_n+' read failed: '+_e);}" +
            "manifest.collections[_n]=_arr;" +
        "}";
}

// ---------------------------------------------------------------------------
// GET /api/backup/json
// ---------------------------------------------------------------------------
var JSON_BODY = "" +
    authCheckSnippet(["admin"]) +
    manifestSnippet() +
    "var _body=JSON.stringify(manifest,null,2);" +
    "c.response().header().set('Content-Type','application/json; charset=utf-8');" +
    "c.response().header().set('Content-Disposition','attachment; filename=\"stjorna-backup-' + Date.now() + '.json\"');" +
    "c.string(200,_body);";

routerAdd("GET", "/api/backup/json", new Function("c", JSON_BODY));
console.log("[stjorna-backup] registered GET /api/backup/json");

// ---------------------------------------------------------------------------
// GET /api/backup/zip
// ---------------------------------------------------------------------------
// Builds a STORE-method ZIP containing manifest.json + each media file
// at media/<id>/<filename>.

var ZIP_BODY = "" +
    authCheckSnippet(["admin"]) +
    manifestSnippet() +
    "var manifestStr=JSON.stringify(manifest,null,2);" +
    // CRC32
    "var _crcTab=[];for(var _ci=0;_ci<256;_ci++){var _cv=_ci;for(var _ck=0;_ck<8;_ck++){_cv=((_cv&1)===1)?(0xEDB88320^(_cv>>>1)):(_cv>>>1);}_crcTab[_ci]=_cv>>>0;}" +
    "function _crc32(_buf,_off,_len){var _c=0xFFFFFFFF;for(var _k=0;_k<_len;_k++){_c=_crcTab[(_c^_buf[_off+_k])&0xFF]^(_c>>>8);}return (_c^0xFFFFFFFF)>>>0;}" +
    STR_TO_BYTES_FN +
    "var _entries=[];" +
    // 1. manifest.json
    "(function(){" +
        "var _b=_strToUtf8Bytes(manifestStr);" +
        "var _c=_crc32(_b,0,_b.length);" +
        "_entries.push({name:'manifest.json',data:_b,crc:_c,size:_b.length});" +
    "})();" +
    // 2. media files
    "(function(){" +
        "var _media=manifest.collections.media||[];" +
        "for(var _i=0;_i<_media.length;_i++){" +
            "var _m=_media[_i];" +
            "var _files=_m.file||[];" +
            "if(!Array.isArray(_files))_files=[_files];" +
            "for(var _fi=0;_fi<_files.length;_fi++){" +
                "var _fn=_files[_fi];" +
                "if(!_fn)continue;" +
                "var _path='pb_data/storage/media/'+_m.id+'/'+_fn;" +
                "var _buf=null;" +
                "try{_buf=$os.readFile(_path);}catch(_re){console.log('[stjorna-backup] media '+_path+' read failed: '+_re);}" +
                "if(!_buf||!_buf.length)continue;" +
                "var _c2=_crc32(_buf,0,_buf.length);" +
                "_entries.push({name:'media/'+_m.id+'/'+_fn,data:_buf,crc:_c2,size:_buf.length});" +
            "}" +
        "}" +
    "})();" +
    // Build ZIP (STORE method)
    "(function(){" +
        "var _localParts=[];" +
        "var _centralParts=[];" +
        "var _localOffset=0;" +
        "for(var _ei=0;_ei<_entries.length;_ei++){" +
            "var _e=_entries[_ei];" +
            "var _nameBytes=_strToUtf8Bytes(_e.name);" +
            "var _nameLen=_nameBytes.length;" +
            "var _lfh=new Array(30+_nameLen);" +
            "_w32(_lfh,0,0x04034b50);" +
            "_w16(_lfh,4,20);" +
            "_w16(_lfh,6,0);" +
            "_w16(_lfh,8,0);" +
            "_w16(_lfh,10,0);" +
            "_w16(_lfh,12,0);" +
            "_w32(_lfh,14,_e.crc);" +
            "_w32(_lfh,18,_e.size);" +
            "_w32(_lfh,22,_e.size);" +
            "_w16(_lfh,26,_nameLen);" +
            "_w16(_lfh,28,0);" +
            "for(var _nbi=0;_nbi<_nameLen;_nbi++)_lfh[30+_nbi]=_nameBytes[_nbi];" +
            "_localParts.push(_lfh);" +
            "_localParts.push(_e.data);" +
            "var _cd=new Array(46+_nameLen);" +
            "_w32(_cd,0,0x02014b50);" +
            "_w16(_cd,4,20);" +
            "_w16(_cd,6,20);" +
            "_w16(_cd,8,0);" +
            "_w16(_cd,10,0);" +
            "_w16(_cd,12,0);" +
            "_w16(_cd,14,0);" +
            "_w32(_cd,16,_e.crc);" +
            "_w32(_cd,20,_e.size);" +
            "_w32(_cd,24,_e.size);" +
            "_w16(_cd,28,_nameLen);" +
            "_w16(_cd,30,0);" +
            "_w16(_cd,32,0);" +
            "_w16(_cd,34,0);" +
            "_w16(_cd,36,0);" +
            "_w32(_cd,38,0);" +
            "_w32(_cd,42,_localOffset);" +
            "for(var _nci=0;_nci<_nameLen;_nci++)_cd[46+_nci]=_nameBytes[_nci];" +
            "_centralParts.push(_cd);" +
            "_localOffset+=_lfh.length+_e.data.length;" +
        "}" +
        "var _cdSize=0;for(var _zi=0;_zi<_centralParts.length;_zi++)_cdSize+=_centralParts[_zi].length;" +
        "var _eocd=new Array(22);" +
        "_w32(_eocd,0,0x06054b50);" +
        "_w16(_eocd,4,0);" +
        "_w16(_eocd,6,0);" +
        "_w16(_eocd,8,_entries.length);" +
        "_w16(_eocd,10,_entries.length);" +
        "_w32(_eocd,12,_cdSize);" +
        "_w32(_eocd,16,_localOffset);" +
        "_w16(_eocd,20,0);" +
        "var _total=_localOffset+_cdSize+22;" +
        "var _zip=new Array(_total);" +
        "var _pos=0;" +
        "for(var _zi2=0;_zi2<_localParts.length;_zi2++){for(var _zi3=0;_zi3<_localParts[_zi2].length;_zi3++)_zip[_pos++]=_localParts[_zi2][_zi3];}" +
        "for(var _zi4=0;_zi4<_centralParts.length;_zi4++){for(var _zi5=0;_zi5<_centralParts[_zi4].length;_zi5++)_zip[_pos++]=_centralParts[_zi4][_zi5];}" +
        "for(var _zi6=0;_zi6<22;_zi6++)_zip[_pos++]=_eocd[_zi6];" +
        "c.response().header().set('Content-Disposition','attachment; filename=\"stjorna-backup-' + Date.now() + '.zip\"');" +
        "c.blob(200,'application/zip',_zip);" +
    "})();";

routerAdd("GET", "/api/backup/zip", new Function("c", ZIP_BODY));
console.log("[stjorna-backup] registered GET /api/backup/zip");

// ---------------------------------------------------------------------------
// POST /api/backup/import
// ---------------------------------------------------------------------------
// Request body: JSON
//   { tenant: "<id>", source: "v1"|"v3", filename: "...", data_base64: "..." }

var IMPORT_BODY = B64_DECODE_FN + SLUGIFY_FN + STR_TO_BYTES_FN + UTF8_DECODE_FN + JSON_HELPER_FN + "try{" +
    "var _rawBody='';" +
    "try{_rawBody=readerToString(c.request().body,64*1024*1024);}catch(_be){c.string(400,'{\"error\":\"read body failed\"}');return;}" +
    "var _req=null;" +
    "try{_req=JSON.parse(_rawBody);}catch(_je){c.string(400,'{\"error\":\"invalid JSON body\"}');return;}" +
    "var _tenantId=String(_req.tenant||'');" +
    "var _source=String(_req.source||'v3');" +
    "if(!_tenantId){c.string(400,'{\"error\":\"tenant required\"}');return;}" +
    "if(_source!=='v1'&&_source!=='v3'){c.string(400,'{\"error\":\"source must be v1 or v3\"}');return;}" +
    // Auth
    "var _h=String(c.request().header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
    "var _p={};" +
    "if(_h.length>0){try{_p=$security.parseUnverifiedJWT(_h)||{};}catch(_e){_p={};}}" +
    "var _allowed=false;" +
    "if(_p.type==='admin'){_allowed=true;}" +
    "else if(_p.type==='authRecord'&&_p.id){" +
        "try{var _ur=$app.dao().findRecordById('users',_p.id);if(_ur.get('tenant')===_tenantId&&_ur.get('role')==='admin')_allowed=true;}catch(_ue){}" +
    "}" +
    "if(!_allowed){c.string(403,'{\"error\":\"forbidden: admin of target tenant required\"}');return;}" +
    // Verify tenant
    "try{$app.dao().findRecordById('tenants',_tenantId);}catch(_te){c.string(404,'{\"error\":\"tenant not found\"}');return;}" +
    // Decode file content
    "var _fileBytes=null;" +
    "if(_req.data_base64){_fileBytes=b64decode(String(_req.data_base64));}" +
    "var _manifest=null;" +
    "var _zipFiles={};" +
    "if(_req.manifest){_manifest=_req.manifest;}" +
    "if(_fileBytes&&_fileBytes.length>0){" +
        "var _asStr=_bytesToUtf8(_fileBytes);" +
        // ZIP detection
        "if(_fileBytes[0]===0x50&&_fileBytes[1]===0x4B&&_fileBytes[2]===0x03&&_fileBytes[3]===0x04){" +
            // ZIP reader (STORE only, single disk, no zip64)
            "var _eocdOff=-1;" +
            "var _minBack=Math.max(0,_fileBytes.length-65557);" +
            "for(var _i=_fileBytes.length-22;_i>=_minBack;_i--){" +
                "if(_i<0)break;" +
                "if(_fileBytes[_i]===0x50&&_fileBytes[_i+1]===0x4B&&_fileBytes[_i+2]===0x05&&_fileBytes[_i+3]===0x06){_eocdOff=_i;break;}" +
            "}" +
            "if(_eocdOff<0){c.string(400,'{\"error\":\"invalid ZIP: EOCD not found\"}');return;}" +
            "var _cdCount=(_fileBytes[_eocdOff+10]&0xFF)|((_fileBytes[_eocdOff+11]&0xFF)<<8);" +
            "var _cdOff=((_fileBytes[_eocdOff+16]&0xFF)|((_fileBytes[_eocdOff+17]&0xFF)<<8)|((_fileBytes[_eocdOff+18]&0xFF)<<16)|((_fileBytes[_eocdOff+19]&0xFF)<<24))>>>0;" +
            "if(_cdOff>=_fileBytes.length){c.string(400,'{\"error\":\"invalid ZIP: CD out of bounds\"}');return;}" +
            "var _p2=_cdOff;" +
            "for(var _fi=0;_fi<_cdCount;_fi++){" +
                "if(_p2+46>_fileBytes.length)break;" +
                "if(_fileBytes[_p2]!==0x50||_fileBytes[_p2+1]!==0x4B||_fileBytes[_p2+2]!==0x01||_fileBytes[_p2+3]!==0x02)break;" +
                "var _compMethod=(_fileBytes[_p2+10]&0xFF)|((_fileBytes[_p2+11]&0xFF)<<8);" +
                "var _compSize=((_fileBytes[_p2+20]&0xFF)|((_fileBytes[_p2+21]&0xFF)<<8)|((_fileBytes[_p2+22]&0xFF)<<16)|((_fileBytes[_p2+23]&0xFF)<<24))>>>0;" +
                "var _nameLen=(_fileBytes[_p2+28]&0xFF)|((_fileBytes[_p2+29]&0xFF)<<8);" +
                "var _extraLen=(_fileBytes[_p2+30]&0xFF)|((_fileBytes[_p2+31]&0xFF)<<8);" +
                "var _commentLen=(_fileBytes[_p2+32]&0xFF)|((_fileBytes[_p2+33]&0xFF)<<8);" +
                "var _localOff=((_fileBytes[_p2+42]&0xFF)|((_fileBytes[_p2+43]&0xFF)<<8)|((_fileBytes[_p2+44]&0xFF)<<16)|((_fileBytes[_p2+45]&0xFF)<<24))>>>0;" +
                "var _nameBytes=_fileBytes.slice(_p2+46,_p2+46+_nameLen);var _name=_bytesToUtf8(_nameBytes);" +
                "_p2+=46+_nameLen+_extraLen+_commentLen;" +
                "if(_localOff+30<=_fileBytes.length&&_compMethod===0){" +
                    "var _lfhNameLen=(_fileBytes[_localOff+26]&0xFF)|((_fileBytes[_localOff+27]&0xFF)<<8);" +
                    "var _lfhExtraLen=(_fileBytes[_localOff+28]&0xFF)|((_fileBytes[_localOff+29]&0xFF)<<8);" +
                    "var _fileStart=_localOff+30+_lfhNameLen+_lfhExtraLen;" +
                    "if(_fileStart+_compSize<=_fileBytes.length){" +
                        "var _fileData=_fileBytes.slice(_fileStart,_fileStart+_compSize);" +
                        "_zipFiles[_name]=_fileData;" +
                    "}" +
                "}" +
            "}" +
            "if(!_zipFiles['manifest.json']){c.string(400,'{\"error\":\"ZIP missing manifest.json\"}');return;}" +
            "var _mStr=_bytesToUtf8(_zipFiles['manifest.json']);" +
            "try{_manifest=JSON.parse(_mStr);}catch(_me){c.string(400,'{\"error\":\"invalid manifest.json in ZIP\"}');return;}" +
        "}else{" +
            "try{_manifest=JSON.parse(_asStr);}catch(_je2){c.string(400,'{\"error\":\"file is not JSON or ZIP\"}');return;}" +
        "}" +
    "}" +
    // Merge in mediaFiles
    "if(_req.mediaFiles){" +
        "for(var _mfk in _req.mediaFiles){" +
            "if(_req.mediaFiles[_mfk]&&_req.mediaFiles[_mfk].data_base64){" +
                "_zipFiles[_mfk]=b64decode(String(_req.mediaFiles[_mfk].data_base64));" +
            "}" +
        "}" +
    "}" +
    "if(!_manifest){c.string(400,'{\"error\":\"no manifest in request or file\"}');return;}" +
    // Run import
    "var _stats={imported:{categories:0,products:0,media:0},skipped:{categories:0,products:0,media:0},warnings:[]};" +
    "if(_source==='v1'){" +
        "var _v1Cats=_manifest.categories||[];" +
        "var _v1Prods=_manifest.products||[];" +
        "var _oldIdToNewId={};" +
        "for(var _ci=0;_ci<_v1Cats.length;_ci++){" +
            "var _vc=_v1Cats[_ci];" +
            "var _slug=_slugify(_vc.name||'category');" +
            "if(!_slug)_slug='category-'+_ci;" +
            "var _exists=null;" +
            "try{_exists=$app.dao().findFirstRecordByFilter('categories','tenant={:t} && slug={:s}',{t:_tenantId,s:_slug});}catch(_fe){}" +
            "if(_exists){_oldIdToNewId[_vc._id]=_exists.id;_stats.skipped.categories++;continue;}" +
            "var _nrec=new Record($app.dao().findCollectionByNameOrId('categories'));" +
            "_nrec.set('tenant',_tenantId);" +
            "_nrec.set('name',_vc.name||'Untitled');" +
            "_nrec.set('slug',_slug);" +
            "_nrec.set('description',_vc.description||'');" +
            "_nrec.set('active',_vc.active!==false);" +
            "_nrec.set('sort_order',0);" +
            "try{$app.dao().saveRecord(_nrec);_oldIdToNewId[_vc._id]=_nrec.id;_stats.imported.categories++;}catch(_se){_stats.warnings.push('category failed: '+(_vc.name||'?')+' ('+_se.message+')');}" +
        "}" +
        "for(var _pi=0;_pi<_v1Prods.length;_pi++){" +
            "var _vp=_v1Prods[_pi];" +
            "var _newCatId=_oldIdToNewId[_vp.category]||'';" +
            "if(_vp.category&&!_newCatId){_stats.warnings.push('product category missing: '+(_vp.name||'?'));}" +
            "var _pslug=_slugify(_vp.name||'product');" +
            "if(!_pslug)_pslug='product-'+_pi;" +
            "var _pexists=null;" +
            "try{_pexists=$app.dao().findFirstRecordByFilter('products','tenant={:t} && slug={:s}',{t:_tenantId,s:_pslug});}catch(_pe){}" +
            "if(_pexists){_stats.skipped.products++;continue;}" +
            "var _prec=new Record($app.dao().findCollectionByNameOrId('products'));" +
            "_prec.set('tenant',_tenantId);" +
            "_prec.set('name',_vp.name||'Untitled');" +
            "_prec.set('slug',_pslug);" +
            "_prec.set('price',typeof _vp.price==='number'?_vp.price:0);" +
            "_prec.set('description',_vp.description||'');" +
            "_prec.set('category',_newCatId);" +
            "_prec.set('active',_vp.active!==false);" +
            "_prec.set('sort_order',0);" +
            "_prec.set('custom_fields',{});" +
            "try{$app.dao().saveRecord(_prec);_stats.imported.products++;}catch(_pse){_stats.warnings.push('product failed: '+(_vp.name||'?')+' ('+_pse.message+')');}" +
        "}" +
        "if(_v1Cats.some(function(c){return c.image;}))_stats.warnings.push('v1 category images were dropped (v3 has no category image field)');" +
    "}else{" +
        "var _vcats=(_manifest.collections&&_manifest.collections.categories)||_manifest.categories||[];" +
        "var _vprods=(_manifest.collections&&_manifest.collections.products)||_manifest.products||[];" +
        "var _vmedia=(_manifest.collections&&_manifest.collections.media)||_manifest.media||[];" +
        "var _oldCatToNew={};" +
        "for(var _ci2=0;_ci2<_vcats.length;_ci2++){" +
            "var _vc2=_vcats[_ci2];" +
            "var _slug2=_vc2.slug||_slugify(_vc2.name||'');" +
            "if(!_slug2)_slug2='category-'+_ci2;" +
            "var _exists2=null;" +
            "try{_exists2=$app.dao().findFirstRecordByFilter('categories','tenant={:t} && slug={:s}',{t:_tenantId,s:_slug2});}catch(_fe2){}" +
            "if(_exists2){_oldCatToNew[_vc2.id]=_exists2.id;_stats.skipped.categories++;continue;}" +
            "var _nrec2=new Record($app.dao().findCollectionByNameOrId('categories'));" +
            "_nrec2.set('tenant',_tenantId);" +
            "_nrec2.set('name',_vc2.name||'Untitled');" +
            "_nrec2.set('slug',_slug2);" +
            "_nrec2.set('description',_vc2.description||'');" +
            "_nrec2.set('active',_vc2.active!==false);" +
            "_nrec2.set('sort_order',_vc2.sort_order||0);" +
            "try{$app.dao().saveRecord(_nrec2);_oldCatToNew[_vc2.id]=_nrec2.id;_stats.imported.categories++;}catch(_se2){_stats.warnings.push('category failed: '+(_vc2.name||'?')+' ('+_se2.message+')');}" +
        "}" +
        "for(var _pi2=0;_pi2<_vprods.length;_pi2++){" +
            "var _vp2=_vprods[_pi2];" +
            "var _pslug2=_vp2.slug||_slugify(_vp2.name||'');" +
            "if(!_pslug2)_pslug2='product-'+_pi2;" +
            "var _pexists2=null;" +
            "try{_pexists2=$app.dao().findFirstRecordByFilter('products','tenant={:t} && slug={:s}',{t:_tenantId,s:_pslug2});}catch(_pe2){}" +
            "if(_pexists2){_stats.skipped.products++;continue;}" +
            "var _newCatId2=_oldCatToNew[_vp2.category]||'';" +
            "var _prec2=new Record($app.dao().findCollectionByNameOrId('products'));" +
            "_prec2.set('tenant',_tenantId);" +
            "_prec2.set('name',_vp2.name||'Untitled');" +
            "_prec2.set('slug',_pslug2);" +
            "_prec2.set('price',typeof _vp2.price==='number'?_vp2.price:0);" +
            "_prec2.set('description',_vp2.description||'');" +
            "_prec2.set('category',_newCatId2);" +
            "_prec2.set('active',_vp2.active!==false);" +
            "_prec2.set('sort_order',_vp2.sort_order||0);" +
            "_prec2.set('custom_fields',J(_vp2.custom_fields));" +
            "try{$app.dao().saveRecord(_prec2);_stats.imported.products++;}catch(_pse2){_stats.warnings.push('product failed: '+(_vp2.name||'?')+' ('+_pse2.message+')');}" +
        "}" +
        "var _hasMediaFiles=Object.keys(_zipFiles).length>0;" +
        "if(_hasMediaFiles){" +
            "for(var _mi=0;_mi<_vmedia.length;_mi++){" +
                "var _vm=_vmedia[_mi];" +
                "var _files3=_vm.file||[];" +
                "if(!Array.isArray(_files3))_files3=[_files3];" +
                "for(var _fmi=0;_fmi<_files3.length;_fmi++){" +
                    "var _fn3=_files3[_fmi];" +
                    "if(!_fn3)continue;" +
                    "var _path3='media/'+_vm.id+'/'+_fn3;" +
                    "if(!_zipFiles[_path3])continue;" +
                    "try{" +
                        "var _mrec=new Record($app.dao().findCollectionByNameOrId('media'));" +
                        "_mrec.set('tenant',_tenantId);" +
                        "_mrec.set('filename',_fn3);" +
                        "_mrec.set('original_name',_vm.original_name||_fn3);" +
                        "_mrec.set('mime_type',_vm.mime_type||'application/octet-stream');" +
                        "_mrec.set('size',_vm.size||_zipFiles[_path3].length);" +
                        "$app.dao().saveRecord(_mrec);" +
                        "var _fsysKey=_fn3;" +
                        "var _fsysId=_mrec.id;" +
                        "try{" +
                            "var _file=$filesystem.fileFromBytes(_fn3,_vm.mime_type||'application/octet-stream',_zipFiles[_path3]);" +
                            "$app.dao().saveRecord(_mrec,_file);" +
                        "}catch(_fse){" +
                            "try{" +
                                "var _writer=$app.dao().newFilesystem().upload(_fsysKey,_fsysId);" +
                                "for(var _ci4=0;_ci4<_zipFiles[_path3].length;_ci4++)_writer.write(new Array(_zipFiles[_path3][_ci4]));" +
                                "try{if(_writer.close)_writer.close();}catch(_wce){}" +
                            "}catch(_wfe){_stats.warnings.push('media write failed: '+_fn3+' ('+_wfe.message+')');}" +
                        "}" +
                        "_stats.imported.media++;" +
                    "}catch(_mse){_stats.warnings.push('media failed: '+_fn3+' ('+_mse.message+')');}" +
                "}" +
            "}" +
        "}" +
    "}" +
    "c.response().header().set('Content-Type','application/json; charset=utf-8');" +
    "c.string(200,JSON.stringify({success:true,stats:_stats}));" +
    "}catch(_e){" +
        "var _resp=JSON.stringify({error:String(_e).substring(0,500)});" +
        "c.response().header().set('Content-Type','application/json; charset=utf-8');" +
        "c.string(500,_resp);" +
    "}";

routerAdd("POST", "/api/backup/import", new Function("c", IMPORT_BODY));
console.log("[stjorna-backup] registered POST /api/backup/import");

console.log("[stjorna-backup] all routes registered");
