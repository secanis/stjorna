/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA v3 — tenant-scoped backup & restore routes.
//
// Full-instance disaster recovery should use PocketBase's built-in
// /api/backups endpoint (PB v0.40+), which captures the entire data
// directory including local/S3 files atomically. The custom routes below
// are only for tenant migration/cloning: export/import one tenant's
// categories, products and media.
//
// Routes:
//   GET  /api/stjorna/export/:tenant   — tenant member, returns ZIP
//   POST /api/stjorna/import/:tenant   — tenant admin, multipart ZIP
//
// Implementation lives in pb_hooks/lib/backup.js and is require()d inside
// each handler to satisfy the loader/executor VM split.

console.log("[stjorna-backup] loading");

// Full-instance disaster recovery is intentionally NOT implemented here.
// Use PocketBase's built-in /api/backups endpoint instead.

routerAdd(
    "GET",
    "/api/stjorna/export/{tenant}",
    new Function("e", "require(`${__hooks}/lib/backup.js`).exportHandler(e)"),
    $apis.requireAuth()
);
console.log("[stjorna-backup] registered GET /api/stjorna/export/{tenant}");

routerAdd(
    "POST",
    "/api/stjorna/import/{tenant}",
    new Function("e", "require(`${__hooks}/lib/backup.js`).importHandler(e)"),
    $apis.requireAuth()
);
console.log("[stjorna-backup] registered POST /api/stjorna/import/{tenant}");

console.log("[stjorna-backup] all routes registered");
