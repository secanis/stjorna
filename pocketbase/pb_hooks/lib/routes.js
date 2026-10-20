/// <reference path="../../pb_data/types.d.ts" />

// STJÓRNA — registry of every custom route registered by pb_hooks/*.pb.js.
//
// Single source for the custom-route section of /api/openapi.json
// (lib/openapi.js). `npm run check:hooks` fails when a routerAdd() path is
// missing here (or listed here but never registered), and
// tests/openapi.test.ts fails when a documented path 404s.
//
// Fields:
//   method, path  exactly as passed to routerAdd()
//   tier          "Public" | "Private" | "Admin" (or an array, e.g. a route
//                 that serves tenant users and superusers differently)
//   auth          "none" | "auth" (requireAuth) | "superuser"
//                 (requireSuperuserAuth) | "apikey" (Bearer API key)
//                 | "setup-token" (X-Stjorna-Setup-Token header)
//   hidden        true = registered but not documented (aliases)
//   doc           extra OpenAPI operation fields (parameters, requestBody,
//                 responses)
//
// Pure data, no PB globals: also require()d by Node in check-hooks.

var obj = function (props, extra) {
    var o = { type: "object", properties: props };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
};
var str = { type: "string" };
var int = { type: "integer" };
var bool = { type: "boolean" };
var json = function (schema) {
    return { "application/json": { schema: schema } };
};
var ok = function (description, schema) {
    return { description: description, content: json(schema) };
};
var ref = function (name) {
    return { $ref: "#/components/responses/" + name };
};
var pathParam = function (name, description) {
    return { name: name, in: "path", required: true, schema: str, description: description || "" };
};

var ROUTES = [
    {
        method: "GET",
        path: "/api/openapi.json",
        tier: "Public",
        auth: "none",
        summary: "This OpenAPI document. Anonymous callers get the Public tier, tenant users Public + Private, superusers everything.",
        doc: { responses: { "200": ok("OpenAPI 3.0.3 document", { type: "object" }) } },
    },
    { method: "GET", path: "/api/openapi", tier: "Public", auth: "none", hidden: true },

    // --- setup.pb.js ---------------------------------------------------
    {
        method: "GET",
        path: "/api/stjorna/setup-status",
        tier: "Public",
        auth: "none",
        summary: "First-run status for the /setup wizard.",
        doc: {
            responses: {
                "200": ok(
                    "Setup status",
                    obj({
                        superuserExists: bool,
                        setupDone: bool,
                        setupTokenRequired: bool,
                        setupTokenSource: { type: "string", enum: ["env", "log"] },
                    })
                ),
            },
        },
    },
    {
        method: "POST",
        path: "/api/stjorna/setup-bootstrap-superuser",
        tier: "Public",
        auth: "setup-token",
        summary:
            "Create the first superuser. Requires the one-time setup token (STJORNA_SETUP_TOKEN env var or the token printed in the server log) in the X-Stjorna-Setup-Token header. Refuses once a superuser exists or setup is done.",
        doc: {
            parameters: [{ name: "X-Stjorna-Setup-Token", in: "header", required: true, schema: str }],
            requestBody: {
                required: true,
                content: json(obj({ email: str, password: str, passwordConfirm: str }, { required: ["email", "password", "passwordConfirm"] })),
            },
            responses: {
                "200": ok("Superuser created", obj({ ok: bool, id: str, email: str })),
                "400": ref("BadRequest"),
                "401": ref("Unauthorized"),
                "409": { description: "A superuser already exists or setup is already done" },
            },
        },
    },

    // --- oidc_config.pb.js ----------------------------------------------
    {
        method: "GET",
        path: "/api/stjorna/oidc-config",
        tier: "Public",
        auth: "none",
        summary: "Public OIDC login configuration for the login page (no secrets).",
        doc: { responses: { "200": ok("OIDC login configuration", { type: "object" }) } },
    },

    // --- users_search.pb.js ---------------------------------------------
    {
        method: "GET",
        path: "/api/stjorna/users/search",
        tier: "Private",
        auth: "auth",
        summary: "Find users by email. Superusers: substring match; tenant admins: exact email only. Max 10 results.",
        doc: {
            parameters: [{ name: "q", in: "query", required: false, schema: str, description: "Email (or substring for superusers)" }],
            responses: {
                "200": ok("Matching users", obj({ ok: bool, users: { type: "array", items: obj({ id: str, email: str, name: str }) } })),
                "401": ref("Unauthorized"),
                "403": ref("Forbidden"),
            },
        },
    },
    {
        method: "GET",
        path: "/api/stjorna/tenants/{id}/members",
        tier: "Private",
        auth: "auth",
        summary: "Members (id, name, email) of one tenant. Superusers and admins of that tenant only.",
        doc: {
            parameters: [pathParam("id", "Tenant id")],
            responses: {
                "200": ok("Tenant members", obj({ ok: bool, members: { type: "array", items: obj({ id: str, name: str, email: str }) } })),
                "401": ref("Unauthorized"),
                "403": ref("Forbidden"),
            },
        },
    },

    // --- stats.pb.js ----------------------------------------------------
    {
        method: "GET",
        path: "/api/stjorna/stats",
        tier: ["Private", "Admin"],
        auth: "auth",
        summary:
            "Per-tenant statistics — counts, media storage (sum/largest/per-mime-type), and last-30-day activity. Superusers must pass ?tenant=<id>; tenant users always get their own tenant (a different ?tenant= is a 403).",
        doc: {
            parameters: [{ name: "tenant", in: "query", required: false, schema: str, description: "Tenant id. Required for superusers." }],
            responses: {
                "200": ok(
                    "Stats snapshot",
                    obj({
                        ok: bool,
                        tenant: obj({ id: str, name: str, slug: str, plan: str, custom_domain: str }),
                        counts: obj({ categories: int, products: int, media: int, users: int }),
                        storage: obj({
                            media_bytes: int,
                            media_count: int,
                            avg_media_bytes: int,
                            largest_media: obj({ id: str, filename: str, bytes: int, mime_type: str }, { nullable: true }),
                            by_mime_type: { type: "array", items: obj({ mime_type: str, count: int, bytes: int }) },
                        }),
                        activity_30d: obj({ products_created: int, products_updated: int, media_uploaded: int, categories_created: int }),
                        generated_at: { type: "string", format: "date-time" },
                    })
                ),
                "400": ref("BadRequest"),
                "401": ref("Unauthorized"),
                "403": ref("Forbidden"),
                "404": ref("NotFound"),
            },
        },
    },

    // --- api_keys.pb.js -------------------------------------------------
    {
        method: "POST",
        path: "/api/stjorna/api-keys",
        tier: "Admin",
        auth: "superuser",
        summary: "Issue a new API key for a tenant. The plaintext key is returned EXACTLY ONCE.",
        doc: {
            requestBody: {
                required: true,
                content: json(
                    obj(
                        { tenant: str, name: str, permissions: { type: "object" }, expires: { type: "string", format: "date-time" } },
                        { required: ["tenant", "name"] }
                    )
                ),
            },
            responses: {
                "200": ok("Key issued", obj({ ok: bool, apiKey: { type: "object" }, plaintext: str, warning: str })),
                "400": ref("BadRequest"),
                "401": ref("Unauthorized"),
                "404": ref("NotFound"),
            },
        },
    },
    {
        method: "GET",
        path: "/api/stjorna/api-keys",
        tier: "Admin",
        auth: "superuser",
        summary: "List API key metadata (never the key or its hash).",
        doc: {
            parameters: [
                { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                { name: "perPage", in: "query", schema: { type: "integer", default: 50 } },
                { name: "tenant", in: "query", schema: str, description: "Filter by tenant id" },
            ],
            responses: {
                "200": ok("API key metadata", obj({ ok: bool, items: { type: "array", items: { type: "object" } }, page: int, perPage: int, totalItems: int })),
                "401": ref("Unauthorized"),
            },
        },
    },
    {
        method: "DELETE",
        path: "/api/stjorna/api-keys/{id...}",
        tier: "Admin",
        auth: "superuser",
        summary: "Revoke an API key: marks it revoked and deletes its service user (live JWTs stop working).",
        doc: {
            parameters: [pathParam("id", "api_keys record id")],
            responses: {
                "200": ok("Revoked", obj({ ok: bool, id: str, revoked: bool })),
                "401": ref("Unauthorized"),
                "404": ref("NotFound"),
            },
        },
    },
    {
        method: "GET",
        path: "/api/stjorna/api-keys/me",
        tier: "Public",
        auth: "apikey",
        summary: "Introspect the bearer API key (Authorization: Bearer stjorna_…).",
        doc: {
            responses: {
                "200": ok(
                    "Tenant + metadata for the verified key",
                    obj({ ok: bool, tenant: str, id: str, prefix: str, permissions: { type: "object" }, expires: { type: "integer", nullable: true, description: "Epoch ms" } })
                ),
                "401": ref("Unauthorized"),
            },
        },
    },
    {
        method: "POST",
        path: "/api/stjorna/api-keys/exchange",
        tier: "Public",
        auth: "apikey",
        summary:
            "Exchange an API key (Authorization: Bearer or JSON {key}) for a short-lived, non-refreshable user JWT of the key's service user. Use the JWT for /api/collections/* requests.",
        doc: {
            requestBody: { required: false, content: json(obj({ key: str })) },
            responses: {
                "200": ok(
                    "Short-lived JWT",
                    obj({ ok: bool, tenant: str, token: str, record: obj({ id: str, email: str }), permissions: { type: "object" }, expiresIn: int, instructions: str })
                ),
                "400": ref("BadRequest"),
                "401": ref("Unauthorized"),
                "409": { description: "Key predates the exchange flow; re-issue it" },
            },
        },
    },

    // --- backup.pb.js ---------------------------------------------------
    {
        method: "GET",
        path: "/api/stjorna/export/{tenant}",
        tier: "Private",
        auth: "auth",
        summary: "Export one tenant (categories, products, media files) as a ZIP. Tenant members and superusers.",
        doc: {
            parameters: [pathParam("tenant", "Tenant id")],
            responses: {
                "200": { description: "Tenant export ZIP", content: { "application/zip": { schema: { type: "string", format: "binary" } } } },
                "401": ref("Unauthorized"),
                "403": ref("Forbidden"),
                "404": ref("NotFound"),
            },
        },
    },
    {
        method: "POST",
        path: "/api/stjorna/import/{tenant}",
        tier: "Private",
        auth: "auth",
        summary: "Import a tenant export (raw ZIP body, or JSON; ?source=v1 for legacy STJÓRNA JSON). Tenant admins and superusers.",
        doc: {
            parameters: [
                pathParam("tenant", "Target tenant id"),
                { name: "source", in: "query", required: false, schema: { type: "string", enum: ["v1", "v3"], default: "v3" } },
            ],
            requestBody: {
                required: true,
                content: {
                    "application/zip": { schema: { type: "string", format: "binary" } },
                    "application/json": { schema: { type: "object" } },
                },
            },
            responses: {
                "200": ok("Import result", { type: "object" }),
                "400": ref("BadRequest"),
                "401": ref("Unauthorized"),
                "403": ref("Forbidden"),
                "404": ref("NotFound"),
            },
        },
    },
];

// "/api/stjorna/api-keys/{id...}" → "/stjorna/api-keys/{id}" (relative to
// the spec's `servers: [{url: "/api"}]`).
function openapiPath(routerPath) {
    return String(routerPath).replace(/^\/api/, "").replace(/\{([A-Za-z0-9_]+)\.\.\.\}/g, "{$1}");
}

module.exports = {
    ROUTES: ROUTES,
    openapiPath: openapiPath,
};
