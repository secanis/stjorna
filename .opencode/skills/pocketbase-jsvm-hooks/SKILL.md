---
name: pocketbase-jsvm-hooks
description: PocketBase v0.40 JavaScript VM hooks — the module pattern used by STJÓRNA. Use when writing PB JS hooks (pb_hooks/*.pb.js, pb_hooks/lib/*.js), getting "ReferenceError: X is not defined" in handlers, dealing with the loader vs executor VM split, or implementing custom REST routes.
---

# PocketBase v0.40 JSVM Hooks — STJÓRNA Module Pattern

STJÓRNA runs PocketBase **v0.40.4** (see `pocketbase/Dockerfile`). Hooks are
baked into the PB image (`COPY pb_hooks /app/pb_hooks`); the Helm chart does
not mount them. Older docs/code in this repo built handlers as strings with
`new Function("e", BODY)` — that v0.22-era workaround is **gone**; do not
reintroduce it.

## Quick Reference

| Symptom | Cause | Fix |
|---------|-------|-----|
| Hook file not loaded | Filename doesn't end in `.pb.js` | Rename to `*.pb.js` (lib modules must NOT use that suffix) |
| `ReferenceError: X is not defined` in a handler | Top-level vars/functions of the `.pb.js` file are not visible in handlers | `require(\`${__hooks}/lib/x.js\`)` **inside** the handler |
| Value computed at load time needed in handler (e.g. random token) | Same VM split | Recompute in a lib, or cache it in `$app.store()` |
| `$app` DB call at load time panics (nil pointer) | App not bootstrapped yet | Do DB work in `onBootstrap((e) => { e.next(); ... })` or in handlers |
| `onServe` registration fails at load | Not usable from hook files in this version | Use `onBootstrap` |
| Thrown error becomes 200 | You wrapped `throw new ForbiddenError()` in try/catch | Let it propagate |
| Syntax error only found at boot | Hooks aren't built | `cd pocketbase && npm run check:hooks` (`node --check` on all hook files) |

## 1. File layout

```
pocketbase/pb_hooks/
├── package.json          {"type": "commonjs"}
├── api_keys.pb.js        registration only: routerAdd/onRecord*/onBootstrap
├── ...
└── lib/
    ├── http.js           shared helpers: reply/replyError, readBody/readJsonBody,
    │                     getR (safe record.get), toMs (PB date → ms), nowStamp,
    │                     hasAdminRole / isTenantAdmin
    ├── routes.js         registry of custom routes (feeds the OpenAPI spec)
    ├── openapi.js        spec builder (collections from $app.findAllCollections())
    ├── apikeys.js, setup.js, stats.js, users.js, backup.js, mfa.js, oidc.js
```

- `*.pb.js` files are loaded by PB's loader VM. Keep them thin: register
  routes/hooks and log.
- `lib/*.js` are plain CommonJS (`module.exports = {...}`), **no** `.pb.js`
  suffix (otherwise PB would load them as hook files too).
- Add `/// <reference path="../pb_data/types.d.ts" />` (or `../../pb_data/…` in
  `lib/`) at the top for editor typing.

## 2. The loader VM / executor VM split

PB evaluates each `.pb.js` once in a loader VM, but every handler runs in a
pooled executor VM. Closures over the file's top-level scope do **not** work:

```js
// ❌ broken — HELPER is undefined when the handler runs
var HELPER = function () { ... };
routerAdd("GET", "/api/x", (e) => HELPER(e));

// ✅ the STJÓRNA pattern
routerAdd("GET", "/api/stjorna/stats", (e) => {
    require(`${__hooks}/lib/stats.js`).statsHandler(e);
}, $apis.requireAuth());
```

`require()` is cached per VM, so the cost is paid once per executor.

### Load-time values

Values that must be identical everywhere (e.g. the setup token generated when
`STJORNA_SETUP_TOKEN` is unset) are resolved once and cached in the
process-wide store — see `lib/setup.js`:

```js
var store = $app.store();
if (store.has("stjorna.setupToken")) return String(store.get("stjorna.setupToken"));
var token = $os.getenv("STJORNA_SETUP_TOKEN") || $security.randomString(40);
store.set("stjorna.setupToken", token);
```

Store primitives (strings/bools), not JS objects — values cross VMs.

## 3. Request / response API (v0.40)

- `e.json(status, obj)` / `e.string(status, str)` / `e.blob(...)` write responses.
  STJÓRNA uses `lib/http.js#reply(e, status, obj, noStore)` which sets
  `Content-Type` (and `Cache-Control: no-store` when asked) and
  `JSON.stringify`s the body so the wire shape is exact.
- `e.requestInfo().body` — parsed JSON body; `readerToString(e.request.body, max)`
  when the raw body is needed (`lib/http.js#readBody`).
- `e.request.url.query().get("q")`, `e.request.pathValue("id")`,
  `e.request.header.get("Authorization")`.
- `e.auth` — verified auth record (PB checked the JWT) or null;
  `e.hasSuperuserAuth()`.
- Auth middlewares: `$apis.requireAuth()`, `$apis.requireSuperuserAuth()`,
  `$apis.requireGuestOnly()` as the last args of `routerAdd`.
- Errors: `throw new BadRequestError(msg)`, `ForbiddenError`, `NotFoundError`,
  `UnauthorizedError` (do not swallow them in try/catch).
- `$app.findRecordsByFilter(col, filter, sort, limit, offset, params)` — always
  bind user input via `{:param}` placeholders.
- Date fields come back as goja `DateTime` wrappers; normalise with
  `lib/http.js#toMs`.

## 4. Record hooks

```js
onRecordCreateRequest((e) => {
    var http = require(`${__hooks}/lib/http.js`);
    if (!http.isTenantAdmin(e, String(e.record.get("tenant") || ""))) {
        throw new Error("Only tenant admins can invite users to this tenant");
    }
    e.next();
}, "user_tenants");
```

- `*Request` hooks fire only for API requests; `$app.save()` from hooks uses the
  model path (`onRecordCreate`/`onRecordCreateExecute`) and skips them.
- Always call `e.next()` (or throw).

## 5. Custom routes and the OpenAPI spec

Every custom route must be listed in `lib/routes.js` (method, path, auth tier,
summary). `openapi.pb.js` builds `/api/openapi.json` at request time from that
registry plus `$app.findAllCollections()` (fields + API rules), and
`pocketbase/tests/openapi.test.ts` fails if a documented path 404s or a
documented field doesn't exist.

## 6. Checks and debugging

```bash
cd pocketbase && npm run check:hooks           # node --check on every hook file
docker logs <pb-container> 2>&1 | grep '\[stjorna'   # hook load lines
```

Hook load errors are printed at boot; a hook file that throws at load time is
skipped while the rest keep working, so always check the logs after adding a
file. `HooksWatch` reloads changed files in dev, but new files need a restart.
