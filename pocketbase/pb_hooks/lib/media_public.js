/// <reference path="../../pb_data/types.d.ts" />

// STJÓRNA v3 — public media serving.
//
// GET /api/stjorna/media/{id}/file?thumb=300x300
//
// Serves a single media file WITHOUT a token, but only when the record is
// explicitly marked public (media.public === true). Everything else stays
// on the T-08 protected-file path (/api/files/media/… requires a short-lived
// file token and the tenant-member record rule).
//
// The response reuses PocketBase's own filesystem serving (Range requests,
// content-type, cache headers, lazy thumbnail generation) by calling
// $app.newFilesystem().serve(). Thumbnails are stored by PB at
// {baseFilesPath}/thumbs_{filename}/{size}_{filename} and generated on demand
// via fsys.createThumb(); a non-image file or an invalid size falls back to
// the original bytes (same behaviour as PB's built-in file endpoint).

function replyError(e, status, message) {
    e.response.header().set("Content-Type", "application/json; charset=utf-8");
    e.string(status, JSON.stringify({ ok: false, error: { code: status, message: message } }));
}

function publicFileHandler(e) {
    var fsys = null;
    try {
        var id = "";
        try { id = String(e.request.pathValue("id") || "").trim(); } catch (_) {}
        if (!id) {
            replyError(e, 404, "media id required");
            return;
        }

        var record;
        try {
            record = $app.findRecordById("media", id);
        } catch (_) {
            replyError(e, 404, "not found");
            return;
        }

        // Only files the tenant explicitly marked public are served here.
        if (record.get("public") !== true) {
            replyError(e, 404, "not found");
            return;
        }

        var filename = "";
        try { filename = String(record.get("file") || ""); } catch (_) {}
        if (!filename) {
            replyError(e, 404, "not found");
            return;
        }

        var basePath = record.baseFilesPath();
        var originalPath = basePath + "/" + filename;
        var servePath = originalPath;
        var serveName = filename;

        fsys = $app.newFilesystem();

        var thumb = "";
        try { thumb = String(e.request.url.query().get("thumb") || "").trim(); } catch (_) {}
        if (thumb) {
            var thumbPath = basePath + "/thumbs_" + filename + "/" + thumb + "_" + filename;
            try {
                var exists = false;
                try { exists = !!fsys.exists(thumbPath); } catch (_) { exists = false; }
                if (!exists) {
                    fsys.createThumb(originalPath, thumbPath, thumb);
                }
                servePath = thumbPath;
                serveName = thumb + "_" + filename;
            } catch (_thumbErr) {
                // Invalid thumb size or a non-image file — serve the original.
                servePath = originalPath;
                serveName = filename;
            }
        }

        fsys.serve(e.response, e.request, servePath, serveName);
    } catch (ex) {
        console.log("[stjorna-media-public] serve error: " + (ex && ex.message ? ex.message : ex));
        replyError(e, 500, "failed to serve file");
    } finally {
        try { if (fsys) fsys.close(); } catch (_) {}
    }
}

module.exports = {
    publicFileHandler: publicFileHandler,
};
