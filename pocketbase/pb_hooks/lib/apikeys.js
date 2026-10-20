/// <reference path="../../pb_data/types.d.ts" />

// STJÓRNA v3 — API key route handlers (T-05). Registered by api_keys.pb.js;
// see that file for the security model and route overview.

var http = require(`${__hooks}/lib/http.js`);

// Lifetime of the JWT minted by /exchange. Keep it short: the key itself
// is the long-lived credential, the JWT is a session.
var EXCHANGE_TOKEN_TTL_SECONDS = 3600;

function reply(e, status, obj) {
    http.reply(e, status, obj, true);
}

function fail(e, status, message) {
    http.replyError(e, status, message, true);
}

// Defense-in-depth admin check. $apis.requireSuperuserAuth() already
// enforces this at route registration; this guards against a future
// refactor dropping the middleware. Returns true when the request was
// rejected.
function rejectNonAdmin(e) {
    if (e.hasSuperuserAuth()) return false;
    e.response.header().set("Content-Type", "application/json; charset=utf-8");
    e.string(403, '{"ok":false,"error":{"code":403,"message":"admin auth required"}}');
    return true;
}

// Constant-time-ish string compare — no early exit on mismatch.
function constEq(a, b) {
    if (!a || !b) return false;
    a = String(a);
    b = String(b);
    if (a.length !== b.length) return false;
    var d = 0;
    for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}

// Key shape: stjorna_<tenantShort6>_<keyShort6>.<secret40>
function keyShape(k) {
    if (typeof k !== "string") return false;
    if (k.length < 16 || k.length > 256) return false;
    var p = k.split(".");
    if (p.length !== 2) return false;
    if (p[0].indexOf("stjorna_") !== 0) return false;
    if (p[0].length < 8 || p[0].length > 64) return false;
    if (!/^[A-Za-z0-9_]+$/.test(p[0])) return false;
    if (p[1].length < 16 || p[1].length > 128) return false;
    if (!/^[A-Za-z0-9]+$/.test(p[1])) return false;
    return true;
}

function rand(n) {
    try {
        return $security.randomString(n).toLowerCase();
    } catch (_e) {
        var ch = "abcdefghijklmnopqrstuvwxyz0123456789";
        var buf = new Uint8Array(n);
        try {
            crypto.getRandomValues(buf);
        } catch (_e2) {
            for (var i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 256);
        }
        var out = "";
        for (var j = 0; j < n; j++) out += ch[buf[j] % ch.length];
        return out;
    }
}

// Deterministic SHA-256 of the full key (prefix.secret).
function hash(s) {
    try {
        return $security.sha256(s);
    } catch (_e) {
        return "";
    }
}

// Active api_keys row by (UNIQUE-indexed) prefix, or null.
function lookupByPrefix(prefix) {
    var p = String(prefix || "");
    if (!p) return null;
    try {
        return $app.findFirstRecordByFilter("api_keys", "prefix={:p} && revoked=false", { p: p }) || null;
    } catch (_e) {
        return null;
    }
}

// Idempotently give a service user a `viewer` membership in the tenant.
function ensureSvcMembership(uid, tid) {
    var ex = [];
    try {
        ex = $app.findRecordsByFilter("user_tenants", "user={:u} && tenant={:t}", "", 1, 0, { u: uid, t: tid });
    } catch (_e) {}
    if (ex && ex.length > 0) return;
    var role = $app.findFirstRecordByFilter("roles", "name={:n}", { n: "viewer" });
    if (!role) return;
    var ut = new Record($app.findCollectionByNameOrId("user_tenants"));
    ut.set("user", uid);
    ut.set("tenant", tid);
    ut.set("role", role.id);
    try { ut.set("source", "manual"); } catch (_es) {}
    try { $app.save(ut); } catch (_eSave) {}
}

function parsePermissions(v) {
    try {
        if (v && typeof v === "string") return JSON.parse(v);
        if (v) return v;
    } catch (_e) {}
    return null;
}

// Expiry of an api_keys row in ms (0 = never / unparseable).
function expiresMs(rec) {
    var exp = http.getR(rec, "expires");
    if (!exp) return 0;
    if (typeof exp.getTime === "function" && !isNaN(exp.getTime())) return exp.getTime();
    return Date.parse(String(exp).replace(" ", "T"));
}

// Resolves and verifies a bearer key. Returns the api_keys row, or null
// after having written the 401 response.
function verifyKey(e, key) {
    if (!keyShape(key)) {
        fail(e, 401, "malformed API key");
        return null;
    }
    var computed = hash(key);
    var rec = lookupByPrefix(key.split(".")[0]);
    if (!rec || !constEq(computed, String(http.getR(rec, "key_hash") || ""))) {
        fail(e, 401, "invalid API key");
        return null;
    }
    return rec;
}

function touchLastUsed(rec) {
    try {
        rec.set("last_used", http.nowStamp());
        $app.save(rec);
    } catch (_e) {}
}

function bearer(e) {
    return String(e.request.header.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

// POST /api/stjorna/api-keys — issue. Returns the plaintext key ONCE.
function issueHandler(e) {
    if (rejectNonAdmin(e)) return;
    var body = http.readJsonBody(e);
    var tenantId = String(body.tenant || "").trim();
    var name = String(body.name || "").trim();
    var permissions = body.permissions || null;
    var expires = body.expires || null;
    if (!tenantId) return fail(e, 400, "tenant is required");
    if (!name) return fail(e, 400, "name is required");
    if (name.length > 200) return fail(e, 400, "name too long");

    var tenant = null;
    try {
        tenant = $app.findRecordById("tenants", tenantId);
    } catch (_et) {
        return fail(e, 404, "tenant not found");
    }
    if (!tenant) return fail(e, 404, "tenant not found");

    var tid = String(tenant.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toLowerCase() || "tenant";
    var prefix = "stjorna_" + tid + "_" + rand(6);
    var fullKey = prefix + "." + rand(40);
    var keyHash = hash(fullKey);
    if (!keyHash) return fail(e, 500, "hashing unavailable");

    // Per-tenant service user with a random password nobody knows;
    // /exchange mints JWTs for it on demand.
    var svcEmail = "";
    var svcUserId = "";
    try {
        svcEmail = "svc-" + tid + "-" + rand(8) + "@stjorna.internal";
        var existing = null;
        try {
            existing = $app.findFirstRecordByFilter("users", "email={:e}", { e: svcEmail });
        } catch (_eu) {}
        if (existing) {
            svcUserId = String(existing.id || "");
        } else {
            var u = new Record($app.findCollectionByNameOrId("users"));
            u.setEmail(svcEmail);
            u.setPassword(rand(40));
            u.setVerified(true);
            $app.save(u);
            svcUserId = String(u.id || "");
        }
    } catch (eSvc) {
        return fail(e, 500, "service user create failed: " + ((eSvc && eSvc.message) || eSvc));
    }
    if (!svcUserId) return fail(e, 500, "service user id missing");

    try {
        ensureSvcMembership(svcUserId, tenantId);
    } catch (eMem) {
        return fail(e, 500, "service user membership failed: " + ((eMem && eMem.message) || eMem));
    }

    var rec = new Record($app.findCollectionByNameOrId("api_keys"));
    rec.set("tenant", tenantId);
    rec.set("name", name);
    rec.set("prefix", prefix);
    rec.set("key_hash", keyHash);
    if (permissions) {
        try { rec.set("permissions", JSON.stringify(permissions)); } catch (_ep) {}
    }
    if (expires) rec.set("expires", String(expires));
    rec.set("revoked", false);
    rec.set("service_user_id", svcUserId);
    rec.set("service_user_email", svcEmail);
    try {
        $app.save(rec);
    } catch (es) {
        return fail(e, 500, "persist failed: " + (es.message || es));
    }

    reply(e, 200, {
        ok: true,
        apiKey: {
            id: rec.id,
            tenant: tenantId,
            name: name,
            prefix: prefix,
            permissions: permissions,
            expires: expires,
            revoked: false,
            created: new Date().toISOString(),
        },
        plaintext: fullKey,
        warning: "Store this key now. It will not be shown again.",
    });
}

// GET /api/stjorna/api-keys — list metadata (never the key or secrets).
function listHandler(e) {
    if (rejectNonAdmin(e)) return;
    try {
        var q = e.request.url.query();
        var page = parseInt(q.get("page") || "1", 10);
        var perPage = parseInt(q.get("perPage") || "50", 10);
        var tenantId = String(q.get("tenant") || "");
        if (!page || page < 1) page = 1;
        if (!perPage || perPage < 1 || perPage > 200) perPage = 50;

        var rows = [];
        try {
            rows = $app.findRecordsByFilter("api_keys", "revoked=false", "", 0, 0);
        } catch (el) {
            return fail(e, 500, "list query failed: " + (el.message || el));
        }
        var filtered = [];
        for (var i = 0; i < (rows || []).length; i++) {
            var r = rows[i];
            if (!r || typeof r.get !== "function") continue;
            if (String(http.getR(r, "prefix") || "").indexOf("stjorna_") !== 0) continue;
            if (tenantId && String(http.getR(r, "tenant")) !== tenantId) continue;
            filtered.push(r);
        }
        filtered.sort(function (a, b) {
            return String(http.getR(b, "created") || "").localeCompare(String(http.getR(a, "created") || ""));
        });
        var start = (page - 1) * perPage;
        var items = filtered.slice(start, start + perPage).map(function (r) {
            return {
                id: r.id,
                tenant: http.getR(r, "tenant"),
                name: http.getR(r, "name"),
                prefix: http.getR(r, "prefix"),
                permissions: parsePermissions(http.getR(r, "permissions")),
                last_used: http.getR(r, "last_used") || null,
                expires: http.getR(r, "expires") || null,
                revoked: !!http.getR(r, "revoked"),
                created: http.getR(r, "created") || null,
            };
        });
        reply(e, 200, { ok: true, items: items, page: page, perPage: perPage, totalItems: filtered.length });
    } catch (eAll) {
        console.log("[stjorna-apikeys] LIST outer error: " + ((eAll && eAll.stack) || (eAll && eAll.message) || eAll));
        fail(e, 500, "list handler crashed: " + ((eAll && eAll.message) || String(eAll)));
    }
}

// DELETE /api/stjorna/api-keys/{id} — revoke: flag the row, drop the
// service user's memberships, rotate its tokenKey, delete it.
function revokeHandler(e) {
    if (rejectNonAdmin(e)) return;
    var id = String(e.request.pathValue("id") || "");
    if (!id) return fail(e, 400, "id required");
    var rec = null;
    try {
        rec = $app.findRecordById("api_keys", id);
    } catch (_en) {
        return fail(e, 404, "not found");
    }
    if (!rec) return fail(e, 404, "not found");
    var svcId = String(http.getR(rec, "service_user_id") || "");

    rec.set("revoked", true);
    try {
        $app.save(rec);
    } catch (es) {
        return fail(e, 500, "revoke save failed: " + (es.message || es));
    }

    if (svcId) {
        // user_tenants.user has no cascadeDelete — drop memberships explicitly.
        try {
            var uts = $app.findRecordsByFilter("user_tenants", "user={:u}", "", 0, 0, { u: svcId });
            for (var i = 0; i < uts.length; i++) {
                try { $app.delete(uts[i]); } catch (_eUt) {}
            }
        } catch (_eUts) {}
        try {
            var sr = $app.findRecordById("users", svcId);
            if (sr) {
                if (typeof sr.refreshTokenKey === "function") {
                    try {
                        sr.refreshTokenKey();
                    } catch (eR) {
                        console.log("[stjorna-apikeys] refreshTokenKey on " + svcId + ": " + (eR && eR.message));
                    }
                }
                try {
                    $app.delete(sr);
                } catch (eD) {
                    console.log("[stjorna-apikeys] delete svc user " + svcId + ": " + (eD && eD.message));
                }
            }
        } catch (eS) {
            console.log("[stjorna-apikeys] svc-user teardown failed: " + (eS && eS.message));
        }
    }
    reply(e, 200, { ok: true, id: id, revoked: true });
}

// GET /api/stjorna/api-keys/me — introspect the bearer key (no JWT).
function introspectHandler(e) {
    var key = bearer(e);
    if (!key) return fail(e, 401, "missing API key");
    var rec = verifyKey(e, key);
    if (!rec) return;
    var expMs = 0;
    if (http.getR(rec, "expires")) {
        expMs = expiresMs(rec);
        if (expMs && !isNaN(expMs) && expMs < Date.now()) return fail(e, 401, "expired");
    }
    touchLastUsed(rec);
    reply(e, 200, {
        ok: true,
        tenant: http.getR(rec, "tenant"),
        id: rec.id,
        prefix: key.split(".")[0],
        permissions: parsePermissions(http.getR(rec, "permissions")),
        expires: expMs || null,
    });
}

// POST /api/stjorna/api-keys/exchange — API key → short-lived JWT for
// the key's service user. Never returns a password.
function exchangeHandler(e) {
    var h = bearer(e);
    var body = http.readJsonBody(e);
    var key = h || String(body.key || "").trim();
    if (!key) return fail(e, 400, "API key required (Authorization bearer or JSON body {key})");
    var rec = verifyKey(e, key);
    if (!rec) return;
    if (http.getR(rec, "expires")) {
        var ms = expiresMs(rec);
        if (ms && !isNaN(ms) && ms < Date.now()) return fail(e, 401, "expired");
    }
    var tenantId = String(http.getR(rec, "tenant") || "");
    if (!tenantId) return fail(e, 500, "api_keys row missing tenant");

    var svcId = String(http.getR(rec, "service_user_id") || "");
    var svcEmail = String(http.getR(rec, "service_user_email") || "");
    if (!svcId || !svcEmail) {
        return reply(e, 409, {
            ok: false,
            legacy: true,
            error: { code: 409, message: "key predates the T-05 redesign — re-issue it from the admin UI" },
        });
    }
    // Self-heal membership for pre-T-02 keys.
    try { ensureSvcMembership(svcId, tenantId); } catch (_eMem) {}

    var svcRec = null;
    try {
        svcRec = $app.findRecordById("users", svcId);
    } catch (_eSvc) {}
    if (!svcRec) return fail(e, 500, "service user missing — re-issue the key");

    // Short-lived, non-refreshable token; newStaticAuthToken takes a Go
    // time.Duration (ns).
    var token = "";
    try {
        if (typeof svcRec.newStaticAuthToken === "function") {
            token = String(svcRec.newStaticAuthToken(EXCHANGE_TOKEN_TTL_SECONDS * 1000000000) || "");
        } else {
            token = String(svcRec.newAuthToken() || "");
        }
    } catch (eTok) {
        return fail(e, 500, "token mint failed: " + ((eTok && eTok.message) || eTok));
    }
    if (!token) return fail(e, 500, "token mint returned empty");

    touchLastUsed(rec);
    reply(e, 200, {
        ok: true,
        tenant: String(http.getR(rec, "tenant") || ""),
        token: token,
        record: { id: svcRec.id, email: svcEmail },
        permissions: parsePermissions(http.getR(rec, "permissions")),
        expiresIn: EXCHANGE_TOKEN_TTL_SECONDS,
        instructions:
            "Send the token as `Authorization: Bearer …` for /api/collections/* requests. The token is short-lived (expiresIn seconds) and not refreshable; re-exchange the API key when it expires.",
    });
}

module.exports = {
    keyShape: keyShape,
    issueHandler: issueHandler,
    listHandler: listHandler,
    revokeHandler: revokeHandler,
    introspectHandler: introspectHandler,
    exchangeHandler: exchangeHandler,
};
