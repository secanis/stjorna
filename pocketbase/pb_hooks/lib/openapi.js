/// <reference path="../../pb_data/types.d.ts" />

// STJÓRNA — OpenAPI 3.0.3 spec, built at request time.
//
//   - Collection paths + schemas come from $app.findAllCollections():
//     system and `_`-prefixed collections are skipped, hidden fields are
//     omitted, and each operation's tier is derived from the collection's
//     ACTUAL API rule: null → Admin (superusers only), "" → Public,
//     expression → Private (authenticated; the rule decides which records).
//   - Custom routes come from lib/routes.js (the route registry).
//   - The tier visible to the caller is filtered by auth: anonymous →
//     Public, user → Public + Private, superuser → everything. Schemas are
//     only included when referenced by a visible operation.

var routes = require(`${__hooks}/lib/routes.js`);

var TIERS = ["Public", "Private", "Admin"];

// Friendly component names for known collections; anything else is
// PascalCased.
var SCHEMA_NAMES = {
    tenants: "Tenant",
    roles: "Role",
    user_tenants: "UserTenant",
    categories: "Category",
    products: "Product",
    media: "Media",
    instance_settings: "InstanceSettings",
    users: "User",
    api_keys: "ApiKey",
};

function schemaName(collectionName) {
    if (SCHEMA_NAMES[collectionName]) return SCHEMA_NAMES[collectionName];
    return String(collectionName)
        .split(/[^A-Za-z0-9]+/)
        .map(function (p) {
            return p ? p.charAt(0).toUpperCase() + p.slice(1) : "";
        })
        .join("");
}

function version() {
    var v = "";
    try {
        v = String($os.getenv("STJORNA_VERSION") || "").trim();
    } catch (_e) {}
    if (!v || v === "dev") return "3.x";
    return v.replace(/^v/, "");
}

function ruleTier(rule) {
    if (rule === null || rule === undefined) return "Admin";
    if (String(rule) === "") return "Public";
    return "Private";
}

function multi(f) {
    var m = Number(f.maxSelect || 0);
    return m > 1;
}

// OpenAPI schema for one PB field (plain JS object from the collection JSON).
function fieldSchema(f) {
    var s;
    switch (f.type) {
        case "number":
            s = { type: "number" };
            break;
        case "bool":
            s = { type: "boolean" };
            break;
        case "json":
            s = { description: "JSON value" };
            break;
        case "date":
        case "autodate":
            s = { type: "string", description: "Date-time, \"YYYY-MM-DD HH:MM:SS.sssZ\"" };
            break;
        case "email":
            s = { type: "string", format: "email" };
            break;
        case "url":
            s = { type: "string", format: "uri" };
            break;
        case "select":
            s = { type: "string" };
            if (Array.isArray(f.values) && f.values.length) s.enum = f.values.slice();
            if (multi(f)) s = { type: "array", items: s };
            break;
        case "relation":
            s = { type: "string", description: "Record id" };
            if (multi(f)) s = { type: "array", items: s, description: "Record ids" };
            break;
        case "file":
            s = { type: "string", description: "File name (upload via multipart/form-data)" };
            if (multi(f)) s = { type: "array", items: { type: "string" }, description: "File names" };
            break;
        default:
            s = { type: "string" };
    }
    if (f.system && f.name === "id") s.readOnly = true;
    if (f.type === "autodate") s.readOnly = true;
    return s;
}

// Plain JSON view of a collection (field options, rules) — avoids
// depending on goja's Go-struct accessor naming.
function collectionJson(c) {
    return JSON.parse(JSON.stringify(c));
}

function collectionSchema(cj) {
    var props = {};
    var fields = cj.fields || [];
    for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        if (!f || f.hidden) continue;
        props[f.name] = fieldSchema(f);
    }
    return { type: "object", properties: props };
}

var LIST_PARAMS = [
    { $ref: "#/components/parameters/Page" },
    { $ref: "#/components/parameters/PerPage" },
    { $ref: "#/components/parameters/Filter" },
    { $ref: "#/components/parameters/Sort" },
    { $ref: "#/components/parameters/Expand" },
    { $ref: "#/components/parameters/Fields" },
];

function errRef(name) {
    return { $ref: "#/components/responses/" + name };
}

function op(tier, summary, extra) {
    var o = { tags: [tier], summary: summary };
    if (tier !== "Public") o.security = [{ bearerAuth: [] }];
    for (var k in extra) o[k] = extra[k];
    return o;
}

function tierNote(tier, rule) {
    if (tier === "Admin") return " (superusers only)";
    if (tier === "Public") return " (public)";
    return " (authenticated; rule: " + rule + ")";
}

function addCollectionPaths(paths, schemas, cj) {
    var name = cj.name;
    var sname = schemaName(name);
    var sref = { $ref: "#/components/schemas/" + sname };
    schemas[sname] = collectionSchema(cj);

    var bodyContent = { "application/json": { schema: sref } };
    var hasFile = (cj.fields || []).some(function (f) {
        return f && f.type === "file" && !f.hidden;
    });
    if (hasFile) bodyContent["multipart/form-data"] = { schema: sref };

    var single = { description: sname + " record", content: { "application/json": { schema: sref } } };
    var list = {
        description: "Paginated list of " + name,
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    properties: {
                        page: { type: "integer" },
                        perPage: { type: "integer" },
                        totalItems: { type: "integer" },
                        totalPages: { type: "integer" },
                        items: { type: "array", items: sref },
                    },
                },
            },
        },
    };
    var t;
    var base = "/collections/" + name + "/records";
    paths[base] = {};
    t = ruleTier(cj.listRule);
    paths[base].get = op(t, "List " + name + tierNote(t, cj.listRule), {
        parameters: LIST_PARAMS,
        responses: { "200": list, "400": errRef("BadRequest"), "403": errRef("Forbidden") },
    });
    t = ruleTier(cj.createRule);
    paths[base].post = op(t, "Create " + name + tierNote(t, cj.createRule), {
        requestBody: { required: true, content: bodyContent },
        responses: { "200": single, "400": errRef("BadRequest"), "403": errRef("Forbidden") },
    });

    var item = base + "/{id}";
    paths[item] = { parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] };
    t = ruleTier(cj.viewRule);
    paths[item].get = op(t, "Get " + name + " record" + tierNote(t, cj.viewRule), {
        parameters: [{ $ref: "#/components/parameters/Expand" }, { $ref: "#/components/parameters/Fields" }],
        responses: { "200": single, "403": errRef("Forbidden"), "404": errRef("NotFound") },
    });
    t = ruleTier(cj.updateRule);
    paths[item].patch = op(t, "Update " + name + " record" + tierNote(t, cj.updateRule), {
        requestBody: { required: true, content: bodyContent },
        responses: { "200": single, "400": errRef("BadRequest"), "403": errRef("Forbidden"), "404": errRef("NotFound") },
    });
    t = ruleTier(cj.deleteRule);
    paths[item].delete = op(t, "Delete " + name + " record" + tierNote(t, cj.deleteRule), {
        responses: { "204": { description: "Deleted" }, "400": errRef("BadRequest"), "403": errRef("Forbidden"), "404": errRef("NotFound") },
    });

    if (cj.type === "auth") {
        paths["/collections/" + name + "/auth-with-password"] = {
            post: op("Public", "Authenticate a " + name + " record (login)", {
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["identity", "password"],
                                properties: { identity: { type: "string" }, password: { type: "string" } },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Authenticated",
                        content: {
                            "application/json": {
                                schema: { type: "object", properties: { token: { type: "string" }, record: sref } },
                            },
                        },
                    },
                    "400": errRef("BadRequest"),
                },
            }),
        };
    }
}

function addCustomRoutes(paths) {
    var list = routes.ROUTES;
    for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.hidden) continue;
        var p = routes.openapiPath(r.path);
        var tags = Array.isArray(r.tier) ? r.tier.slice() : [r.tier];
        var o = { tags: tags, summary: r.summary || "" };
        if (r.auth === "auth" || r.auth === "superuser") o.security = [{ bearerAuth: [] }];
        if (r.auth === "apikey") o.security = [{ apiKey: [] }];
        var doc = r.doc || {};
        for (var k in doc) o[k] = doc[k];
        if (!o.responses) o.responses = { "200": { description: "OK" } };
        if (!paths[p]) paths[p] = {};
        paths[p][r.method.toLowerCase()] = o;
    }
}

// Full (superuser) spec.
function buildFullSpec() {
    var paths = {
        "/health": {
            get: op("Public", "Health check", {
                responses: {
                    "200": {
                        description: "Service is healthy",
                        content: {
                            "application/json": {
                                schema: { type: "object", properties: { code: { type: "integer" }, message: { type: "string" }, data: { type: "object" } } },
                            },
                        },
                    },
                },
            }),
        },
    };
    var schemas = {
        Error: {
            type: "object",
            properties: { status: { type: "integer" }, message: { type: "string" }, data: { type: "object" } },
        },
    };

    var cols = $app.findAllCollections();
    var cjs = [];
    for (var i = 0; i < cols.length; i++) {
        var cj = collectionJson(cols[i]);
        if (!cj || cj.system || !cj.name || cj.name.charAt(0) === "_") continue;
        if (cj.type === "view") continue;
        cjs.push(cj);
    }
    cjs.sort(function (a, b) {
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    for (var j = 0; j < cjs.length; j++) addCollectionPaths(paths, schemas, cjs[j]);
    addCustomRoutes(paths);

    var errResp = function (d) {
        return { description: d, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
    };
    return {
        openapi: "3.0.3",
        info: {
            title: "STJÓRNA API",
            description:
                "Multi-tenant product management API (PocketBase). Three tiers derived from the live collection API rules: Public (no auth), Private (authenticated user; the rule restricts records to the caller's tenants), Admin (PocketBase superusers only).",
            version: version(),
            contact: { name: "STJÓRNA" },
        },
        servers: [{ url: "/api", description: "PocketBase API root" }],
        tags: [
            { name: "Public", description: "No authentication required" },
            { name: "Private", description: "Requires a user token; access is limited by the collection rule / route check" },
            { name: "Admin", description: "Requires a PocketBase superuser token" },
        ],
        components: {
            securitySchemes: {
                bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
                apiKey: { type: "http", scheme: "bearer", description: "STJÓRNA API key (stjorna_<prefix>.<secret>)" },
            },
            schemas: schemas,
            parameters: {
                Page: { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                PerPage: { name: "perPage", in: "query", schema: { type: "integer", default: 30 } },
                Filter: { name: "filter", in: "query", schema: { type: "string" } },
                Sort: { name: "sort", in: "query", schema: { type: "string" } },
                Expand: { name: "expand", in: "query", schema: { type: "string" } },
                Fields: { name: "fields", in: "query", schema: { type: "string" } },
            },
            responses: {
                Unauthorized: errResp("Missing or invalid auth token"),
                Forbidden: errResp("Authenticated but not allowed"),
                NotFound: errResp("Resource not found"),
                BadRequest: errResp("Invalid request"),
            },
        },
        paths: paths,
    };
}

// Collects "#/components/schemas/X" refs reachable from `node`.
function collectSchemaRefs(node, out) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) collectSchemaRefs(node[i], out);
        return;
    }
    for (var k in node) {
        var v = node[k];
        if (k === "$ref" && typeof v === "string" && v.indexOf("#/components/schemas/") === 0) {
            out[v.slice("#/components/schemas/".length)] = true;
        } else {
            collectSchemaRefs(v, out);
        }
    }
}

// Restricts a spec to operations tagged with one of `allowed`; drops
// higher-tier tags from mixed ops and schemas no visible op references.
function filterSpecByTag(spec, allowed) {
    var isAllowed = function (t) {
        return allowed.indexOf(t) !== -1;
    };
    var paths = {};
    for (var p in spec.paths) {
        var ops = {};
        var hasOp = false;
        for (var m in spec.paths[p]) {
            if (m === "parameters") continue;
            var o = spec.paths[p][m];
            if (o && o.tags && o.tags.some(isAllowed)) {
                var copy = {};
                for (var k in o) copy[k] = o[k];
                copy.tags = o.tags.filter(isAllowed);
                ops[m] = copy;
                hasOp = true;
            }
        }
        if (!hasOp) continue;
        if (spec.paths[p].parameters) ops.parameters = spec.paths[p].parameters;
        paths[p] = ops;
    }
    var used = { Error: true };
    collectSchemaRefs(paths, used);
    var schemas = {};
    for (var s in spec.components.schemas) {
        if (used[s]) schemas[s] = spec.components.schemas[s];
    }
    var components = {};
    for (var c in spec.components) components[c] = spec.components[c];
    components.schemas = schemas;
    return {
        openapi: spec.openapi,
        info: spec.info,
        servers: spec.servers,
        tags: spec.tags.filter(function (t) {
            return isAllowed(t.name);
        }),
        components: components,
        paths: paths,
    };
}

function specFor(e) {
    var full = buildFullSpec();
    if (e.auth && e.hasSuperuserAuth()) return full;
    if (e.auth) return filterSpecByTag(full, ["Public", "Private"]);
    return filterSpecByTag(full, ["Public"]);
}

// GET /api/openapi.json, /api/openapi
function handler(e) {
    var spec;
    try {
        spec = specFor(e);
    } catch (err) {
        console.log("[stjorna-openapi] spec build failed: " + ((err && err.message) || err));
        throw err;
    }
    e.response.header().set("Content-Type", "application/json; charset=utf-8");
    e.string(200, JSON.stringify(spec));
}

module.exports = {
    TIERS: TIERS,
    ruleTier: ruleTier,
    buildFullSpec: buildFullSpec,
    filterSpecByTag: filterSpecByTag,
    handler: handler,
};
