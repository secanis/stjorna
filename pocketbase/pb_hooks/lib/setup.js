/// <reference path="../../pb_data/types.d.ts" />

// STJÓRNA — first-run setup handlers (T-04). Registered by setup.pb.js;
// see that file for the security model.

var http = require(`${__hooks}/lib/http.js`);

var SETUP_TOKEN_MIN_LENGTH = 16;
var STORE_KEY = "stjorna.setupToken";

// PB v0.40 seeds this placeholder into `_superusers` on a fresh data dir
// for its installer UI; it can't log in and must not count as an admin.
var PB_INSTALLER_PLACEHOLDER_EMAIL = "__pbinstaller@example.com";

// Resolves the setup token once per process and caches it in
// $app.store(), so the onBootstrap banner and the route handlers (which
// run in different VMs) see the SAME value — including the random token
// generated when STJORNA_SETUP_TOKEN is unset or too short.
// Returns { token, source } where source is "env" or "log".
function setupToken() {
    var store = $app.store();
    if (store.has(STORE_KEY)) {
        return { token: String(store.get(STORE_KEY)), source: String(store.get(STORE_KEY + ".source")) };
    }
    var token = "";
    var source = "env";
    try {
        token = String($os.getenv("STJORNA_SETUP_TOKEN") || "").trim();
    } catch (_e) {
        token = "";
    }
    if (token && token.length < SETUP_TOKEN_MIN_LENGTH) {
        console.log(
            "[stjorna-setup] WARNING: STJORNA_SETUP_TOKEN is shorter than " +
                SETUP_TOKEN_MIN_LENGTH +
                " characters and will be IGNORED; a random token is generated instead"
        );
        token = "";
    }
    if (!token) {
        token = $security.randomString(40);
        source = "log";
    }
    // Source first: a reader that sees STORE_KEY must also see its source.
    store.set(STORE_KEY + ".source", source);
    store.set(STORE_KEY, token);
    return { token: token, source: source };
}

function realSuperuserExists(app) {
    var rows = app.findRecordsByFilter("_superusers", "email!={:ph}", "", 0, 0, { ph: PB_INSTALLER_PLACEHOLDER_EMAIL });
    return Array.isArray(rows) && rows.length > 0;
}

// `instance_settings` may not exist yet on a fresh install, so every
// failure counts as "not done".
function setupDone() {
    try {
        return !!$app.findFirstRecordByFilter("instance_settings", "setup_done=true");
    } catch (_e) {
        return false;
    }
}

// onBootstrap: print the generated token while no real superuser exists.
// The DB is only usable after e.next().
function bootstrapBanner(e) {
    e.next();
    var t = setupToken();
    if (t.source !== "log") return;
    try {
        if (realSuperuserExists($app)) return;
    } catch (_e) {}
    var lines = [
        "==============================================================",
        "No superuser exists yet. To create the first one, open the",
        "/setup wizard and enter this one-time setup token:",
        "",
        "    STJORNA_SETUP_TOKEN=" + t.token,
        "",
        "(set the STJORNA_SETUP_TOKEN env var to choose your own, or set",
        " PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD to skip the wizard)",
        "==============================================================",
    ];
    for (var i = 0; i < lines.length; i++) {
        console.log("[stjorna-setup] " + lines[i]);
    }
}

// GET /api/stjorna/setup-status
function statusHandler(e) {
    var exists = false;
    try {
        exists = realSuperuserExists($app);
    } catch (_e) {}
    http.reply(e, 200, {
        superuserExists: exists,
        setupDone: setupDone(),
        setupTokenRequired: true,
        setupTokenSource: setupToken().source,
    });
}

function fail(e, status, message) {
    http.reply(e, status, { ok: false, error: { code: status, message: message } });
}

// POST /api/stjorna/setup-bootstrap-superuser
// Check order: token (401) → body (400) → setup_done (409) → superuser
// exists (409) → transaction { re-check (409) + INSERT }.
function bootstrapHandler(e) {
    var tok = String(e.request.header.get("X-Stjorna-Setup-Token") || "").trim();
    if (!tok || !$security.equal(tok, setupToken().token)) {
        return fail(
            e,
            401,
            "missing or invalid setup token (STJORNA_SETUP_TOKEN env var, or the token printed in the PocketBase server log at startup)"
        );
    }

    var body = null;
    try {
        body = JSON.parse(http.readBody(e) || "{}");
    } catch (_jp) {
        return fail(e, 400, "invalid JSON body");
    }
    var email = String((body && body.email) || "").trim().toLowerCase();
    var pw = String((body && body.password) || "");
    var pwC = String((body && body.passwordConfirm) || "");
    if (!email || email.indexOf("@") < 1) return fail(e, 400, "email is required");
    if (!pw || pw.length < 10) return fail(e, 400, "password must be at least 10 characters");
    if (pw !== pwC) return fail(e, 400, "password and confirmation do not match");

    if (setupDone()) {
        return fail(
            e,
            409,
            "setup already completed; create additional superusers from the PocketBase admin UI or the `pocketbase superuser upsert` CLI"
        );
    }

    var existsPre = false;
    try {
        existsPre = realSuperuserExists($app);
    } catch (_ef) {}
    if (existsPre) return fail(e, 409, "superuser already exists; use the admin login instead");

    var newId = "";
    try {
        $app.runInTransaction(function (txApp) {
            if (realSuperuserExists(txApp)) {
                throw new Error("STJORNA_SUPERUSER_EXISTS");
            }
            var col = txApp.findCollectionByNameOrId("_superusers");
            if (!col) {
                throw new Error("_superusers collection not found");
            }
            var rec = new Record(col);
            // Typed auth setters so PB hashes the password itself.
            rec.setEmail(email);
            rec.setPassword(pw);
            rec.setVerified(true);
            try { rec.set("active", true); } catch (_ea) {}
            txApp.save(rec);
            newId = String(rec.id || "");
        });
    } catch (es) {
        var msg = String((es && es.message) || es || "unknown error");
        if (msg.indexOf("STJORNA_SUPERUSER_EXISTS") >= 0) {
            return fail(e, 409, "superuser already exists; use the admin login instead");
        }
        console.log("[stjorna-setup] bootstrap save failed: " + msg);
        return fail(e, 500, "could not create superuser: " + msg);
    }
    console.log("[stjorna-setup] first superuser created: " + email);
    http.reply(e, 200, { ok: true, id: newId, email: email });
}

module.exports = {
    setupToken: setupToken,
    bootstrapBanner: bootstrapBanner,
    statusHandler: statusHandler,
    bootstrapHandler: bootstrapHandler,
};
