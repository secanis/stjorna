// STJÓRNA v3 — OIDC group-to-tenant sync
//
// Uses PocketBase v0.40 onRecordAuthWithOAuth2Request hook:
//   - validates groups and denies if none match BEFORE e.next().
//   - enforces email_verified for auto-linked (existing) users (T-13).
//   - syncs user_tenants rows with source = "oidc" AFTER e.next().
//
// Docs reference:
//   https://pocketbase.io/docs/js-event-hooks/#onrecordauthwithoauth2request
//   Event fields: e.providerName, e.providerClient, e.record, e.oauth2User,
//   e.createData, e.isNewRecord.
//   Throwing an error (or not calling e.next()) stops the hook chain.
//
// Pure group-mapping helpers live in pb_hooks/lib/oidc.js (unit-tested in
// pocketbase/tests/oidc-groups.unit.test.ts).

console.log("[stjorna-oidc] loading");

// -----------------------------------------------------------------------------
// Combined OIDC auth hook: validate before e.next(), sync after e.next().
// -----------------------------------------------------------------------------
onRecordAuthWithOAuth2Request(function (e) {
    var oidcLib = require(`${__hooks}/lib/oidc.js`);

    // Verbose logging (raw group claims, user keys) is opt-in — it is a
    // privacy/security concern on every login, so only emit it when the
    // operator explicitly sets STJORNA_LOG_OIDC (T-13).
    var debugLog = false;
    try {
        var v = $os.getenv("STJORNA_LOG_OIDC");
        debugLog = v === "1" || v === "true" || v === "yes";
    } catch (_) {}

    // ---- Load OIDC settings from instance_settings ----------------------------
    var cfg = {
        enabled: false,
        providerName: "oidc",
        groupClaim: "groups",
        groupPrefix: "",
        separator: "_",
        defaultRole: "viewer",
        roleMapping: { "_admin": "admin", "_editor": "editor", "_viewer": "viewer" },
        denyOnNoGroup: true,
        syncMode: "replace-oidc",
        allowUnverifiedEmail: false
    };

    try {
        var rows = $app.findRecordsByFilter("instance_settings", "", "", 0, 0);
        var rec = rows && rows.length > 0 ? rows[0] : null;
        if (rec) {
            cfg.enabled = !!rec.get("oidc_enabled");

            var pn = String(rec.get("oidc_provider_name") || "").trim();
            if (pn) cfg.providerName = pn;

            var gc = String(rec.get("oidc_group_claim") || "").trim();
            if (gc) cfg.groupClaim = gc;

            var gp = String(rec.get("oidc_group_prefix") || "").trim();
            cfg.groupPrefix = gp;

            var sep = String(rec.get("oidc_group_separator") || "").trim();
            if (sep) cfg.separator = sep;

            var dr = String(rec.get("oidc_default_role") || "").trim();
            if (dr) cfg.defaultRole = dr;

            cfg.denyOnNoGroup = !!rec.get("oidc_deny_on_no_group");

            var sm = String(rec.get("oidc_sync_mode") || "").trim();
            if (sm) cfg.syncMode = sm;

            // Secure default: the check is on unless the operator explicitly
            // opts out by setting oidc_allow_unverified_email = true.
            if (rec.get("oidc_allow_unverified_email") === true) {
                cfg.allowUnverifiedEmail = true;
            }

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
        console.log("[stjorna-oidc] failed to load config: " + (err && err.message));
    }

    if (debugLog) console.log("[stjorna-oidc] provider=" + e.providerName + " enabled=" + cfg.enabled);

    if (!cfg.enabled || e.providerName !== cfg.providerName) {
        return e.next();
    }

    // ---- Resolve OAuth2 user / raw user data ----------------------------------
    var o2u = null;
    try { if (e.oauth2User) o2u = e.oauth2User; } catch (_) {}
    if (!o2u) try { if (e.oAuth2User) o2u = e.oAuth2User; } catch (_) {}
    if (!o2u) try { if (e.OAuth2User) o2u = e.OAuth2User; } catch (_) {}

    var rawUser = null;
    try { if (o2u) rawUser = o2u.rawUser; } catch (_) {}
    if (!rawUser) try { if (o2u) rawUser = o2u.RawUser; } catch (_) {}

    if (debugLog) {
        try {
            console.log("[stjorna-oidc] rawUser keys=" + (rawUser ? JSON.stringify(Object.keys(rawUser)) : "none"));
        } catch (_) {}
    }

    // ---- T-13: reject auto-linked accounts with unverified email --------------
    // PocketBase auto-links an OAuth2 login to an existing user with the same
    // email. If the IdP does not assert email_verified, an attacker can claim
    // the victim's email at the IdP and take over the real account. New
    // records (first login) have no pre-existing account to hijack, so the
    // check only applies when the login would link to an existing user.
    if (!cfg.allowUnverifiedEmail && !e.isNewRecord) {
        var emailVerified = false;
        try {
            if (rawUser) {
                var ev = rawUser.email_verified;
                if (ev === undefined) ev = rawUser.emailVerified;
                emailVerified = ev === true || ev === "true" || ev === 1 || ev === "1";
            }
        } catch (_) {}
        if (!emailVerified) {
            throw new ForbiddenError("OIDC login denied: email is not verified by the identity provider");
        }
    }

    // ---- Extract group list from the configured claim -------------------------
    var extracted = { value: undefined, usedClaim: cfg.groupClaim };
    if (rawUser) {
        extracted.value = rawUser[cfg.groupClaim];
    }
    var rawGroups = extracted.value;
    var groups = oidcLib.normalizeToStringArray(rawGroups);

    if (debugLog) console.log("[stjorna-oidc] groupClaim=" + cfg.groupClaim + " normalizedGroups=" + JSON.stringify(groups));

    // ---- BEFORE e.next(): validate that at least one group maps to a tenant ---
    function resolveGroupMembership(groupStr) {
        var g = String(groupStr || "").trim();
        if (!g) return null;

        if (cfg.groupPrefix && g.indexOf(cfg.groupPrefix) === 0) {
            g = g.substring(cfg.groupPrefix.length);
        }

        // Parsing is delegated to the shared, unit-tested helper; the
        // tenant/role ID lookups are the only $app-dependent part.
        var parsed = oidcLib.parseGroup(g, cfg.separator, cfg.roleMapping, cfg.defaultRole);
        if (!parsed) return null;

        var tenant = null;
        try {
            tenant = $app.findFirstRecordByFilter("tenants", "slug={:s}", { s: parsed.tenantSlug });
        } catch (_) {}
        if (!tenant) return null;

        var role = null;
        try {
            role = $app.findFirstRecordByFilter("roles", "name={:r}", { r: parsed.roleName });
        } catch (_) {}
        if (!role) return null;

        return {
            group: g,
            tenantId: String(tenant.id),
            roleId: String(role.id),
            tenantSlug: parsed.tenantSlug,
            roleName: parsed.roleName
        };
    }

    var desired = [];
    var seenTenantIds = {};
    for (var gi = 0; gi < groups.length; gi++) {
        var membership = resolveGroupMembership(groups[gi]);
        if (membership && !seenTenantIds[membership.tenantId]) {
            seenTenantIds[membership.tenantId] = true;
            desired.push(membership);
        }
    }

    if (debugLog) console.log("[stjorna-oidc] matchedMemberships=" + desired.length);

    if (desired.length === 0 && cfg.denyOnNoGroup) {
        throw new UnauthorizedError("OIDC login denied: no matching tenant group");
    }

    // ---- Proceed with OAuth2 auth -------------------------------------------
    e.next();

    // ---- AFTER e.next(): sync user_tenants memberships ----------------------
    var userId = null;
    try {
        if (e.record) userId = String(e.record.id);
    } catch (_) {}
    if (!userId) {
        console.log("[stjorna-oidc] no user record after OAuth2 auth; skipping sync");
        return;
    }

    try {
        // Update display name from OIDC profile when the user is new.
        try {
            var oidcName = "";
            if (o2u && o2u.name) {
                oidcName = String(o2u.name);
            } else if (rawUser && rawUser.name) {
                oidcName = String(rawUser.name);
            } else if (rawUser && rawUser.display_name) {
                oidcName = String(rawUser.display_name);
            }
            if (oidcName && e.record.get("name") !== oidcName) {
                e.record.set("name", oidcName);
                $app.save(e.record);
            }
        } catch (nameErr) {
            console.log("[stjorna-oidc] name update failed: " + (nameErr && nameErr.message));
        }

        var utColl = $app.findCollectionByNameOrId("user_tenants");

        var existing = [];
        try {
            existing = $app.findRecordsByFilter("user_tenants", "user={:u}", "", 0, 0, { u: userId });
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
                // T-03/T-13: respect manual rows. A membership that an admin
                // created (source != "oidc") stays manual — we never touch
                // it. Only oidc-sourced rows get their role refreshed.
                if (existingInfo.source === "oidc") {
                    try {
                        var currentRole = String(existingInfo.record.get("role") || "");
                        if (currentRole !== item.roleId) {
                            existingInfo.record.set("role", item.roleId);
                            $app.save(existingInfo.record);
                        }
                    } catch (upErr) {
                        console.log("[stjorna-oidc] membership update failed: " + (upErr && upErr.message));
                    }
                }
                // else: leave manual rows alone.
            } else {
                try {
                    var ut = new Record(utColl);
                    ut.set("user", userId);
                    ut.set("tenant", item.tenantId);
                    ut.set("role", item.roleId);
                    ut.set("source", "oidc");
                    $app.save(ut);
                    if (debugLog) console.log("[stjorna-oidc] created membership tenant=" + item.tenantSlug + " role=" + item.roleName + " for user=" + userId);
                } catch (crErr) {
                    console.log("[stjorna-oidc] membership create failed: " + (crErr && crErr.message));
                }
            }
        }

        // Remove obsolete OIDC-sourced memberships when replace mode is enabled.
        if (cfg.syncMode === "replace-oidc") {
            var desiredTenantIds = {};
            for (var dd = 0; dd < desired.length; dd++) {
                desiredTenantIds[desired[dd].tenantId] = true;
            }
            for (var key in existingByTenant) {
                if (!desiredTenantIds[key] && existingByTenant[key].source === "oidc") {
                    try {
                        $app.delete(existingByTenant[key].record);
                        if (debugLog) console.log("[stjorna-oidc] removed obsolete membership tenant=" + key + " for user=" + userId);
                    } catch (delErr) {
                        console.log("[stjorna-oidc] membership delete failed: " + (delErr && delErr.message));
                    }
                }
            }
        }
    } catch (syncErr) {
        console.log("[stjorna-oidc] sync block error: " + (syncErr && syncErr.message));
    }
}, "users");

console.log("[stjorna-oidc] hook registered");
