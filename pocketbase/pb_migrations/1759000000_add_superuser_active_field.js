/// <reference path="../pb_data/types.d.ts" />

// Adds an `active` flag to the `_superusers` auth collection so that
// superuser accounts can be disabled without deleting them.
//
// Existing superusers are set to active=true. New superusers default to
// active=true via the hook in superusers.pb.js.

migrate((app) => {
  const su = app.findCollectionByNameOrId("_superusers");
  if (!su) return;

  let changed = false;
  if (!su.fields.getByName("active")) {
    su.fields.add(new BoolField({ name: "active" }));
    changed = true;
  }

  if (changed) {
    app.save(su);
  }

  // Ensure every existing superuser is active. BoolField defaults to false
  // for records that predate the field, so flip them explicitly.
  try {
    var existing = app.findRecordsByFilter("_superusers", "active = false || active = null || active = ''", "", 0, 0);
    for (var i = 0; i < existing.length; i++) {
      var rec = existing[i];
      if (!rec) continue;
      rec.set("active", true);
      app.save(rec);
    }
  } catch (_) {
    // best-effort: if the filter is not supported for bool, ignore
  }
}, (app) => {
  // Rollback is best-effort; we do not drop the active field to avoid
  // destroying data.
});
