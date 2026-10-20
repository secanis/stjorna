/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA v3 — per-tenant statistics
//
// Custom route:
//   GET /api/stjorna/stats[?tenant=<id>]
//
// Returns a single snapshot object per tenant:
//   - counts (categories, products, media, users)
//   - storage (sum of media.size, largest media, per-mime breakdown)
//   - activity (last 30 days)
//
// Auth (T-01):
//   - requireAuth() middleware — PB verifies the JWT signature and
//     populates e.auth (null only for anonymous callers).
//   - Superuser (e.hasSuperuserAuth()) → can query any tenant via ?tenant=
//   - Tenant user (e.auth.id) → can query own tenant only. The query
//     param is IGNORED for tenant users so an admin can't craft a URL
//     that flips their view to someone else's tenant by piggybacking
//     on a tenant user's session.
//   - No bearer → 401 from middleware.
//
// Why server-side aggregation instead of FE-side getFullList + fold:
//   STJÓRNA's `media` collections can hold tens of thousands of rows
//   per tenant. Pulling every record just to sum `size` would chew
//   bandwidth + memory on both ends. One server-side scan over the
//   same rows gives us all five aggregates at once (sum, max, mime
//   map, count, activity timestamps) with one HTTP round-trip.
//
// The handler lives in pb_hooks/lib/stats.js and is require()d inside the
// route handler (loader/executor VM split).

console.log("[stjorna-stats] loading");

routerAdd("GET", "/api/stjorna/stats", (e) => {
    require(`${__hooks}/lib/stats.js`).statsHandler(e);
}, $apis.requireAuth());
console.log("[stjorna-stats] registered GET /api/stjorna/stats");
