/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA v3 — public media serving.
//
//   GET /api/stjorna/media/{id}/file?thumb=300x300
//
// Serves one media file WITHOUT a token, but only when the record is marked
// public (media.public === true). No auth middleware — anonymous embedding is
// the point. Implementation lives in pb_hooks/lib/media_public.js (required
// inside the handler because handlers run in a separate VM from this file).

console.log("[stjorna-media-public] loading");

routerAdd("GET", "/api/stjorna/media/{id}/file", (e) => {
    require(`${__hooks}/lib/media_public.js`).publicFileHandler(e);
});

console.log("[stjorna-media-public] all routes registered");
