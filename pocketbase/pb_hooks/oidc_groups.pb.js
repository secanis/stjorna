// STJÓRNA v3 — OIDC group-to-tenant sync
//
// Uses PocketBase v0.22.x before/after OAuth2 hooks:
//   - onRecordBeforeAuthWithOAuth2Request: validates groups and denies if none match.
//   - onRecordAfterAuthWithOAuth2Request: syncs user_tenants rows with source = "oidc".

console.log("[stjorna-oidc] loading");

// ---------------------------------------------------------------------------
// Before: validate that at least one group maps to an existing tenant+role.
// ---------------------------------------------------------------------------
onRecordBeforeAuthWithOAuth2Request("users", function (e) {
    var cfg = {
        enabled: false,
        providerName: "oidc",
        groupClaim: "groups",
        separator: "_",
        defaultRole: "viewer",
        roleMapping: { "_admin": "admin", "_editor": "editor", "_viewer": "viewer" },
        denyOnNoGroup: true
    };
    try {
        var rows = $app.dao().findRecordsByExpr("instance_settings");
        var rec = rows && rows.length > 0 ? rows[0] : null;
        if (rec) {
            cfg.enabled = !!rec.get("oidc_enabled");
            var pn = String(rec.get("oidc_provider_name") || "").trim();
            if (pn) cfg.providerName = pn;
            var gc = String(rec.get("oidc_group_claim") || "").trim();
            if (gc) cfg.groupClaim = gc;
            var sep = String(rec.get("oidc_group_separator") || "").trim();
            if (sep) cfg.separator = sep;
            var dr = String(rec.get("oidc_default_role") || "").trim();
            if (dr) cfg.defaultRole = dr;
            cfg.denyOnNoGroup = !!rec.get("oidc_deny_on_no_group");

            var rm = String(rec.get("oidc_role_mapping") || "").trim();
            if (rm) {
                var parts = rm.split(",");
                for (var i = 0; i < parts.length; i++) {
                    var kv = parts[i].split(":");
                    if (kv.length === 2) {
                        cfg.roleMapping[String(kv[0]).trim()] = String(kv[1]).trim();
                    }
                }
            }
        }
    } catch (err) {
        console.log("[stjorna-oidc] before: failed to load config: " + (err && err.message));
    }

    if (!cfg.enabled || e.providerName !== cfg.providerName) return;

    var rawUser = null;
    try {
        if (e.oAuth2User) rawUser = e.oAuth2User.rawUser;
    } catch (_) {}

    var groups = rawUser ? rawUser[cfg.groupClaim] : undefined;
    if (typeof groups === "string") groups = groups.split(",");
    if (!Array.isArray(groups)) groups = [];

    var matched = false;
    for (var j = 0; j < groups.length && !matched; j++) {
        var g = String(groups[j] || "").trim();
        if (!g) continue;

        var sepIdx = g.lastIndexOf(cfg.separator);
        if (sepIdx < 0 || sepIdx === g.length - 1) continue;

        var tenantSlug = g.substring(0, sepIdx).toLowerCase();
        var suffix = g.substring(sepIdx).toLowerCase();
        var roleName = cfg.roleMapping[suffix];
        if (!roleName) roleName = cfg.defaultRole;

        var tenant = null;
        try {
            tenant = $app.dao().findFirstRecordByFilter("tenants", "slug={:s}", { s: tenantSlug });
        } catch (_) {}
        if (!tenant) continue;

        var role = null;
        try {
            role = $app.dao().findFirstRecordByFilter("roles", "name={:r}", { r: roleName });
        } catch (_) {}
        if (!role) continue;

        matched = true;
    }

    if (!matched && cfg.denyOnNoGroup) {
        throw new UnauthorizedError("OIDC login denied: no matching tenant group");
    }
});

// ---------------------------------------------------------------------------
// After: sync user_tenants memberships and update display name.
// ---------------------------------------------------------------------------
onRecordAfterAuthWithOAuth2Request("users", function (e) {
    var cfg = {
        enabled: false,
        providerName: "oidc",
        groupClaim: "groups",
        separator: "_",
        defaultRole: "viewer",
        roleMapping: { "_admin": "admin", "_editor": "editor", "_viewer": "viewer" },
        syncMode: "replace-oidc"
    };
    try {
        var rows = $app.dao().findRecordsByExpr("instance_settings");
        var rec = rows && rows.length > 0 ? rows[0] : null;
        if (rec) {
            cfg.enabled = !!rec.get("oidc_enabled");
            var pn = String(rec.get("oidc_provider_name") || "").trim();
            if (pn) cfg.providerName = pn;
            var gc = String(rec.get("oidc_group_claim") || "").trim();
            if (gc) cfg.groupClaim = gc;
            var sep = String(rec.get("oidc_group_separator") || "").trim();
            if (sep) cfg.separator = sep;
            var dr = String(rec.get("oidc_default_role") || "").trim();
            if (dr) cfg.defaultRole = dr;

            var rm = String(rec.get("oidc_role_mapping") || "").trim();
            if (rm) {
                var parts = rm.split(",");
                for (var i = 0; i < parts.length; i++) {
                    var kv = parts[i].split(":");
                    if (kv.length === 2) {
                        cfg.roleMapping[String(kv[0]).trim()] = String(kv[1]).trim();
                    }
                }
            }

            var sm = String(rec.get("oidc_sync_mode") || "").trim();
            if (sm) cfg.syncMode = sm;
        }
    } catch (err) {
        console.log("[stjorna-oidc] after: failed to load config: " + (err && err.message));
    }

    if (!cfg.enabled || e.providerName !== cfg.providerName) return;

    var userId = null;
    try {
        if (e.record) userId = String(e.record.id);
    } catch (_) {}
    if (!userId) return;

    var rawUser = null;
    try {
        if (e.oAuth2User) rawUser = e.oAuth2User.rawUser;
    } catch (_) {}

    var groups = rawUser ? rawUser[cfg.groupClaim] : undefined;
    if (typeof groups === "string") groups = groups.split(",");
    if (!Array.isArray(groups)) groups = [];

    var desired = [];
    var tenantIds = {};
    for (var j = 0; j < groups.length; j++) {
        var g = String(groups[j] || "").trim();
        if (!g) continue;

        var sepIdx = g.lastIndexOf(cfg.separator);
        if (sepIdx < 0 || sepIdx === g.length - 1) continue;

        var tenantSlug = g.substring(0, sepIdx).toLowerCase();
        var suffix = g.substring(sepIdx).toLowerCase();
        var roleName = cfg.roleMapping[suffix];
        if (!roleName) roleName = cfg.defaultRole;

        var tenant = null;
        try {
            tenant = $app.dao().findFirstRecordByFilter("tenants", "slug={:s}", { s: tenantSlug });
        } catch (_) {
            console.log("[stjorna-oidc] tenant not found for group: " + g);
            continue;
        }
        if (!tenant) continue;

        var role = null;
        try {
            role = $app.dao().findFirstRecordByFilter("roles", "name={:r}", { r: roleName });
        } catch (_) {
            continue;
        }
        if (!role) continue;

        var tid = String(tenant.id);
        if (tenantIds[tid]) continue;
        tenantIds[tid] = true;
        desired.push({ tenantId: tid, roleId: String(role.id) });
    }

    try {
        // Update display name from OIDC profile.
        try {
            var oidcName = "";
            if (e.oAuth2User) {
                oidcName = String(e.oAuth2User.name || "");
                if (!oidcName && rawUser) {
                    oidcName = String(rawUser.name || "");
                }
            }
            if (oidcName && e.record.get("name") !== oidcName) {
                e.record.set("name", oidcName);
                $app.dao().saveRecord(e.record);
            }
        } catch (nameErr) {
            console.log("[stjorna-oidc] name update failed: " + (nameErr && nameErr.message));
        }

        var utColl = $app.dao().findCollectionByNameOrId("user_tenants");

        var existing = [];
        try {
            existing = $app.dao().findRecordsByFilter("user_tenants", "user={:u}", { u: userId });
        } catch (_) {
            existing = [];
        }

        var existingByTenant = {};
        for (var k = 0; k < existing.length; k++) {
            var ex = existing[k];
            var exTenant = "";
            var exSource = "";
            try { exTenant = String(ex.get("tenant") || ""); } catch (_) {}
            try { exSource = String(ex.get("source") || "").toLowerCase(); } catch (_) {}
            if (exTenant) existingByTenant[exTenant] = { record: ex, source: exSource };
        }

        // Upsert desired memberships.
        for (var d = 0; d < desired.length; d++) {
            var item = desired[d];
            var existingInfo = existingByTenant[item.tenantId];
            if (existingInfo) {
                try {
                    var currentRole = String(existingInfo.record.get("role") || "");
                    if (currentRole !== item.roleId) {
                        existingInfo.record.set("role", item.roleId);
                        existingInfo.record.set("source", "oidc");
                        $app.dao().saveRecord(existingInfo.record);
                    } else if (existingInfo.source !== "oidc") {
                        existingInfo.record.set("source", "oidc");
                        $app.dao().saveRecord(existingInfo.record);
                    }
                } catch (upErr) {
                    console.log("[stjorna-oidc] membership update failed: " + (upErr && upErr.message));
                }
            } else {
                try {
                    var ut = new Record(utColl);
                    ut.set("user", userId);
                    ut.set("tenant", item.tenantId);
                    ut.set("role", item.roleId);
                    ut.set("source", "oidc");
                    $app.dao().saveRecord(ut);
                } catch (crErr) {
                    console.log("[stjorna-oidc] membership create failed: " + (crErr && crErr.message));
                }
            }
        }

        // Remove obsolete OIDC-sourced memberships if replace mode is on.
        if (cfg.syncMode === "replace-oidc") {
            var desiredTenantIds = {};
            for (var dd = 0; dd < desired.length; dd++) {
                desiredTenantIds[desired[dd].tenantId] = true;
            }
            for (var key in existingByTenant) {
                if (!desiredTenantIds[key] && existingByTenant[key].source === "oidc") {
                    try {
                        $app.dao().deleteRecord(existingByTenant[key].record);
                    } catch (delErr) {
                        console.log("[stjorna-oidc] membership delete failed: " + (delErr && delErr.message));
                    }
                }
            }
        }
    } catch (syncErr) {
        console.log("[stjorna-oidc] sync block error: " + (syncErr && syncErr.message));
    }
});

console.log("[stjorna-oidc] hooks registered");
