// STJÓRNA v3 — public OIDC configuration endpoint
//
// Exposes non-sensitive OIDC settings so the login page can request the
// correct scopes (e.g. "groups") even before the user is authenticated.

console.log("[stjorna-oidc-config] loading");

routerAdd("GET", "/api/stjorna/oidc-config", function (e) {
    var cfg = {
        enabled: false,
        providerName: "oidc",
        displayName: "Sign in with OIDC",
        scopes: "openid,email,profile",
        groupClaim: "groups",
        groupPrefix: "",
        groupSeparator: "_",
        defaultRole: "viewer",
        roleMapping: "_admin:admin,_editor:editor,_viewer:viewer",
        denyOnNoGroup: true,
    };

    try {
        var rows = $app.findRecordsByFilter("instance_settings", "", "", 0, 0);
        var rec = rows && rows.length > 0 ? rows[0] : null;
        if (rec) {
            cfg.enabled = !!rec.get("oidc_enabled");
            cfg.providerName = String(rec.get("oidc_provider_name") || cfg.providerName);
            cfg.displayName = String(rec.get("oidc_display_name") || cfg.displayName);
            cfg.scopes = String(rec.get("oidc_scopes") || cfg.scopes);
            cfg.groupClaim = String(rec.get("oidc_group_claim") || cfg.groupClaim);
            cfg.groupPrefix = String(rec.get("oidc_group_prefix") || cfg.groupPrefix);
            cfg.groupSeparator = String(rec.get("oidc_group_separator") || cfg.groupSeparator);
            cfg.defaultRole = String(rec.get("oidc_default_role") || cfg.defaultRole);
            cfg.roleMapping = String(rec.get("oidc_role_mapping") || cfg.roleMapping);
            cfg.denyOnNoGroup = !!rec.get("oidc_deny_on_no_group");
        }
    } catch (err) {
        console.log("[stjorna-oidc-config] failed to load config: " + (err && err.message));
    }

    return e.json(200, cfg);
});

console.log("[stjorna-oidc-config] registered GET /api/stjorna/oidc-config");
