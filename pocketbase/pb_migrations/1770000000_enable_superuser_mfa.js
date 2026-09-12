/// <reference path="../pb_data/types.d.ts" />

// Enables MFA + OTP for the _superusers collection, but only after the
// initial first-time setup has been completed. This avoids blocking the
// setup flow itself, which uses password authentication before a mailer is
// configured.
//
// PocketBase superusers cannot use OAuth2, so the only available second factor
// is email-based OTP. When MFA is enabled, every superuser login requires:
//   1. password authentication (returns an mfaId)
//   2. OTP code from the email
//
// IMPORTANT: this requires a working SMTP/mailer configuration so that OTP
// emails can be delivered.

migrate((app) => {
  try {
    // Only enforce MFA if setup has already been completed.
    let setupDone = false;
    try {
      const settingsRows = app.findRecordsByFilter("instance_settings", "", "", 0, 0);
      if (settingsRows && settingsRows.length > 0) {
        setupDone = !!settingsRows[0].get("setup_done");
      }
    } catch (_) {}

    if (!setupDone) {
      console.log("[migration] skipping superuser MFA: setup not done yet");
      return;
    }

    const su = app.findCollectionByNameOrId("_superusers");
    let changed = false;

    if (!su.otp || !su.otp.enabled) {
      su.otp = {
        enabled: true,
        duration: 180,
        length: 8,
      };
      changed = true;
    }

    if (!su.mfa || !su.mfa.enabled) {
      su.mfa = {
        enabled: true,
        duration: 1800,
        rule: "",
      };
      changed = true;
    }

    if (changed) {
      app.save(su);
      console.log("[migration] enabled MFA+OTP for _superusers");
    }
  } catch (err) {
    console.log("[migration] failed to enable superuser MFA: " + (err && err.message));
  }
}, (app) => {
  // Best-effort rollback; we do not remove fields to avoid data loss.
});
