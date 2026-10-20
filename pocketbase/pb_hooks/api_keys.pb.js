/// <reference path="../pb_data/types.d.ts" />

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
//   itself verifies the JWT signature. The inline check in lib/apikeys.js
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
// Implementation lives in pb_hooks/lib/apikeys.js and is require()d
// inside each handler (handlers run in a separate VM from this file).

console.log("[stjorna-apikeys] loading");

routerAdd("POST", "/api/stjorna/api-keys", (e) => {
    require(`${__hooks}/lib/apikeys.js`).issueHandler(e);
}, $apis.requireSuperuserAuth());

routerAdd("GET", "/api/stjorna/api-keys", (e) => {
    require(`${__hooks}/lib/apikeys.js`).listHandler(e);
}, $apis.requireSuperuserAuth());

routerAdd("DELETE", "/api/stjorna/api-keys/{id...}", (e) => {
    require(`${__hooks}/lib/apikeys.js`).revokeHandler(e);
}, $apis.requireSuperuserAuth());

// Bearer-key routes: no PB auth middleware, the API key is the credential.
routerAdd("GET", "/api/stjorna/api-keys/me", (e) => {
    require(`${__hooks}/lib/apikeys.js`).introspectHandler(e);
});

routerAdd("POST", "/api/stjorna/api-keys/exchange", (e) => {
    require(`${__hooks}/lib/apikeys.js`).exchangeHandler(e);
});

console.log("[stjorna-apikeys] all routes registered");
