/// <reference path="../pb_data/types.d.ts" />

// T-02 follow-up: the tenant-isolation rules added in 1770001000 broke the
// setup wizard's S3 connectivity test. That test runs as the initial
// `_superusers` record before any tenant or user_tenants rows exist, so the
// membership checks in the media collection rules reject the create/delete
// requests even though the caller is a superuser.
//
// This migration appends a superuser bypass to the media collection rules.
// Superusers are already full admins; the bypass only makes PB v0.40's rule
// engine explicit about it for the regular collection endpoints, where the
// tenant-isolation fragments would otherwise evaluate the `_superusers` auth
// record against the `user_tenants` relation.

migrate((app) => {
  const superusers = app.findCollectionByNameOrId("_superusers");
  // PB v0.40's default _superusers collection id; used as fallback if the
  // lookup fails (shouldn't happen on a real instance).
  const superusersId = superusers ? superusers.id : "pbc_3142635823";
  const bypass = "@request.auth.collectionId = '" + superusersId + "'";

  const media = app.findCollectionByNameOrId("media");
  if (!media) return;

  const rules = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];
  for (const key of rules) {
    const current = media[key];
    if (!current || typeof current !== "string") continue;
    // Avoid double-applying if the migration runs more than once.
    if (current.indexOf("@request.auth.collectionId = '" + superusersId + "'") >= 0) continue;
    // Wrap the existing rule and OR it with the superuser bypass.
    media[key] = "(" + current + ") || (" + bypass + ")";
  }

  app.save(media);
}, (app) => {
  // Best-effort rollback: strip the appended bypass clause.
  const superusers = app.findCollectionByNameOrId("_superusers");
  const superusersId = superusers ? superusers.id : "pbc_3142635823";
  const bypassSuffix = " || (@request.auth.collectionId = '" + superusersId + "')";

  const media = app.findCollectionByNameOrId("media");
  if (!media) return;

  const rules = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];
  for (const key of rules) {
    const current = media[key];
    if (!current || typeof current !== "string") continue;
    media[key] = current.split(bypassSuffix).join("");
  }

  app.save(media);
});
