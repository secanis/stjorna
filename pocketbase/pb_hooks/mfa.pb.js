/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA — enable superuser MFA when setup finishes (T-14).
//
// Fires on the `instance_settings.setup_done` false → true transition
// (the wizard either creates the row with setup_done=true or updates it).
// MFA is only enabled when SMTP is configured; see lib/mfa.js.

// Runs as a save hook (not *AfterSuccess) so the previous value can be read
// from `original()` before the write; MFA is enabled after `e.next()` in the
// same transaction.
function stjornaMfaOnSetupDone(e) {
    var prev = false;
    try {
        if (!e.record.isNew()) {
            var orig = e.record.original();
            prev = !!(orig && orig.get("setup_done"));
        }
    } catch (_) {}
    e.next();
    var mfaLib = require(`${__hooks}/lib/mfa.js`);
    var next = !!e.record.get("setup_done");
    if (!mfaLib.shouldEnableOnSetupDone(prev, next, mfaLib.smtpEnabled(e.app))) {
        if (!prev && next) {
            console.log("[stjorna-mfa] setup done but SMTP is not configured; superuser MFA stays disabled");
        }
        return;
    }
    try {
        if (mfaLib.enableSuperuserMfa(e.app)) {
            console.log("[stjorna-mfa] enabled MFA+OTP for _superusers");
        }
    } catch (err) {
        console.log("[stjorna-mfa] failed to enable superuser MFA: " + (err && err.message));
    }
}

onRecordCreate(stjornaMfaOnSetupDone, "instance_settings");
onRecordUpdate(stjornaMfaOnSetupDone, "instance_settings");
