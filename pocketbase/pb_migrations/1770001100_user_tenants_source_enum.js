/// <reference path="../pb_data/types.d.ts" />

// T-03 (defence-in-depth): restrict the `source` field on user_tenants
// to a small enum so PB itself rejects any junk value before the hook
// chain even sees it.
//
// `source` semantics:
//   - "oidc"    — written by oidc_groups.pb.js when a JWT group maps to
//                  a tenant. Reserved for the OIDC sync; the user_tenants
//                  hook rejects any API request that tries to stamp it.
//   - "manual"  — written via the admin / setup / invite paths.
//   - ""        — legacy rows from before this field was populated
//                  (kept allowed for back-compat; the OIDC sync treats
//                  it as "not oidc" so manual + empty both stay
//                  untouched by the sync).
//
// The hook already prevents API writes of `source = "oidc"`, but if
// that hook ever regresses the column constraint stops a junk value
// from landing in the DB.

migrate((app) => {
  const ut = app.findCollectionByNameOrId("user_tenants");
  if (!ut) return;

  const existing = ut.fields.getByName("source");
  if (existing && existing.type === "select") return; // already migrated

  // PB's Field objects are mostly immutable after construction; we have
  // to drop + re-add to change the type. Drop the old text field (if any)
  // and add a fresh select field with the canonical allowed values.
  if (existing) {
    ut.fields.removeByName("source");
  }
  ut.fields.add(new SelectField({
    name: "source",
    maxSelect: 1,
    values: ["oidc", "manual", ""],
  }));
  app.save(ut);
}, (app) => {
  // Rollback: best-effort restore as a plain text field. Existing
  // values aren't touched; PB will widen the column back to TEXT.
  const ut = app.findCollectionByNameOrId("user_tenants");
  if (!ut) return;
  const src = ut.fields.getByName("source");
  if (!src || src.type !== "select") return;
  try {
    ut.fields.removeByName("source");
    ut.fields.add(new TextField({ name: "source", max: 50 }));
    app.save(ut);
  } catch (_) {}
});
