/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA — OpenAPI 3.0.3 spec.
//
//   GET /api/openapi.json   (alias: GET /api/openapi)
//
// The spec is generated per request by pb_hooks/lib/openapi.js from the
// live collections ($app.findAllCollections(): fields + API rules) and the
// custom-route registry in pb_hooks/lib/routes.js, so it cannot drift from
// the schema. The route is public; the caller's verified auth only picks
// how much of the spec is shown (anonymous → Public, user → Public +
// Private, superuser → all tiers).

routerAdd("GET", "/api/openapi.json", (e) => {
    require(`${__hooks}/lib/openapi.js`).handler(e);
});
routerAdd("GET", "/api/openapi", (e) => {
    require(`${__hooks}/lib/openapi.js`).handler(e);
});

console.log("[stjorna-openapi] registered GET /api/openapi.json, /api/openapi");
