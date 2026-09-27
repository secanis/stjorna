/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA superuser helpers.
//
// T-10 rewrite. The previous version guarded the `_superusers` auth
// paths from a `routerUse` middleware that matched the URL by hand
// (`/api/collections/_superusers/auth-with-password` exact equality).
// That guard was bypassable in three ways:
//
//   1. Collection id path. PB accepts either the collection name or
//      its id (`pbc_3142635823`) in the URL, so a request to
//      `/api/collections/pbc_3142635823/auth-with-password` skipped
//      the path match entirely — `routerUse` middleware that
//      watches the name path doesn't see it.
//
//   2. OTP. The router only watched password + refresh; OTP
//      (`/api/collections/_superusers/auth-with-otp`) was unguarded.
//
//   3. Case-folded email. The PB filter parser is case-sensitive,
//      while PB's internal superuser lookup normalises email to
//      lower case before matching. Submitting `ADMIN@…` returned
//      zero rows from the guard's filter, the guard fell through,
//      and PB's case-insensitive match then authenticated the
//      disabled superuser.
//
// We also previously let existing tokens survive a disable — the
// JWT kept working until expiry because nothing rotated the
// tokenKey.
//
// The new shape:
//
//   - One PB v0.40 record-auth hook per HTTP method, all tagged
//     `_superusers`:
//         onRecordAuthWithPasswordRequest
//         onRecordAuthWithOTPRequest
//         onRecordAuthRefreshRequest
//         onRecordAuthWithOAuth2Request
//
//     These fire AFTER PB has resolved the record (for password /
//     OTP / OAuth2) or verified the JWT (for refresh), so we can
//     inspect `e.record.get("active")` directly. Crucially, the
//     tag matches the EVENT's collection by NAME only, but the
//     events themselves fire for both the name URL path
//     (`/api/collections/_superusers/auth-with-password`) AND the
//     id URL path (`/api/collections/pbc_3142635823/...`) because
//     PB resolves the event's collection reference once, before
//     triggering the hook chain. We confirmed this empirically: a
//     hook tagged `_superusers` sees the resolved record on both
//     URL variants. Tagging with the id is unnecessary.
//
//   - `onRecordUpdateExecute("_superusers")` rotates the token key
//     on every active→inactive transition. PB mints JWTs that
//     include the record's `tokenKey`; rotating it invalidates
//     every JWT already issued to that record. The hook runs
//     after the UPDATE has been applied, so the new `active=false`
//     value AND the new tokenKey become visible together — no
//     window where the disabled account is reachable via an old
//     JWT.
//
// Notes:
//
//   - Do NOT wrap the `throw new ForbiddenError(...)` in a
//     try/catch. PB's hook runtime lets the error propagate; a
//     try/catch swallows it and PB then writes a 200. We rely on
//     the throw reaching PB's outer handler so PB's ApiError
//     machinery can translate it into a 403 response.
//
//   - The four specific hooks each have their own event type with
//     a `record?` field. We don't fall through to `e.next()`
//     before the throw because throwing short-circuits the auth
//     chain.
//
// We keep the existing create defaults (new `_superusers` rows
// must land with `active=true`; the BoolField default is `false`)
// and the existing update-merge behaviour (an
// `active=null/undefined/''` patch keeps the previous value),
// because those are not what T-10 is about and they interact
// with the bootstrap path in entrypoint.sh.

console.log("[stjorna-superusers] loading");

// ---------------------------------------------------------------------------
// Create defaults — keep existing behaviour.
// ---------------------------------------------------------------------------

onRecordCreateRequest((e) => {
    try {
        var active = e.record.get("active");
        if (active === null || active === undefined || active === "") {
            e.record.set("active", true);
        }
    } catch (_) {
        e.record.set("active", true);
    }
    e.next();
}, "_superusers");

// `onRecordCreateExecute` catches the CLI / `$app.save()` path the
// *Request hook doesn't see.
onRecordCreateExecute((e) => {
    try {
        if (e.record.get("active") !== true && e.record.get("active") !== 1) {
            e.record.set("active", true);
        }
    } catch (_) {}
    e.next();
}, "_superusers");

// ---------------------------------------------------------------------------
// Update — preserve the existing merge behaviour, AND rotate the token key
// when an active superuser is being disabled.
// ---------------------------------------------------------------------------

onRecordUpdateRequest((e) => {
    try {
        var newActive = e.record.get("active");
        if (newActive === null || newActive === undefined || newActive === "") {
            var prev = $app.findRecordById("_superusers", e.record.id);
            e.record.set("active", prev.get("active"));
        }
    } catch (_) {}
    e.next();
}, "_superusers");

onRecordUpdateExecute((e) => {
    try {
        var rec = e.record;
        var active = rec.get("active");
        var prev = $app.findRecordById("_superusers", rec.id);
        var prevActive = prev.get("active");
        var isInactive = active === false || active === "false" || active === 0 || active === "0";
        var wasActive = prevActive === true || prevActive === 1;
        if (isInactive && wasActive) {
            if (typeof rec.refreshTokenKey === "function") {
                try { rec.refreshTokenKey(); } catch (_eR) {
                    console.log("[stjorna-superusers] refreshTokenKey failed: " + (_eR && (_eR.message || _eR)));
                }
            }
        }
    } catch (_) {}
    e.next();
}, "_superusers");

// ---------------------------------------------------------------------------
// Auth guard — fires for password / OTP / refresh / OAuth2 on `_superusers`.
// PB has already resolved the auth record before these run, so we just
// inspect `active` and throw `ForbiddenError` if it's false. Each hook
// handles ONE HTTP method; together they cover every auth endpoint on
// the `_superusers` collection, on BOTH URL variants (name and id).
// ---------------------------------------------------------------------------

function _superuserAuthGuard(e) {
    var rec = e.record;
    if (rec) {
        var a = rec.get("active");
        if (a === false || a === "false" || a === 0 || a === "0") {
            throw new ForbiddenError("Superuser account is disabled");
        }
    }
    e.next();
}

onRecordAuthWithPasswordRequest(_superuserAuthGuard, "_superusers");
onRecordAuthWithOTPRequest(_superuserAuthGuard, "_superusers");
onRecordAuthRefreshRequest(_superuserAuthGuard, "_superusers");
onRecordAuthWithOAuth2Request(_superuserAuthGuard, "_superusers");

console.log("[stjorna-superusers] hooks loaded");
