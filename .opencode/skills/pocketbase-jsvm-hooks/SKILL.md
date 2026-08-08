---
name: pocketbase-jsvm-hooks
description: PocketBase v0.22.7 JavaScript VM hooks gotchas. Use when writing PB JS hooks (pb_hooks/*.pb.js), debugging 400 errors, getting "ReferenceError: X is not defined" in handlers, dealing with loader vs executor VM split, or implementing custom REST routes.
---

# PocketBase v0.22.7 JSVM Hooks — Pain Points & Solutions

This skill documents the non-obvious behaviors of PocketBase v0.22.7's JavaScript VM that you WILL hit when writing custom hooks. Most of these are undocumented.

## Quick Reference

| Symptom | Cause | Fix |
|---------|-------|-----|
| Hook not loaded at all | Filename doesn't end in `.pb.js` / `.pb.ts` | Rename file to `*.pb.js` |
| New file not picked up | HooksWatch only re-loads CHANGED existing files | Touch file in container, or restart |
| `ReferenceError: X is not defined` in handler | Loader VM variables aren't visible in executor VM | Use `new Function(...)` to inline values |
| Generic `400` from handler | `c.json()` marshaling fails on complex objects | Use `c.string(200, preSerializedJson)` + manual Content-Type |
| HTTP 200 but empty body | `c.response().write()` doesn't actually write in v0.22.7 | Use `c.string()` or `c.blob()` |
| `c.send is not a function` | `c.send()` was added in v0.23+, not in v0.22.x | Use `c.string()` or `c.blob()` |
| `atob is not defined` | goja (the JS engine) doesn't expose web platform globals | Use a pure-JS base64url decoder |
| File changes don't take effect | `podman cp` creates files owned by uid 100999 | `rm` then `cat >` as host user |
| `pb is not defined` | v0.22.7 doesn't expose a `pb` global | Use `routerAdd`, `onRecord*Request`, etc. (no namespace) |
| JWT decode returns `type: "none"` | User tokens use `type: "authRecord"`, not `type: "auth"` | Check `type === "authRecord"` for users, `type === "admin"` for admins |

---

## 1. File Naming: MUST end in `.pb.js` or `.pb.ts`

PocketBase's `HooksFilesPattern` defaults to `^.*(\.pb\.js|\.pb\.ts)$` in v0.22.7. Files without this extension are silently ignored — no error, just not loaded.

```bash
# ✅ Loaded
pocketbase/pb_hooks/openapi.pb.js
pocketbase/pb_hooks/media-cleanup.pb.js

# ❌ NOT loaded (silent failure)
pocketbase/pb_hooks/stjorna.js
pocketbase/pb_hooks/test.js
pocketbase/pb_hooks/openapi.js
```
(Real-world example: `openapi.pb.js` in `pocketbase/pb_hooks/` is the working pattern.)

**Debug:** If your hook isn't running, check the PB container logs for a `Loaded hook` line. If absent, the file pattern didn't match.

## 2. HooksWatch Only Re-Loads CHANGED Existing Files

PB watches `pb_hooks/` for filesystem changes. When a file's mtime changes, the server restarts the VM and re-loads that file. BUT: it does NOT scan for new files that didn't exist when the server started.

```bash
# If you ADD a new file:
podman cp ./my-new-hook.pb.js container:/app/pb_hooks/
# Server does NOT auto-load it. You must:
podman exec container touch /app/pb_hooks/my-new-hook.pb.js
# OR restart the container

# If you MODIFY an existing file:
podman cp ./existing-hook.pb.js container:/app/pb_hooks/existing-hook.pb.js
# Server auto-detects the mtime change and reloads within ~1 second
```

**Debug:** Watch logs with `podman logs -f container | grep "File.*pb_hooks"` to see reload events.

## 3. The Loader VM / Executor VM Split (THE BIG ONE)

PB v0.22.7 has TWO separate JavaScript VMs:

- **Loader VM** — runs when the file is loaded at server start or when the file changes. Top-level code (variable assignments, function declarations, `routerAdd()` calls) runs here.
- **Executor VM** — runs when a hook handler is invoked (e.g., on an HTTP request to a route you registered). Handlers run here.

**The split is a feature, not a bug:** it isolates handler code so it can't accidentally mutate loader state. But it has a CRITICAL implication:

> **Top-level variables from the loader VM are NOT visible in handler scope.**

This includes:
- `let` / `var` / `const` declarations
- Properties on `globalThis`
- Top-level function declarations
- Anything not literally inlined into the handler function

### The Symptom

```javascript
// ❌ BROKEN — handler can't see CACHED_JSON
var CACHED_JSON = JSON.stringify({ hello: "world" });

function serveSpec(c) {
    c.string(200, CACHED_JSON);  // ReferenceError: CACHED_JSON is not defined
}

routerAdd("GET", "/api/spec", serveSpec);
```

The handler IS called (you can verify with `console.log` and see the log), but the free variable `CACHED_JSON` is `undefined` because the loader VM's `CACHED_JSON` is not in the executor VM's scope.

### The Fix: Inline via `new Function()`

Build a function whose body is a string containing all the data as literals:

```javascript
// ✅ WORKS — JSON is inlined as a string literal
var JSON_SPEC = JSON.stringify({ hello: "world" });
var HANDLER_BODY = "c.string(200, " + JSON.stringify(JSON_SPEC) + ");";

routerAdd("GET", "/api/spec", new Function("c", HANDLER_BODY));
```

The function returned by `new Function("c", "...literal code...")` has ZERO free variables — the spec is literally in the function body as a JS string. When executed, the spec is right there in the bytecode, no scope lookup needed.

**JSON.stringify escaping:** `JSON.stringify(JSON_SPEC)` returns a valid JS string literal (with escaped quotes), so the inlined code is syntactically correct:
```javascript
// If JSON_SPEC is {"foo":"bar"}
// JSON.stringify(JSON_SPEC) is "{\"foo\":\"bar\"}"
// Inlined: c.string(200, "{\"foo\":\"bar\"}");
// That's valid JS! The string is in the function body as a literal.
```

### Alternative Fix: Define Handler Inline

```javascript
// ✅ ALSO WORKS — but only if the data is small enough to inline manually
routerAdd("GET", "/api/spec", (c) => {
    c.string(200, '{"hello":"world"}');  // literal, no closure needed
});
```

This only works for short, hardcoded data. For 16KB specs, use `new Function(...)`.

### What Does NOT Work

```javascript
// ❌ Closure doesn't carry
var data = "...";
routerAdd("GET", "/api/x", (c) => { c.string(200, data); });
// data is not visible in executor VM

// ❌ globalThis doesn't carry
globalThis.MY_DATA = "...";
routerAdd("GET", "/api/x", (c) => { c.string(200, globalThis.MY_DATA); });
// globalThis in executor VM is empty

// ❌ var doesn't carry
var CACHED = "...";
routerAdd("GET", "/api/x", function(c) { c.string(200, CACHED); });
// CACHED is undefined in executor VM
```

The only thing that works is inlining the data as a literal in the handler body.

## 4. Response Writing — What's Available in v0.22.7

Available on the request event (`c` in handlers):

| Method | Works? | Notes |
|--------|--------|-------|
| `c.string(status, body)` | ✅ | Sets body, lets you pre-set Content-Type via `c.response().header().set()` |
| `c.blob(status, contentType, body)` | ✅ | Explicit Content-Type in call |
| `c.json(status, data)` | ⚠️ | **Fails with generic 400 on complex nested objects** (goja marshaling issue) |
| `c.response().header().set(name, value)` | ✅ | Pre-set response headers |
| `c.response().writeHeader(status)` | ✅ | Set status before writing body |
| `c.response().write(str)` | ❌ | **Method exists but does NOT actually write** in v0.22.7 (returns 200 + empty body) |
| `c.noContent(status)` | ✅ | 204 No Content |
| `c.redirect(status, url)` | ✅ | Redirect |
| `c.send(status, body)` | ❌ | **Doesn't exist in v0.22.7** (added in v0.23+) |

### Recommended Pattern for JSON Response

```javascript
var JSON_SPEC = JSON.stringify({ ... });
var HANDLER_BODY = "c.response().header().set('Content-Type', 'application/json; charset=utf-8');" +
                  "c.string(200, " + JSON.stringify(JSON_SPEC) + ");";

routerAdd("GET", "/api/spec", new Function("c", HANDLER_BODY));
```

This is bulletproof:
- `c.response().header().set()` sets the Content-Type
- `c.string(200, ...)` writes the body (the spec is a literal in the function body)
- No `c.json()` marshaling involved
- Works for arbitrarily large JSON (16KB+ spec is fine)

### If You MUST Use c.json() (Small Objects)

`c.json()` works for SMALL simple objects:
```javascript
routerAdd("GET", "/api/health", (c) => {
    c.json(200, { status: "ok" });  // ✅ works
});

routerAdd("GET", "/api/echo", (c) => {
    c.json(200, { items: [1, 2, 3] });  // ✅ works
});

routerAdd("GET", "/api/spec", (c) => {
    c.json(200, SPEC);  // ❌ fails on 16KB nested spec
});
```

The failure mode is a generic `400 {"code":400,"message":"Something went wrong..."}` with no further info in the response. Check PB logs for the actual goja error: `podman logs container | tail -30`.

## 5. Available Globals and APIs

PB v0.22.7 exposes these globals (in BOTH loader and executor VMs):

```javascript
// Routing
routerAdd(method, path, handler)  // register custom route

// Hooks
onRecordEnrich(e, handler)
onRecordCreateRequest(e, handler)
onRecordUpdateRequest(e, handler)
onRecordDeleteRequest(e, handler)
onRecordAfterCreateRequest(e, handler)  // after create, no error path
onRecordAfterUpdateRequest(e, handler)
onRecordAfterDeleteRequest(e, handler)
onRecordsListRequest(e, handler)
cronAdd(jobId, cronExpr, handler)

// DB / Records
$app  // the PB app instance (singleton)
$db   // the DB handle
$os   // OS helpers
$http.*  // make HTTP requests
Record, Collection, Dao, Admin, Schema, ...
new Record(collection)  // or new Record() + .collection()
// newRecord(collection) is a helper, equivalent to above
```

**`pb` / `pocketbase` global does NOT exist** in v0.22.7 (added in v0.23+). Use the globals directly.

### Useful Patterns

```javascript
// Access PB app
$app.dao()  // DB access
$app.dao().findRecordById(collection, id)
$app.dao().saveRecord(record)
$app.settings()  // PB settings

// File system access
$app.dao().newFilesystem()  // returns Filesystem
// Then: filesystem.delete(originalName, recordId)

// Get auth info
$app.settings()  // PB-level settings
// Inside handler:
c.auth  // the auth record (or null for superuser)
c.requestInfo  // request metadata

// Logging
console.log("message")  // goes to PB stdout
console.log(JSON.stringify(obj))  // for complex values
```

## 6. File Deletion Hook Example

PB v0.22.7 does NOT auto-delete files when a record is deleted. Here's the pattern:

```javascript
onRecordAfterDeleteRequest("media", (e) => {
    const record = e.record;
    const fs = $app.dao().newFilesystem();
    const fileField = record.get("file");  // []string of filenames
    
    if (fileField && fileField.length > 0) {
        for (const filename of fileField) {
            try {
                fs.delete(filename, record.id);
            } catch (err) {
                console.log("[media-cleanup] failed to delete " + filename + ": " + err);
            }
        }
    }
    
    // Also delete from S3 if applicable
    if (record.get("s3_url")) {
        // Use $http to call S3 API or use a custom S3 client
        // ...
    }
});
```

## 7. File Permissions (Podman Container)

When you `podman cp` a file into the running container, it becomes owned by the **container's user** (uid 100999 for PB). The host user (your user) can't then modify it inside the bind mount. But the directory itself is owned by the host user.

```bash
# Inside the container, openapi.pb.js is now owned by uid 100999
# On the host, you CAN'T edit it (if mounted from host dir)
# But you CAN delete it (because you own the directory)

# Workaround:
rm /path/to/openapi.pb.js          # ✅ works (host owns dir)
cat > /path/to/openapi.pb.js       # ✅ recreate as host user
podman cp /path/to/file container:/app/path/  # re-copy to container
```

Or, edit in the container directly:
```bash
podman exec -it container sh
# Inside container, you're root or pocketbase user
vi /app/pb_hooks/openapi.pb.js
# But you can't `podman cp` over an open file (inode changes)
```

## 8. Debugging Tips

```bash
# Watch hook load events
podman logs -f container | grep -E "File.*pb_hooks|Loaded|restarting"

# Watch console.log from hooks
podman logs -f container | grep "\[your-tag\]"

# Manually trigger a reload
podman exec container touch /app/pb_hooks/your-hook.pb.js

# Test a route
curl -v http://localhost:8090/api/your-route

# See Go-level errors (more detail than the 400 response)
podman logs container --tail 50 2>&1
```

### Common Debug Patterns

Add diagnostic logs in the handler:
```javascript
routerAdd("GET", "/api/test", (c) => {
    try {
        console.log("[my-hook] handler entered");
        // ... do stuff ...
        console.log("[my-hook] success");
    } catch (e) {
        console.log("[my-hook] EXCEPTION: " + e + "\n" + e.stack);
        // Don't catch — let it bubble to PB's error recovery (returns 400)
    }
});
```

If you see `[my-hook] handler entered` but NOT `success`, the exception is happening between those lines. The 400 response is generic, but the log tells you the exact line.

## 9. Full Example: Custom OpenAPI Endpoint

This is the working pattern from STJÓRNA's `pocketbase/pb_hooks/openapi.pb.js`:

```javascript
var SPEC = {
    openapi: "3.0.3",
    info: { title: "My API", version: "1.0.0" },
    paths: {
        "/health": {
            get: {
                tags: ["Public"],
                summary: "Health check",
                responses: { "200": { description: "OK" } }
            }
        }
    }
};

var JSON_SPEC = JSON.stringify(SPEC);
var HANDLER_BODY = 
    "c.response().header().set('Content-Type', 'application/json; charset=utf-8');" +
    "c.string(200, " + JSON.stringify(JSON_SPEC) + ");";

routerAdd("GET", "/api/openapi.json", new Function("c", HANDLER_BODY));
routerAdd("GET", "/api/openapi", new Function("c", HANDLER_BODY));

console.log("[openapi] routes registered (spec=" + JSON_SPEC.length + " bytes)");
```

This:
- Pre-serializes the spec at load time (no per-request work)
- Uses `new Function(...)` to inline the spec as a literal in the handler body
- Avoids `c.json()` marshaling entirely
- Avoids the loader/executor VM split by having zero free variables
- Serves a 16KB+ spec without any issue

## 10. Test It End-to-End

After deploying a hook:

```bash
# 1. Wait for reload (PB detects file change, restarts VM in ~1s)
sleep 2

# 2. Check the route is registered
podman logs container --tail 5 | grep "your-tag"

# 3. Hit the endpoint
curl -v http://localhost:8090/api/your-route

# 4. Check response body
curl -s http://localhost:8090/api/your-route | python3 -m json.tool
```

If you get a 400:
- Check PB logs: `podman logs container --tail 30`
- Add `console.log` statements to narrow down the failing line
- Test with a trivial handler first (returns `'{"ok":true}'`)

## 11. Common Pitfalls Summary

| Do | Don't |
|----|-------|
| Use `c.string(200, preSerializedJson)` + manual Content-Type | Use `c.json()` on complex nested objects |
| Use `c.blob(200, contentType, bytes)` when you need a different content type | Use `c.response().write()` (returns empty body) |
| Use `new Function("c", "...literal code...")` to inline data | Rely on top-level `var` / `let` / `globalThis` in handlers |
| Name files `*.pb.js` or `*.pb.ts` | Name files just `*.js` (silently ignored) |
| Touch a new file or restart the container | Expect new files to be auto-loaded |
| `rm` + recreate files as host user | `podman cp` repeatedly (files become unwritable) |
| Test with small handlers first | Write 16KB of spec before verifying the basic pattern works |
| Use `console.log("[tag] ...")` for debugging | Expect detailed errors from PB (most 400s are generic) |

## 12. Migration Notes (v0.22.7 → v0.23+)

If you upgrade to v0.23+:
- `c.send(status, body)` is now available
- `pb` global is now available (singleton client)
- `pocketbase` global is now available
- Env-var S3 config is now supported (`PB_S3_*` env vars)
- `HooksFilesPattern` may have changed — check the changelog

Most of the patterns above still work; you just have more options.

---

## 13. Pattern: Role-Based Response (Pre-serialized Specs + JWT Decode)

A common need: serve different content from the same endpoint depending on who is calling. The cleanest v0.22.7 implementation combines three patterns from this skill:

1. Pre-serialize N response variants at load time (`JSON.stringify`)
2. Use `new Function("c", "...literal code...")` to inline them into the handler
3. Decode the request's JWT to pick the right variant

### Worked example: tiered OpenAPI docs

A single endpoint (`GET /api/openapi.json`) returns three different OpenAPI specs:
- Anonymous (no token) → `Public` operations only
- User JWT (`type: "authRecord"`) → `Public + Private`
- Admin JWT (`type: "admin"`) → `Public + Private + Admin`

```js
// Filter helper — runs in loader VM
function filterSpecByTag(spec, allowed) {
    var paths = {};
    for (var p in spec.paths) {
        var ops = {};
        for (var m in spec.paths[p]) {
            if (m === "parameters") { ops.parameters = spec.paths[p].parameters; continue; }
            var op = spec.paths[p][m];
            if (op && op.tags && op.tags.some(function (t) { return allowed.indexOf(t) !== -1; })) {
                ops[m] = op;
            }
        }
        if (Object.keys(ops).length > 0) paths[p] = ops;
    }
    return {
        openapi: spec.openapi,
        info: spec.info,
        servers: spec.servers,
        tags: spec.tags.filter(function (t) { return allowed.indexOf(t.name) !== -1; }),
        components: spec.components,
        paths: paths
    };
}

var FULL    = SPEC; // the full spec
var PRIVATE = filterSpecByTag(SPEC, ["Public", "Private"]);
var PUBLIC  = filterSpecByTag(SPEC, ["Public"]);

// Pre-serialize so each can be inlined as a JSON literal
var FULL_JSON    = JSON.stringify(FULL);
var PRIVATE_JSON = JSON.stringify(PRIVATE);
var PUBLIC_JSON  = JSON.stringify(PUBLIC);

// goja has no atob, so we ship a base64url decoder in the handler body
var B64_DECODE =
    "var _B='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';" +
    "var _L={};var _i=0;while(_i<_B.length){_L[_B[_i]]=_i;_i=_i+1;}" +
    "function b64(s){" +
        "s=String(s).replace(/-/g,'+').replace(/_/g,'/');" +
        "while(s.length%4)s=s+'=';" +
        "var out='';var buf=0;var bits=0;var j=0;" +
        "while(j<s.length){" +
            "var c=s[j];j=j+1;" +
            "if(c==='=')break;" +
            "var v=_L[c];if(v===undefined)continue;" +
            "buf=(buf<<6)|v;bits=bits+6;" +
            "if(bits>=8){bits=bits-8;out=out+String.fromCharCode((buf>>bits)&0xFF);}" +
        "}return out;" +
    "}";

// PB v0.22.7 JWT types:
//   admin  -> "type": "admin"
//   user   -> "type": "authRecord"   (NOT "auth"!)
// Note: we decode WITHOUT signature verification. This is safe here because
// we are only choosing which docs to display, not granting access — the
// real admin API still validates the real token server-side.
var BODY =
    "var h=String(c.request().header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
    "var body=" + JSON.stringify(PUBLIC_JSON) + ";" +
    "if(h.length>0){" +
        B64_DECODE +
        "try{" +
            "var p=JSON.parse(b64(h.split('.')[1]||''));" +
            "if(p&&p.type==='admin')body=" + JSON.stringify(FULL_JSON) + ";" +
            "else if(p&&p.type==='authRecord')body=" + JSON.stringify(PRIVATE_JSON) + ";" +
        "}catch(e){}" +
    "}" +
    "c.response().header().set('Content-Type','application/json; charset=utf-8');" +
    "c.string(200,body);";

routerAdd("GET", "/api/openapi.json", new Function("c", BODY));
```

### Why this works

- The `BODY` string is constructed at load time, with each spec inlined as a `JSON.stringify(...)` literal — so the handler body has zero free variables, only the parameter `c`. The handler survives the loader→executor VM boundary.
- The handler is fast (O(1) on each request): no DB lookups, no spec filtering at runtime, just a JWT payload decode and a string selection.
- A malformed/expired token falls through to `Public` (defensive). The `try/catch` around the decode ensures any unexpected input is safe.
- We do **not** verify the JWT signature. This is acceptable because we are not making an authorization decision — we are only choosing which documentation to render. The actual admin API endpoints still require a valid signed token and the PB server enforces the rules on every call.

### Decision matrix

| Token present? | JWT `type` | Returns |
|----------------|------------|---------|
| No | — | Public |
| Yes | anything else (or invalid) | Public |
| Yes | `authRecord` | Public + Private |
| Yes | `admin` | Public + Private + Admin |

This pattern generalizes beyond OpenAPI: any time you need to serve different content for different roles from the same URL (rate limit message vs dashboard, free-tier vs paid docs, etc.), pre-serialize the variants and pick at request time.
