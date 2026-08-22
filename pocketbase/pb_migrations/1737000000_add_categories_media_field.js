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
//
// Note: PB 0.22.7 exits the serve process if a migration throws during
// startup, so we early-return on the "not ready" case rather than
// throwing. Setup.tsx has been updated to create categories WITH the
// media field on fresh installs, so this migration mainly helps PBs
// that were set up before that fix.

migrate((db) => {
  const dao = new Dao(db);

  let categories;
  try {
    categories = dao.findCollectionByNameOrId("categories");
  } catch (_) {
    return; // categories doesn't exist yet — setup wizard hasn't run
  }

  if (categories.schema.getFieldByName("media")) {
    return; // already there
  }

  let media;
  try {
    media = dao.findCollectionByNameOrId("media");
  } catch (_) {
    return; // media collection doesn't exist either — wait for setup
  }

  categories.schema.addField(
    new SchemaField({
      name: "media",
      type: "relation",
      options: {
        collectionId: media.id,
        maxSelect: 1,
        cascadeDelete: false,
      },
    }),
  );

  return dao.saveCollection(categories);
}, (db) => {
  const dao = new Dao(db);

  let categories;
  try {
    categories = dao.findCollectionByNameOrId("categories");
  } catch (_) {
    return;
  }

  const field = categories.schema.getFieldByName("media");
  if (!field) return;

  categories.schema.removeField(field.id);
  return dao.saveCollection(categories);
});