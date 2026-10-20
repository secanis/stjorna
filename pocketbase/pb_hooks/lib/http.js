/// <reference path="../../pb_data/types.d.ts" />

// STJÓRNA — shared helpers for custom route handlers.
//
// CommonJS module, require()d INSIDE handlers:
//     require(`${__hooks}/lib/http.js`)
// PocketBase runs each handler in an executor VM that does not see the
// top-level variables of the *.pb.js file that registered it, so shared
// code lives here instead of being string-concatenated into handlers.

// JSON response. `noStore` adds `Cache-Control: no-store` (used by every
// route that returns per-caller or secret data).
function reply(e, status, obj, noStore) {
    var body = JSON.stringify(obj);
    e.response.header().set("Content-Type", "application/json; charset=utf-8");
    if (noStore) {
        e.response.header().set("Cache-Control", "no-store");
    }
    e.string(status, body);
}

// `{ ok: false, error: { code, message } }` error envelope.
function replyError(e, status, message, noStore) {
    reply(e, status, { ok: false, error: { code: status, message: message } }, noStore);
}

// Raw request body as a string (max 64 KiB); "" when unreadable.
function readBody(e) {
    try {
        return readerToString(e.request.body, 64 * 1024);
    } catch (_e) {
        return "";
    }
}

// Lenient JSON body: unreadable / invalid / null bodies become {}.
function readJsonBody(e) {
    try {
        return JSON.parse(readBody(e) || "{}") || {};
    } catch (_e) {
        return {};
    }
}

// Safe record.get — null for missing fields or odd rows.
function getR(r, k) {
    try {
        if (r && typeof r.get === "function") return r.get(k);
    } catch (_e) {}
    return null;
}

// Normalise a PB date value to epoch ms (0 when unparseable). goja hands
// out either a Date-like object or a "YYYY-MM-DD HH:MM:SS.sssZ" string.
function toMs(v) {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "object" && typeof v.getTime === "function") {
        var g = v.getTime();
        return isNaN(g) ? 0 : g;
    }
    var p = Date.parse(String(v).replace(" ", "T"));
    return isNaN(p) ? 0 : p;
}

// PB auth/date stamp format used for `last_used` ("YYYY-MM-DD HH:MM:SSZ").
function nowStamp() {
    return new Date().toISOString().replace("T", " ").replace(/\..*$/, "Z");
}

// True when `userId` holds the `admin` role in `tenantId` (any tenant
// when tenantId is empty/undefined).
function hasAdminRole(app, userId, tenantId) {
    if (!userId) return false;
    try {
        var rows = tenantId
            ? app.findRecordsByFilter("user_tenants", "user={:u} && tenant={:t}", "", 0, 0, { u: userId, t: tenantId })
            : app.findRecordsByFilter("user_tenants", "user={:u}", "", 0, 0, { u: userId });
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (!row) continue;
            var roleId = "";
            try { roleId = String(row.get("role") || ""); } catch (_) {}
            if (!roleId) continue;
            try {
                var role = app.findRecordById("roles", roleId);
                if (role && String(role.get("name") || "") === "admin") return true;
            } catch (_) {}
        }
    } catch (_) {}
    return false;
}

// Superuser, or authenticated user with the admin role in `tenantId`.
function isTenantAdmin(e, tenantId) {
    if (!tenantId) return false;
    if (e.hasSuperuserAuth()) return true;
    if (!e.auth) return false;
    return hasAdminRole($app, String(e.auth.id || ""), tenantId);
}

module.exports = {
    reply: reply,
    replyError: replyError,
    readBody: readBody,
    readJsonBody: readJsonBody,
    getR: getR,
    toMs: toMs,
    nowStamp: nowStamp,
    hasAdminRole: hasAdminRole,
    isTenantAdmin: isTenantAdmin,
};
