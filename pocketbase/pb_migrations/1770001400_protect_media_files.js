/// <reference path="../pb_data/types.d.ts" />

// T-08: protect media.file so files cannot be read anonymously, and so
// the cross-tenant leak vector closes (a request for /api/files/media/<id>/<file>
// previously returned the bytes regardless of the requesting tenant's
// user_tenants membership, as long as the row passed the file rule's
// visibility filter — which was just '@request.auth.id != ""').
//
// With `protected: true` on the FileField, PB requires a SHORT-LIVED
// FILE TOKEN (issued via pb.files.getToken()) on every file request.
// The token is bound to the authenticated user; the existing record
// rule ("only members of the file's tenant can read the record") still
// gates access. So:
//
//   - Anonymous fetch  -> 401/404
//   - Tenant B user's file token -> 403 (record rule rejects)
//   - Tenant A user's file token -> 200 (file bytes)
//
// The frontend (frontend/src/utils/mediaUrl.ts) used to append the
// FULL AUTH JWT as ?token=..., which is the wrong token type and ended
// up in nginx logs, browser history, referers, and copied links. The
// companion fix in that file replaces pb.authStore.token with the
// cached pb.files.getToken() result.
//
// Rollback: best-effort restore of `protected: false`. Data is not
// touched.

migrate((app) => {
  const media = app.findCollectionByNameOrId("media");
  if (!media) return;

  const f = media.fields.getByName("file");
  if (!f) return;

  if (!f.protected) {
    f.protected = true;
    app.save(media);
  }
}, (app) => {
  try {
    const media = app.findCollectionByNameOrId("media");
    if (!media) return;
    const f = media.fields.getByName("file");
    if (f && f.protected) {
      f.protected = false;
      app.save(media);
    }
  } catch (_) {}
});
