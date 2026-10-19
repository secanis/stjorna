/// <reference path="../pb_data/types.d.ts" />

// T-13: OIDC sync safety — add the two missing configuration fields.
//
//   - oidc_sync_mode: how the OIDC group sync reconciles user_tenants rows.
//       * "replace-oidc" — remove oidc-sourced memberships no longer present
//         in the IdP groups (the old, only behaviour).
//       * "additive"     — only add/update oidc-sourced memberships, never
//         delete them.
//     The hook defaults to "replace-oidc" when the field is empty, so the
//     migration just has to make the option exist.
//
//   - oidc_allow_unverified_email: opt-OUT of the email-verification guard.
//     Defaults to false (the zero value), so the secure behaviour — reject
//     OAuth2 auto-links to an existing user when the IdP did not assert
//     `email_verified: true` — is the default even for a fresh install whose
//     settings row is created before this field is ever written. This closes
//     the account-takeover vector where an attacker claims the victim's
//     email at the IdP and PocketBase links the login to the real account.

migrate((app) => {
  const settings = app.findCollectionByNameOrId("instance_settings");
  if (!settings) return;

  let changed = false;

  if (!settings.fields.getByName("oidc_sync_mode")) {
    settings.fields.add(
      new SelectField({
        name: "oidc_sync_mode",
        maxSelect: 1,
        values: ["replace-oidc", "additive"],
      }),
    );
    changed = true;
  }

  if (!settings.fields.getByName("oidc_allow_unverified_email")) {
    settings.fields.add(new BoolField({ name: "oidc_allow_unverified_email" }));
    changed = true;
  }

  if (changed) app.save(settings);
}, (app) => {
  // Best-effort rollback; we do not remove fields to avoid data loss.
});
