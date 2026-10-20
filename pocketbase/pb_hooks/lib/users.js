/// <reference path="../../pb_data/types.d.ts" />

// STJÓRNA — user directory handlers for tenant admins. Registered by
// users_search.pb.js; see that file for the access model.

var http = require(`${__hooks}/lib/http.js`);

function fail(e, status, message) {
    http.replyError(e, status, message, true);
}

function safeStr(r, k) {
    try {
        return String(r.get(k) || "");
    } catch (_e) {
        return "";
    }
}

// GET /api/stjorna/users/search?q=<email>
// Superusers: substring match. Tenant admins (admin role in any tenant):
// exact-email match only, to avoid account enumeration.
function searchHandler(e) {
    if (!e.auth) return fail(e, 401, "unauthorized");
    var isSuperuser = !!e.hasSuperuserAuth();
    if (!isSuperuser) {
        var uid = String(e.auth.id || "");
        if (!uid || !http.hasAdminRole($app, uid)) {
            return fail(e, 403, "only tenant admins can search users");
        }
    }
    var q = String(e.request.url.query().get("q") || "").trim();
    if (!q) return http.reply(e, 200, { ok: true, users: [] }, true);
    var users = [];
    try {
        var rows = $app.findRecordsByFilter("users", isSuperuser ? "email~{:q}" : "email={:q}", "", 10, 0, { q: q });
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            if (!r) continue;
            users.push({ id: r.id, email: safeStr(r, "email"), name: safeStr(r, "name") });
        }
    } catch (e2) {
        console.log("[stjorna-users-search] search failed: " + (e2 && (e2.message || e2)));
    }
    http.reply(e, 200, { ok: true, users: users }, true);
}

// GET /api/stjorna/tenants/{id}/members — id/name/email of one tenant's
// members, for superusers and admins of THAT tenant only. Everyone else
// gets 403 (never reveals whether the tenant exists).
function membersHandler(e) {
    if (!e.auth) return fail(e, 401, "unauthorized");
    var tid = String(e.request.pathValue("id") || "");
    if (!tid) return fail(e, 400, "tenant id required");
    if (!e.hasSuperuserAuth()) {
        var uid = String(e.auth.id || "");
        if (!uid || !http.hasAdminRole($app, uid, tid)) {
            return fail(e, 403, "only admins of this tenant can list its members");
        }
    }
    var members = [];
    try {
        var rows = $app.findRecordsByFilter("user_tenants", "tenant={:t}", "", 0, 0, { t: tid });
        var seen = {};
        for (var j = 0; j < rows.length; j++) {
            var mu = String(rows[j].get("user") || "");
            if (!mu || seen[mu]) continue;
            seen[mu] = true;
            try {
                var u = $app.findRecordById("users", mu);
                members.push({ id: u.id, name: String(u.get("name") || ""), email: String(u.get("email") || "") });
            } catch (_) {}
        }
    } catch (err) {
        console.log("[stjorna-users-search] members lookup failed: " + (err && (err.message || err)));
        return fail(e, 500, "members lookup failed");
    }
    http.reply(e, 200, { ok: true, members: members }, true);
}

module.exports = {
    searchHandler: searchHandler,
    membersHandler: membersHandler,
};
