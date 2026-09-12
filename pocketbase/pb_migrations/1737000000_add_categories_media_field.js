/// <reference path="../pb_data/types.d.ts" />

// Adds the `media` relation field to the `categories` collection.
//
// History: the production setup wizard (frontend/src/pages/Setup.tsx)
// shipped without this field in the categories schema, so any PB that
// was initialised via the wizard never had it. The frontend sends
// `media: "<id>"` on category create/update, but PB silently drops
// unknown fields on save — the response then has no `media` key and
// nothing is persisted. This migration repairs existing PBs in place.
//
// Behaviour:
// - categories doesn't exist yet → no-op (wait for setup wizard)
// - categories exists, media field already present → no-op (idempotent)
// - categories exists, no media field → add the field

migrate((app) => {
  let categories;
  try {
    categories = app.findCollectionByNameOrId("categories");
  } catch (_) {
    return; // categories doesn't exist yet — setup wizard hasn't run
  }

  if (categories.fields.getByName("media")) {
    return; // already there
  }

  let media;
  try {
    media = app.findCollectionByNameOrId("media");
  } catch (_) {
    return; // media collection doesn't exist either — wait for setup
  }

  categories.fields.add(
    new RelationField({
      name: "media",
      collectionId: media.id,
      maxSelect: 1,
      cascadeDelete: false,
    }),
  );

  app.save(categories);
}, (app) => {
  let categories;
  try {
    categories = app.findCollectionByNameOrId("categories");
  } catch (_) {
    return;
  }

  const field = categories.fields.getByName("media");
  if (!field) return;

  categories.fields.removeByName(field.id);
  app.save(categories);
});
