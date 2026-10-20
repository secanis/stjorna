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
//   - Handlers live in pb_hooks/lib/setup.js and are require()d inside
//     each handler (loader/executor VM split). The token is resolved once
//     and cached in $app.store(), so the startup banner and the route
//     check always agree — even for a randomly generated token.

console.log("[stjorna-setup] loading");

// Resolve (and cache) the token at load time so a too-short env token is
// warned about at startup, as before.
var stjornaSetupTokenSource = require(`${__hooks}/lib/setup.js`).setupToken().source;

// Startup banner with the generated token (only when no real superuser
// exists). DB access is only possible after bootstrap, hence onBootstrap.
// (`onServe` is NOT usable from a hook file in this PB version.)
onBootstrap((e) => {
    require(`${__hooks}/lib/setup.js`).bootstrapBanner(e);
});

routerAdd("GET", "/api/stjorna/setup-status", (e) => {
    require(`${__hooks}/lib/setup.js`).statusHandler(e);
});
console.log("[stjorna-setup] registered GET /api/stjorna/setup-status");

routerAdd("POST", "/api/stjorna/setup-bootstrap-superuser", (e) => {
    require(`${__hooks}/lib/setup.js`).bootstrapHandler(e);
});
console.log("[stjorna-setup] registered POST /api/stjorna/setup-bootstrap-superuser");

console.log("[stjorna-setup] hooks loaded (setup token source: " + stjornaSetupTokenSource + ")");
