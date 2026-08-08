var SPEC = {
    openapi: "3.0.3",
    info: {
        title: "STJÓRNA API",
        description: "Multi-tenant product management API. Three tiers: Public (unauthenticated reads), Private (authenticated user CRUD), Admin (administrator operations).",
        version: "1.0.0",
        contact: { name: "STJÓRNA" }
    },
    servers: [{ url: "/api", description: "PocketBase API root" }],
    tags: [
        { name: "Public", description: "Unauthenticated endpoints - safe for storefront use" },
        { name: "Private", description: "Authenticated user endpoints - require valid user token" },
        { name: "Admin", description: "Administrator endpoints - require admin token" }
    ],
    components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
        schemas: {
            Error: { type: "object", properties: { code: { type: "integer" }, message: { type: "string" }, data: { type: "object" } } },
            Tenant: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, description: { type: "string" }, users: { type: "array", items: { type: "string" } } } },
            Role: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" } } },
            UserTenant: { type: "object", properties: { id: { type: "string" }, user: { type: "string" }, tenant: { type: "string" }, role: { type: "string" } } },
            Category: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, description: { type: "string" }, tenant: { type: "string" }, media: { type: "string", description: "Optional media record id (single-relation)" } } },
            Product: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, slug: { type: "string" }, description: { type: "string" }, price: { type: "number" }, sku: { type: "string" }, tenant: { type: "string" }, category: { type: "string" }, media: { type: "array", items: { type: "string" } } } },
            Media: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, original_name: { type: "string" }, mime_type: { type: "string" }, size: { type: "integer" }, s3_url: { type: "string" }, thumbnail_url: { type: "string" }, tenant: { type: "string" } } },
            InstanceSettings: { type: "object", properties: { id: { type: "string" }, s3_bucket: { type: "string" }, s3_region: { type: "string" }, s3_endpoint: { type: "string" }, s3_access_key: { type: "string" } } },
            User: { type: "object", properties: { id: { type: "string" }, email: { type: "string" }, name: { type: "string" }, verified: { type: "boolean" } } },
            AuthRecord: { type: "object", properties: { token: { type: "string" }, record: { $ref: "#/components/schemas/User" } } },
            ListMeta: { type: "object", properties: { page: { type: "integer" }, perPage: { type: "integer" }, totalItems: { type: "integer" }, totalPages: { type: "integer" } } }
        },
        parameters: {
            Page: { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            PerPage: { name: "perPage", in: "query", schema: { type: "integer", default: 30 } },
            Filter: { name: "filter", in: "query", schema: { type: "string" } },
            Sort: { name: "sort", in: "query", schema: { type: "string" } },
            Expand: { name: "expand", in: "query", schema: { type: "string" } }
        },
        responses: {
            Unauthorized: { description: "Missing or invalid auth token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            Forbidden: { description: "Authenticated but not allowed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            NotFound: { description: "Resource not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            BadRequest: { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
        }
    },
    paths: {
        "/health": {
            get: { tags: ["Public"], summary: "Health check", responses: { "200": { description: "Service is healthy", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" }, code: { type: "integer" } } } } } } } }
        },
        "/collections/categories/records": {
            get: {
                tags: ["Public"], summary: "List categories (public read)",
                parameters: [
                    { $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/PerPage" },
                    { $ref: "#/components/parameters/Filter" }, { $ref: "#/components/parameters/Sort" },
                    { $ref: "#/components/parameters/Expand" }
                ],
                responses: {
                    "200": { description: "Paginated list of categories", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Category" } }, meta: { $ref: "#/components/schemas/ListMeta" } } } } } },
                    "400": { $ref: "#/components/responses/BadRequest" }
                }
            },
            post: {
                tags: ["Private"], summary: "Create category (authenticated)", security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Category" } } } },
                responses: {
                    "200": { description: "Created category", content: { "application/json": { schema: { $ref: "#/components/schemas/Category" } } } },
                    "400": { $ref: "#/components/responses/BadRequest" },
                    "401": { $ref: "#/components/responses/Unauthorized" }
                }
            }
        },
        "/collections/categories/records/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            get: { tags: ["Public"], summary: "Get category by id (public read)", responses: { "200": { description: "Category record", content: { "application/json": { schema: { $ref: "#/components/schemas/Category" } } } }, "404": { $ref: "#/components/responses/NotFound" } } },
            patch: { tags: ["Private"], summary: "Update category (authenticated)", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Category" } } } }, responses: { "200": { description: "Updated category", content: { "application/json": { schema: { $ref: "#/components/schemas/Category" } } } }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" }, "404": { $ref: "#/components/responses/NotFound" } } },
            delete: { tags: ["Private"], summary: "Delete category (authenticated)", security: [{ bearerAuth: [] }], responses: { "204": { description: "Category deleted" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" }, "404": { $ref: "#/components/responses/NotFound" } } }
        },
        "/collections/products/records": {
            get: {
                tags: ["Public"], summary: "List products (public read)",
                parameters: [
                    { $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/PerPage" },
                    { $ref: "#/components/parameters/Filter" }, { $ref: "#/components/parameters/Sort" },
                    { $ref: "#/components/parameters/Expand" }
                ],
                responses: {
                    "200": { description: "Paginated list of products", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Product" } }, meta: { $ref: "#/components/schemas/ListMeta" } } } } } },
                    "400": { $ref: "#/components/responses/BadRequest" }
                }
            },
            post: { tags: ["Private"], summary: "Create product (authenticated)", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } }, responses: { "200": { description: "Created product", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } }, "400": { $ref: "#/components/responses/BadRequest" }, "401": { $ref: "#/components/responses/Unauthorized" } } }
        },
        "/collections/products/records/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            get: { tags: ["Public"], summary: "Get product by id (public read)", responses: { "200": { description: "Product record", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } }, "404": { $ref: "#/components/responses/NotFound" } } },
            patch: { tags: ["Private"], summary: "Update product (authenticated)", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } }, responses: { "200": { description: "Updated product", content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } } }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" }, "404": { $ref: "#/components/responses/NotFound" } } },
            delete: { tags: ["Private"], summary: "Delete product (authenticated)", security: [{ bearerAuth: [] }], responses: { "204": { description: "Product deleted" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" }, "404": { $ref: "#/components/responses/NotFound" } } }
        },
        "/collections/media/records": {
            get: {
                tags: ["Private"], summary: "List media (authenticated)", security: [{ bearerAuth: [] }],
                parameters: [
                    { $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/PerPage" },
                    { $ref: "#/components/parameters/Filter" }, { $ref: "#/components/parameters/Sort" }
                ],
                responses: {
                    "200": { description: "Paginated list of media", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Media" } }, meta: { $ref: "#/components/schemas/ListMeta" } } } } } },
                    "401": { $ref: "#/components/responses/Unauthorized" }
                }
            },
            post: {
                tags: ["Private"], summary: "Upload media (authenticated, multipart)", security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" }, name: { type: "string" }, tenant: { type: "string" } } } } } },
                responses: { "200": { description: "Created media record", content: { "application/json": { schema: { $ref: "#/components/schemas/Media" } } } }, "400": { $ref: "#/components/responses/BadRequest" }, "401": { $ref: "#/components/responses/Unauthorized" } }
            }
        },
        "/collections/media/records/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            get: { tags: ["Private"], summary: "Get media by id (authenticated)", security: [{ bearerAuth: [] }], responses: { "200": { description: "Media record", content: { "application/json": { schema: { $ref: "#/components/schemas/Media" } } } }, "401": { $ref: "#/components/responses/Unauthorized" }, "404": { $ref: "#/components/responses/NotFound" } } },
            patch: { tags: ["Private"], summary: "Update media metadata (authenticated)", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Media" } } } }, responses: { "200": { description: "Updated media", content: { "application/json": { schema: { $ref: "#/components/schemas/Media" } } } }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } },
            delete: { tags: ["Private"], summary: "Delete media + S3 file (authenticated)", security: [{ bearerAuth: [] }], responses: { "204": { description: "Media deleted" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } }
        },
        "/collections/tenants/records": {
            get: {
                tags: ["Private"], summary: "List tenants (authenticated)", security: [{ bearerAuth: [] }],
                parameters: [{ $ref: "#/components/parameters/Page" }, { $ref: "#/components/parameters/PerPage" }],
                responses: { "200": { description: "Paginated list of tenants", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Tenant" } }, meta: { $ref: "#/components/schemas/ListMeta" } } } } } }, "401": { $ref: "#/components/responses/Unauthorized" } }
            },
            post: { tags: ["Admin"], summary: "Create tenant (admin only)", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Tenant" } } } }, responses: { "200": { description: "Created tenant", content: { "application/json": { schema: { $ref: "#/components/schemas/Tenant" } } } }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } }
        },
        "/collections/tenants/records/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            get: { tags: ["Private"], summary: "Get tenant by id (authenticated)", security: [{ bearerAuth: [] }], responses: { "200": { description: "Tenant record", content: { "application/json": { schema: { $ref: "#/components/schemas/Tenant" } } } }, "401": { $ref: "#/components/responses/Unauthorized" } } },
            patch: { tags: ["Admin"], summary: "Update tenant (admin only)", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Tenant" } } } }, responses: { "200": { description: "Updated tenant", content: { "application/json": { schema: { $ref: "#/components/schemas/Tenant" } } } }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } },
            delete: { tags: ["Admin"], summary: "Delete tenant (admin only)", security: [{ bearerAuth: [] }], responses: { "204": { description: "Tenant deleted" }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } }
        },
        "/collections/instance_settings/records": {
            get: { tags: ["Admin"], summary: "List instance settings (admin only)", security: [{ bearerAuth: [] }], responses: { "200": { description: "Instance settings (singleton)", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/InstanceSettings" } } } } } } }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } },
            post: { tags: ["Admin"], summary: "Create instance settings (admin only)", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/InstanceSettings" } } } }, responses: { "200": { description: "Created settings", content: { "application/json": { schema: { $ref: "#/components/schemas/InstanceSettings" } } } }, "401": { $ref: "#/components/responses/Unauthorized" } } }
        },
        "/collections/instance_settings/records/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            patch: { tags: ["Admin"], summary: "Update instance settings (admin only)", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/InstanceSettings" } } } }, responses: { "200": { description: "Updated settings", content: { "application/json": { schema: { $ref: "#/components/schemas/InstanceSettings" } } } }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } }
        },
        "/collections/users/auth-with-password": {
            post: {
                tags: ["Public"], summary: "Authenticate user (login)",
                requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["identity", "password"], properties: { identity: { type: "string" }, password: { type: "string" } } } } } },
                responses: { "200": { description: "Authenticated", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthRecord" } } } }, "400": { $ref: "#/components/responses/BadRequest" } }
            }
        },
        "/collections/users/records/{id}": {
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
            get: { tags: ["Private"], summary: "Get user (self or admin)", security: [{ bearerAuth: [] }], responses: { "200": { description: "User record", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } }, "401": { $ref: "#/components/responses/Unauthorized" } } }
        },
        "/collections/user_tenants/records": {
            get: { tags: ["Admin"], summary: "List user-tenant assignments (admin only)", security: [{ bearerAuth: [] }], responses: { "200": { description: "Paginated list of user_tenants", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/UserTenant" } }, meta: { $ref: "#/components/schemas/ListMeta" } } } } } }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } },
            post: { tags: ["Admin"], summary: "Assign user to tenant (admin only)", security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UserTenant" } } } }, responses: { "200": { description: "Assignment created", content: { "application/json": { schema: { $ref: "#/components/schemas/UserTenant" } } } }, "401": { $ref: "#/components/responses/Unauthorized" }, "403": { $ref: "#/components/responses/Forbidden" } } }
        },
        "/api/backup/json": {
            get: {
                tags: ["Admin"], summary: "Download full backup as JSON manifest (admin only)", security: [{ bearerAuth: [] }],
                responses: {
                    "200": { description: "Backup manifest as JSON", content: { "application/json": { schema: { type: "object", properties: { version: { type: "string" }, kind: { type: "string" }, schema_version: { type: "integer" }, exported_at: { type: "string", format: "date-time" }, collections: { type: "object" } } } } } },
                    "401": { $ref: "#/components/responses/Unauthorized" }
                }
            }
        },
        "/api/backup/zip": {
            get: {
                tags: ["Admin"], summary: "Download full backup as ZIP (manifest + media files, admin only)", security: [{ bearerAuth: [] }],
                responses: {
                    "200": { description: "Backup ZIP archive", content: { "application/zip": { schema: { type: "string", format: "binary" } } } },
                    "401": { $ref: "#/components/responses/Unauthorized" }
                }
            }
        },
        "/api/backup/import": {
            post: {
                tags: ["Admin"], summary: "Import a backup file (JSON or ZIP) into a target tenant. tenant admin OR pb_admin. Source = 'v1' (legacy STJÓRNA) or 'v3' (current).", security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "tenant", in: "query", required: true, schema: { type: "string" }, description: "Target tenant id" },
                    { name: "source", in: "query", required: false, schema: { type: "string", enum: ["v1", "v3"], default: "v3" }, description: "Backup source format" }
                ],
                requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["tenant", "data_base64"], properties: { tenant: { type: "string" }, source: { type: "string", enum: ["v1", "v3"] }, filename: { type: "string" }, data_base64: { type: "string", description: "Base64-encoded file content (JSON manifest or ZIP)" } } } } } },
                responses: {
                    "200": { description: "Import result", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, stats: { type: "object", properties: { imported: { type: "object" }, skipped: { type: "object" }, warnings: { type: "array", items: { type: "string" } } } } } } }}},
                    "400": { $ref: "#/components/responses/BadRequest" },
                    "401": { $ref: "#/components/responses/Unauthorized" },
                    "403": { $ref: "#/components/responses/Forbidden" },
                    "404": { $ref: "#/components/responses/NotFound" }
                }
            }
        }
    }
};

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

var FULL_SPEC     = SPEC;
var PRIVATE_SPEC  = filterSpecByTag(SPEC, ["Public", "Private"]);
var PUBLIC_SPEC   = filterSpecByTag(SPEC, ["Public"]);

var JSON_SPEC_FULL     = JSON.stringify(FULL_SPEC);
var JSON_SPEC_PRIVATE  = JSON.stringify(PRIVATE_SPEC);
var JSON_SPEC_PUBLIC   = JSON.stringify(PUBLIC_SPEC);

var B64URL_DECODE_FN =
    "var _B='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';" +
    "var _L={};" +
    "var _i=0;" +
    "while(_i<_B.length){_L[_B[_i]]=_i;_i=_i+1;}" +
    "function b64(s){" +
        "s=String(s).replace(/-/g,'+').replace(/_/g,'/');" +
        "while(s.length%4)s=s+'=';" +
        "var out='';" +
        "var buf=0;" +
        "var bits=0;" +
        "var j=0;" +
        "while(j<s.length){" +
            "var c=s[j];" +
            "j=j+1;" +
            "if(c==='=')break;" +
            "var v=_L[c];" +
            "if(v===undefined)continue;" +
            "buf=(buf<<6)|v;" +
            "bits=bits+6;" +
            "if(bits>=8){" +
                "bits=bits-8;" +
                "out=out+String.fromCharCode((buf>>bits)&0xFF);" +
            "}" +
        "}" +
        "return out;" +
    "}";

var BODY =
    "var h=String(c.request().header.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();" +
    "var body=" + JSON.stringify(JSON_SPEC_PUBLIC) + ";" +
    "if(h.length>0){" +
        B64URL_DECODE_FN +
        "try{" +
            "var p=JSON.parse(b64(h.split('.')[1]||''));" +
            "if(p&&p.type==='admin')body=" + JSON.stringify(JSON_SPEC_FULL) + ";" +
            "else if(p&&p.type==='authRecord')body=" + JSON.stringify(JSON_SPEC_PRIVATE) + ";" +
        "}catch(e){}" +
    "}" +
    "c.response().header().set('Content-Type','application/json; charset=utf-8');" +
    "c.string(200,body);";

routerAdd("GET", "/api/openapi.json", new Function("c", BODY));
routerAdd("GET", "/api/openapi", new Function("c", BODY));

console.log("[stjorna] openapi.pb.js role-based routes registered (full=" + JSON_SPEC_FULL.length + " bytes, private=" + JSON_SPEC_PRIVATE.length + " bytes, public=" + JSON_SPEC_PUBLIC.length + " bytes)");
