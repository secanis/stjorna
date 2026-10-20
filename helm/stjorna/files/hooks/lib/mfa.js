// STJÓRNA — superuser MFA helpers (T-14).
//
// Migration 1770000000_enable_superuser_mfa.js only enables MFA when the
// instance was already set up at migration time, so fresh installs never
// got it. `mfa.pb.js` calls `enableSuperuserMfa()` when
// `instance_settings.setup_done` flips false → true.
//
// MFA for superusers means email OTP (superusers cannot use OAuth2), so it
// is only turned on when a mailer is configured; otherwise enabling it
// would lock every superuser out. Without SMTP the frontend shows a
// persistent "MFA disabled — configure SMTP" banner instead.

var OTP_DEFAULTS = { enabled: true, duration: 180, length: 8 };
var MFA_DEFAULTS = { enabled: true, duration: 1800, rule: "" };

// Pure decision helper (unit-tested): should the setup_done transition
// enable MFA?
function shouldEnableOnSetupDone(prevSetupDone, nextSetupDone, smtpEnabled) {
    return !prevSetupDone && !!nextSetupDone && !!smtpEnabled;
}

function smtpEnabled(app) {
    try {
        var s = app.settings();
        return !!(s && s.smtp && s.smtp.enabled && s.smtp.host);
    } catch (_) {
        return false;
    }
}

// Enables OTP + MFA on `_superusers`. Returns true when the collection was
// changed. Never disables anything.
function enableSuperuserMfa(app) {
    var su = app.findCollectionByNameOrId("_superusers");
    var changed = false;
    if (!su.otp || !su.otp.enabled) {
        su.otp = OTP_DEFAULTS;
        changed = true;
    }
    if (!su.mfa || !su.mfa.enabled) {
        su.mfa = MFA_DEFAULTS;
        changed = true;
    }
    if (changed) {
        app.save(su);
    }
    return changed;
}

module.exports = {
    shouldEnableOnSetupDone: shouldEnableOnSetupDone,
    smtpEnabled: smtpEnabled,
    enableSuperuserMfa: enableSuperuserMfa,
};
