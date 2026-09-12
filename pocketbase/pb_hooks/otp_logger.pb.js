/// <reference path="../pb_data/types.d.ts" />

/*
 * STJÓRNA OTP logger for _superusers (opt-in)
 *
 * Purpose:
 * When SMTP is not configured, PocketBase cannot deliver OTP emails. This hook
 * prints the generated OTP code to the PocketBase process logs so it can be
 * copied manually during testing/development.
 *
 * Security warning:
 * OTP codes are authentication secrets. Enabling this logger writes those
 * secrets to stdout/log output. Anyone with access to the logs can impersonate
 * a superuser. Do NOT enable this in production or in any environment where
 * logs are shared or retained.
 *
 * Activation:
 * Set the environment variable STJORNA_LOG_OTP before starting PocketBase.
 * Accepted values: "1", "true" or "yes" (case-insensitive).
 * Example (docker-compose):
 *   services:
 *     pocketbase:
 *       environment:
 *         STJORNA_LOG_OTP: "1"
 *
 * If the variable is unset or empty, this hook is not registered and OTP emails
 * are handled normally (sent via the configured mailer).
 *
 * Scope:
 * Only the _superusers collection is logged. Other auth collections are left
 * untouched.
 *
 * Behavior when enabled:
 * The hook intercepts the OTP email for _superusers, logs the recipient and
 * the OTP code, and then skips the actual mailer send. This means no email is
 * dispatched; the code must be read from the logs. This is intentional for
 * environments without a working SMTP relay.
 *
 * How the code is extracted:
 * PocketBase renders the OTP into the email template using the {OTP}
 * placeholder. The default template wraps it in <strong>{OTP}</strong>. This
 * hook first looks for a <strong>12345678</strong> style value in the rendered
 * HTML/text body. If that fails, it falls back to a digit sequence whose length
 * matches the collection's configured OTP length.
 */

const OTP_LOG_VALUE = ($os.getenv("STJORNA_LOG_OTP") || "").toLowerCase();
const OTP_LOG_ENABLED = OTP_LOG_VALUE === "1" || OTP_LOG_VALUE === "true" || OTP_LOG_VALUE === "yes";

if (OTP_LOG_ENABLED) {
  onMailerRecordOTPSend((e) => {
    try {
      let collectionName = "";
      try {
        if (e.record && typeof e.record.collection === "function") {
          const col = e.record.collection();
          if (col) {
            collectionName = col.name || "";
          }
        }
      } catch (_) {}

      if (collectionName !== "_superusers") {
        return e.next();
      }

      const html = (e.message && e.message.html) || "";
      const text = (e.message && e.message.text) || "";
      const body = String(html) + " " + String(text);

      let code = "";
      const strongMatch = body.match(/<strong>\s*(\d+)\s*<\/strong>/i);
      if (strongMatch) {
        code = strongMatch[1];
      } else {
        let len = 8;
        try {
          const col = e.record.collection();
          if (col && col.otp && col.otp.length) {
            len = Number(col.otp.length);
          }
        } catch (_) {}
        const genericMatch = body.match(new RegExp("\\b\\d{" + len + "}\\b"));
        if (genericMatch) {
          code = genericMatch[0];
        }
      }

      let email = "unknown";
      try {
        if (e.record && typeof e.record.email === "function") {
          email = e.record.email();
        }
      } catch (_) {}

      console.log(
        `[stjorna-otp-logger] collection=${collectionName} email=${email} otp=${code}`
      );

      // Skip the real SMTP send. The OTP record has already been created by
      // the request handler; returning without e.next() keeps that record and
      // avoids the "no SMTP" mailer error.
      return;
    } catch (err) {
      console.log("[stjorna-otp-logger] error: " + (err && err.message));
    }
  }, "_superusers");
}
