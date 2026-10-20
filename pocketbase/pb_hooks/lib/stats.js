/// <reference path="../../pb_data/types.d.ts" />

// STJÓRNA v3 — per-tenant statistics handler. Registered by stats.pb.js;
// see that file for the auth model.

var http = require(`${__hooks}/lib/http.js`);
var getR = http.getR;
var toMs = http.toMs;

function fail(e, status, message) {
    http.replyError(e, status, message, true);
}

function str(r, k) {
    return String(getR(r, k) || "");
}

// Resolves the tenant the caller may see. Returns "" after having
// written an error response.
function resolveTenant(e) {
    var reqTenant = String(e.request.url.query().get("tenant") || "").trim();
    // Superusers must name a tenant explicitly (no "all tenants" default).
    if (e.hasSuperuserAuth()) {
        if (!reqTenant) {
            fail(e, 400, "tenant query param is required for superuser callers");
            return "";
        }
        return reqTenant;
    }
    // Tenant users: membership comes from `user_tenants`; `last_tenant`
    // on the auth record breaks ties between multiple memberships.
    var authId = String(e.auth.id || "");
    if (!authId) {
        fail(e, 401, "token missing record id");
        return "";
    }
    var lastTenant = "";
    try {
        lastTenant = str(e.auth.record ? e.auth.record() : null, "last_tenant");
    } catch (_e) {}
    if (!lastTenant) {
        try {
            lastTenant = str($app.findRecordById("_pb_users_auth_", authId), "last_tenant");
        } catch (_e) {}
    }
    var rows = [];
    try {
        rows = $app.findRecordsByFilter("user_tenants", "user={:u}", "", 0, 0, { u: authId }) || [];
    } catch (_e) {
        rows = [];
    }
    var seen = {};
    var unique = [];
    for (var i = 0; i < rows.length; i++) {
        if (!rows[i]) continue;
        var t = str(rows[i], "tenant");
        if (t && !seen[t]) {
            seen[t] = 1;
            unique.push(t);
        }
    }
    if (unique.length === 0) {
        fail(e, 403, "user has no tenant membership");
        return "";
    }
    var tenant = lastTenant && seen[lastTenant] ? lastTenant : unique[0];
    // ?tenant=<other> from a tenant user is a hard 403, never a silent switch.
    if (reqTenant && reqTenant !== tenant) {
        fail(e, 403, "cannot query stats for a different tenant");
        return "";
    }
    return tenant;
}

// All rows of `name` belonging to `tenantId` (post-filtered in JS).
function tenantRows(name, tenantId) {
    var rows = [];
    try {
        rows = $app.findRecordsByFilter(name, "", "", 0, 0) || [];
    } catch (err) {
        console.log("[stjorna-stats] " + name + " fetch failed: " + (err && (err.message || err)));
    }
    var out = [];
    for (var i = 0; i < rows.length; i++) {
        if (rows[i] && String(getR(rows[i], "tenant")) === tenantId) out.push(rows[i]);
    }
    return out;
}

// GET /api/stjorna/stats[?tenant=<id>]
function statsHandler(e) {
    if (!e.auth) return fail(e, 401, "unauthorized");
    if (!e.hasSuperuserAuth() && !e.auth.id) return fail(e, 401, "unrecognized token type");

    var tenantId = resolveTenant(e);
    if (!tenantId) return;

    var tenant = null;
    try {
        tenant = $app.findRecordById("tenants", tenantId);
    } catch (_et) {
        return fail(e, 404, "tenant not found");
    }
    if (!tenant) return fail(e, 404, "tenant not found");

    var cats = tenantRows("categories", tenantId);
    var prods = tenantRows("products", tenantId);
    var mediaRows = tenantRows("media", tenantId);
    // Users = memberships; superusers are cross-tenant and not counted.
    var memberships = tenantRows("user_tenants", tenantId);

    var mediaBytes = 0;
    var largest = null;
    var mimeMap = {};
    for (var mi = 0; mi < mediaRows.length; mi++) {
        var mr = mediaRows[mi];
        var sz = Number(getR(mr, "size") || 0) || 0;
        if (sz < 0 || !isFinite(sz)) sz = 0;
        var mime = str(mr, "mime_type") || "application/octet-stream";
        if (!mimeMap[mime]) mimeMap[mime] = { count: 0, bytes: 0 };
        mimeMap[mime].count += 1;
        mimeMap[mime].bytes += sz;
        mediaBytes += sz;
        if (!largest || sz > largest.bytes) {
            largest = {
                id: mr.id,
                filename: String(getR(mr, "filename") || getR(mr, "original_name") || ""),
                bytes: sz,
                mime_type: mime,
            };
        }
    }
    var byMime = [];
    for (var mk in mimeMap) {
        if (Object.prototype.hasOwnProperty.call(mimeMap, mk)) {
            byMime.push({ mime_type: mk, count: mimeMap[mk].count, bytes: mimeMap[mk].bytes });
        }
    }
    byMime.sort(function (a, b) {
        return b.bytes - a.bytes;
    });

    var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    var prodCreated = 0;
    var prodUpdated = 0;
    for (var pi = 0; pi < prods.length; pi++) {
        var created = toMs(getR(prods[pi], "created"));
        var updated = toMs(getR(prods[pi], "updated"));
        if (created >= cutoff) prodCreated++;
        if (updated >= cutoff && updated !== created) prodUpdated++;
    }
    var countRecent = function (rows) {
        var n = 0;
        for (var i = 0; i < rows.length; i++) {
            if (toMs(getR(rows[i], "created")) >= cutoff) n++;
        }
        return n;
    };

    var mediaCount = mediaRows.length;
    http.reply(
        e,
        200,
        {
            ok: true,
            tenant: {
                id: tenant.id,
                name: str(tenant, "name"),
                slug: str(tenant, "slug"),
                plan: String(getR(tenant, "plan") || "free"),
                custom_domain: str(tenant, "custom_domain"),
            },
            counts: {
                categories: cats.length,
                products: prods.length,
                media: mediaCount,
                users: memberships.length,
            },
            storage: {
                media_bytes: mediaBytes,
                media_count: mediaCount,
                avg_media_bytes: mediaCount > 0 ? Math.round(mediaBytes / mediaCount) : 0,
                largest_media: largest,
                by_mime_type: byMime,
            },
            activity_30d: {
                products_created: prodCreated,
                products_updated: prodUpdated,
                media_uploaded: countRecent(mediaRows),
                categories_created: countRecent(cats),
            },
            generated_at: new Date().toISOString(),
        },
        true
    );
}

module.exports = { statsHandler: statsHandler };
