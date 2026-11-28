/// <reference path="../pb_data/types.d.ts" />

// Add an opt-in `public` flag to media so a tenant can expose individual
// files (marketing images, product shots, …) for anonymous embedding via the
// public route GET /api/stjorna/media/{id}/file.
//
// Defaults to false. The T-08 protected-file model is unchanged: media.file
// stays `protected: true`, and the normal /api/files/media/… path still
// requires a short-lived file token. Only records explicitly marked public
// are served token-free, and only through the dedicated public route.
//
// Rollback: drop the field. Existing rows lose their flag; no data loss.

migrate((app) => {
  const media = app.findCollectionByNameOrId("media");
  if (!media) return;

  if (!media.fields.getByName("public")) {
    media.fields.add(new BoolField({ name: "public" }));
    app.save(media);
  }
}, (app) => {
  try {
    const media = app.findCollectionByNameOrId("media");
    if (!media) return;
    if (media.fields.getByName("public")) {
      media.fields.removeByName("public");
      app.save(media);
    }
  } catch (_) {}
});
