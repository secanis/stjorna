/// <reference path="../pb_data/types.d.ts" />

// STJÓRNA v3 — tenant-scoped backup/restore helpers.
//
// Loaded via require() from backup.pb.js handlers. This module runs in the
// executor VM and can use $app, $filesystem, $os, etc.
//
// Design notes:
//   - Export produces a tenant-only ZIP (manifest.json + media files) so it
//     can be used for tenant migration/cloning. Full-instance disaster
//     recovery should use PocketBase's built-in /api/backups endpoint.
//   - Media files are read through $app.newFilesystem() so the export works
//     with both local pb_data/storage and S3-backed storage.
//   - Import is transactional ($app.runInTransaction) and idempotent by slug
//     for categories/products; media are matched by filename.
//   - Old category and media relations are remapped to the newly created IDs.
//   - v1 STJÓRNA JSON imports are still supported via source=v1.

var SECRET_FIELDS = ["s3_secret_key", "s3_access_key", "oidc_client_secret"];
var EXPORT_VERSION = "3.1.0";
var MAX_FILE_BYTES = 500 * 1024 * 1024;

function replyJson(e, status, obj) {
    e.response.header().set("Content-Type", "application/json; charset=utf-8");
    e.string(status, JSON.stringify(obj));
}

function replyError(e, status, message) {
    replyJson(e, status, { success: false, error: { code: status, message: message } });
}

function isSuperuser(e) {
    return !!e.hasSuperuserAuth();
}

function getUserId(e) {
    return e.auth ? String(e.auth.id || "") : "";
}

function isTenantMember(userId, tenantId) {
    if (!userId || !tenantId) return false;
    try {
        var rows = $app.findRecordsByFilter("user_tenants", "user={:u} && tenant={:t}", "", 1, 0, { u: userId, t: tenantId });
        return rows && rows.length > 0;
    } catch (ex) {
        return false;
    }
}

function isTenantAdmin(userId, tenantId) {
    if (!userId || !tenantId) return false;
    try {
        var rows = $app.findRecordsByFilter("user_tenants", "user={:u} && tenant={:t}", "", 1, 0, { u: userId, t: tenantId });
        if (!rows || !rows.length) return false;
        var roleId = String(rows[0].get("role") || "");
        if (!roleId) return false;
        var role = $app.findRecordById("roles", roleId);
        return String(role.get("name") || "") === "admin";
    } catch (ex) {
        return false;
    }
}

function stripSecrets(obj) {
    if (!obj || typeof obj !== "object") return obj;
    var out = {};
    for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        if (SECRET_FIELDS.indexOf(k) >= 0) continue;
        out[k] = obj[k];
    }
    return out;
}

function slugify(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 100);
}

function utf8Bytes(s) {
    var b = [];
    for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
            var c2 = s.charCodeAt(i + 1);
            if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
                c = 0x10000 + ((c & 0x3FF) << 10) + (c2 & 0x3FF);
                i++;
            }
        }
        if (c < 0x80) {
            b.push(c);
        } else if (c < 0x800) {
            b.push(0xC0 | (c >> 6));
            b.push(0x80 | (c & 0x3F));
        } else if (c < 0x10000) {
            b.push(0xE0 | (c >> 12));
            b.push(0x80 | ((c >> 6) & 0x3F));
            b.push(0x80 | (c & 0x3F));
        } else {
            b.push(0xF0 | ((c >> 18) & 0x07));
            b.push(0x80 | ((c >> 12) & 0x3F));
            b.push(0x80 | ((c >> 6) & 0x3F));
            b.push(0x80 | (c & 0x3F));
        }
    }
    return b;
}

function bytesToUtf8(b) {
    var out = "";
    var i = 0;
    while (i < b.length) {
        var c = b[i] & 0xFF;
        if (c < 0x80) {
            out += String.fromCharCode(c);
            i++;
            continue;
        }
        var need = 0;
        if ((c & 0xE0) === 0xC0) {
            need = 1;
            c = c & 0x1F;
        } else if ((c & 0xF0) === 0xE0) {
            need = 2;
            c = c & 0x0F;
        } else if ((c & 0xF8) === 0xF0) {
            need = 3;
            c = c & 0x07;
        } else {
            out += String.fromCharCode(0xFFFD);
            i++;
            continue;
        }
        if (i + need >= b.length) {
            out += String.fromCharCode(0xFFFD);
            break;
        }
        var ok = true;
        for (var k = 0; k < need; k++) {
            var n = b[i + 1 + k];
            if ((n & 0xC0) !== 0x80) {
                ok = false;
                break;
            }
            c = (c << 6) | (n & 0x3F);
        }
        if (!ok) {
            out += String.fromCharCode(0xFFFD);
            i++;
            continue;
        }
        if (c > 0xFFFF) {
            c -= 0x10000;
            out += String.fromCharCode(0xD800 + (c >> 10));
            out += String.fromCharCode(0xDC00 + (c & 0x3FF));
        } else {
            out += String.fromCharCode(c);
        }
        i += need + 1;
    }
    return out;
}

function looksLikeBytes(v) {
    return typeof v === "object" && v !== null && typeof v.length === "number" && v.length > 0 && typeof v[0] === "number";
}

function parseJsonValue(v) {
    if (v === undefined || v === null) return {};
    if (typeof v === "string") {
        try { return JSON.parse(v); } catch (ex) { return {}; }
    }
    if (looksLikeBytes(v)) {
        try { return JSON.parse(bytesToUtf8(v)); } catch (ex) { return {}; }
    }
    if (typeof v === "object") return v;
    return {};
}

function jsonFieldValue(v) {
    return parseJsonValue(v);
}

function w32(a, o, v) {
    a[o] = v & 0xFF;
    a[o + 1] = (v >>> 8) & 0xFF;
    a[o + 2] = (v >>> 16) & 0xFF;
    a[o + 3] = (v >>> 24) & 0xFF;
}

function w16(a, o, v) {
    a[o] = v & 0xFF;
    a[o + 1] = (v >>> 8) & 0xFF;
}

var CRC_TABLE = null;
function crc32(buf, off, len) {
    if (!CRC_TABLE) {
        CRC_TABLE = [];
        for (var ci = 0; ci < 256; ci++) {
            var cv = ci;
            for (var ck = 0; ck < 8; ck++) {
                cv = ((cv & 1) === 1) ? (0xEDB88320 ^ (cv >>> 1)) : (cv >>> 1);
            }
            CRC_TABLE[ci] = cv >>> 0;
        }
    }
    var c = 0xFFFFFFFF;
    for (var k = 0; k < len; k++) {
        c = CRC_TABLE[(c ^ buf[off + k]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function readFileBytes(fileKey, maxBytes) {
    var fsys = $app.newFilesystem();
    try {
        var reader = fsys.getReader(fileKey);
        try {
            return toBytes(reader, maxBytes || MAX_FILE_BYTES);
        } finally {
            try { reader.close(); } catch (ex) {}
        }
    } catch (ex) {
        console.log("[stjorna-backup] readFileBytes failed for " + fileKey + ": " + (ex && ex.message ? ex.message : ex));
        return null;
    } finally {
        try { fsys.close(); } catch (ex) {}
    }
}

function recordToPlain(record, extraStrip) {
    var obj = {};
    try { obj = record.publicExport(); } catch (ex) { obj = {}; }
    obj.id = record.id;
    obj = stripSecrets(obj);
    if (extraStrip && extraStrip.length) {
        for (var i = 0; i < extraStrip.length; i++) {
            delete obj[extraStrip[i]];
        }
    }
    // JSON fields may come back as raw bytes/string from publicExport();
    // normalize them so the manifest is plain JSON.
    if (obj.custom_fields !== undefined) {
        obj.custom_fields = parseJsonValue(obj.custom_fields);
    }
    return obj;
}

function buildLocalHeader(nameBytes, data, crc) {
    var size = data ? data.length : 0;
    var lfh = new Array(30 + nameBytes.length);
    w32(lfh, 0, 0x04034b50);
    w16(lfh, 4, 20);
    w16(lfh, 6, 0);
    w16(lfh, 8, 0); // STORE
    w16(lfh, 10, 0);
    w16(lfh, 12, 0);
    w32(lfh, 14, crc);
    w32(lfh, 18, size);
    w32(lfh, 22, size);
    w16(lfh, 26, nameBytes.length);
    w16(lfh, 28, 0);
    for (var i = 0; i < nameBytes.length; i++) {
        lfh[30 + i] = nameBytes[i];
    }
    return lfh;
}

function buildCentralDirectory(nameBytes, data, crc, localOffset) {
    var size = data ? data.length : 0;
    var cd = new Array(46 + nameBytes.length);
    w32(cd, 0, 0x02014b50);
    w16(cd, 4, 20);
    w16(cd, 6, 20);
    w16(cd, 8, 0);
    w16(cd, 10, 0); // STORE
    w16(cd, 12, 0);
    w16(cd, 14, 0);
    w32(cd, 16, crc);
    w32(cd, 20, size);
    w32(cd, 24, size);
    w16(cd, 28, nameBytes.length);
    w16(cd, 30, 0);
    w16(cd, 32, 0);
    w16(cd, 34, 0);
    w16(cd, 36, 0);
    w32(cd, 38, 0);
    w32(cd, 42, localOffset);
    for (var i = 0; i < nameBytes.length; i++) {
        cd[46 + i] = nameBytes[i];
    }
    return cd;
}

function buildEocd(cdCount, cdSize, cdOffset) {
    var eocd = new Array(22);
    w32(eocd, 0, 0x06054b50);
    w16(eocd, 4, 0);
    w16(eocd, 6, 0);
    w16(eocd, 8, cdCount);
    w16(eocd, 10, cdCount);
    w32(eocd, 12, cdSize);
    w32(eocd, 16, cdOffset);
    w16(eocd, 20, 0);
    return eocd;
}

function buildZipBytes(manifest, mediaEntries) {
    var entries = [];
    var manifestBytes = utf8Bytes(JSON.stringify(manifest, null, 2));
    entries.push({ name: "manifest.json", data: manifestBytes });

    for (var i = 0; i < mediaEntries.length; i++) {
        var me = mediaEntries[i];
        var bytes = readFileBytes(me.fileKey, MAX_FILE_BYTES);
        if (bytes && bytes.length) {
            entries.push({ name: "media/" + me.oldId + "/" + me.filename, data: bytes });
        } else {
            console.log("[stjorna-backup] skipping missing media file: " + me.fileKey);
        }
    }

    var localParts = [];
    var cdParts = [];
    var localOffset = 0;
    for (var i = 0; i < entries.length; i++) {
        var ent = entries[i];
        var nameBytesArr = utf8Bytes(ent.name);
        var crc = crc32(ent.data, 0, ent.data.length);
        var lfh = buildLocalHeader(nameBytesArr, ent.data, crc);
        localParts.push(lfh);
        localParts.push(ent.data);
        var cd = buildCentralDirectory(nameBytesArr, ent.data, crc, localOffset);
        cdParts.push(cd);
        localOffset += lfh.length + ent.data.length;
    }

    var cdStart = localOffset;
    var cdSize = 0;
    for (var i = 0; i < cdParts.length; i++) cdSize += cdParts[i].length;
    var eocd = buildEocd(entries.length, cdSize, cdStart);

    var total = localOffset + cdSize + eocd.length;
    var zip = new Array(total);
    var pos = 0;
    for (var i = 0; i < localParts.length; i++) {
        var part = localParts[i];
        for (var j = 0; j < part.length; j++) zip[pos++] = part[j];
    }
    for (var i = 0; i < cdParts.length; i++) {
        var part = cdParts[i];
        for (var j = 0; j < part.length; j++) zip[pos++] = part[j];
    }
    for (var i = 0; i < eocd.length; i++) zip[pos++] = eocd[i];
    return zip;
}

function parseZipBytes(bytes) {
    if (bytes.length < 22) throw new Error("file too small to be a ZIP");
    var eocdOff = -1;
    var minBack = Math.max(0, bytes.length - 65557);
    for (var i = bytes.length - 22; i >= minBack; i--) {
        if (bytes[i] === 0x50 && bytes[i + 1] === 0x4B && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
            eocdOff = i;
            break;
        }
    }
    if (eocdOff < 0) throw new Error("invalid ZIP: EOCD not found");

    var cdCount = (bytes[eocdOff + 10] & 0xFF) | ((bytes[eocdOff + 11] & 0xFF) << 8);
    var cdOff = ((bytes[eocdOff + 16] & 0xFF) | ((bytes[eocdOff + 17] & 0xFF) << 8) | ((bytes[eocdOff + 18] & 0xFF) << 16) | ((bytes[eocdOff + 19] & 0xFF) << 24)) >>> 0;
    if (cdOff >= bytes.length) throw new Error("invalid ZIP: central directory out of bounds");

    var files = {};
    var p = cdOff;
    for (var fi = 0; fi < cdCount; fi++) {
        if (p + 46 > bytes.length) break;
        if (bytes[p] !== 0x50 || bytes[p + 1] !== 0x4B || bytes[p + 2] !== 0x01 || bytes[p + 3] !== 0x02) break;

        var compMethod = (bytes[p + 10] & 0xFF) | ((bytes[p + 11] & 0xFF) << 8);
        var compSize = ((bytes[p + 20] & 0xFF) | ((bytes[p + 21] & 0xFF) << 8) | ((bytes[p + 22] & 0xFF) << 16) | ((bytes[p + 23] & 0xFF) << 24)) >>> 0;
        var nameLen = (bytes[p + 28] & 0xFF) | ((bytes[p + 29] & 0xFF) << 8);
        var extraLen = (bytes[p + 30] & 0xFF) | ((bytes[p + 31] & 0xFF) << 8);
        var commentLen = (bytes[p + 32] & 0xFF) | ((bytes[p + 33] & 0xFF) << 8);
        var localOff = ((bytes[p + 42] & 0xFF) | ((bytes[p + 43] & 0xFF) << 8) | ((bytes[p + 44] & 0xFF) << 16) | ((bytes[p + 45] & 0xFF) << 24)) >>> 0;
        var nameBytes = bytes.slice(p + 46, p + 46 + nameLen);
        var name = bytesToUtf8(nameBytes);
        p += 46 + nameLen + extraLen + commentLen;

        if (compMethod !== 0) {
            console.log("[stjorna-backup] skipping compressed ZIP entry: " + name);
            continue;
        }
        if (localOff + 30 <= bytes.length) {
            var lfhNameLen = (bytes[localOff + 26] & 0xFF) | ((bytes[localOff + 27] & 0xFF) << 8);
            var lfhExtraLen = (bytes[localOff + 28] & 0xFF) | ((bytes[localOff + 29] & 0xFF) << 8);
            var fileStart = localOff + 30 + lfhNameLen + lfhExtraLen;
            if (fileStart + compSize <= bytes.length) {
                files[name] = bytes.slice(fileStart, fileStart + compSize);
            }
        }
    }

    if (!files["manifest.json"]) throw new Error("ZIP missing manifest.json");
    var manifest = JSON.parse(bytesToUtf8(files["manifest.json"]));
    return { manifest: manifest, files: files };
}

function importCategories(txApp, tenantId, cats, catMap, stats) {
    var catRecords = {};
    for (var i = 0; i < cats.length; i++) {
        var cat = cats[i];
        var slug = cat.slug || slugify(cat.name || "");
        if (!slug) slug = "category-" + i;

        var existing = null;
        try {
            existing = txApp.findFirstRecordByFilter("categories", "tenant={:t} && slug={:s}", { t: tenantId, s: slug });
        } catch (ex) {}

        var rec;
        if (existing) {
            rec = existing;
            stats.updated.categories++;
        } else {
            rec = new Record(txApp.findCollectionByNameOrId("categories"));
            rec.set("tenant", tenantId);
            stats.created.categories++;
        }
        rec.set("name", cat.name || "Untitled");
        rec.set("slug", slug);
        rec.set("description", cat.description || "");
        rec.set("active", cat.active !== false);
        rec.set("sort_order", typeof cat.sort_order === "number" ? cat.sort_order : 0);
        txApp.save(rec);
        catMap[cat.id] = rec.id;
        catRecords[cat.id] = rec;
    }
    return catRecords;
}

function importMedia(txApp, tenantId, medias, files, mediaMap, stats) {
    for (var i = 0; i < medias.length; i++) {
        var media = medias[i];
        var storedName = "";
        try {
            storedName = String(media.file || "");
        } catch (ex) {}
        var displayName = media.filename || storedName;
        if (!displayName && storedName) displayName = storedName;

        var fileBytes = null;
        if (storedName) {
            fileBytes = files["media/" + media.id + "/" + storedName];
        }
        if (!fileBytes && displayName && displayName !== storedName) {
            fileBytes = files["media/" + media.id + "/" + displayName];
        }

        var existing = null;
        try {
            existing = txApp.findFirstRecordByFilter("media", "tenant={:t} && filename={:f}", { t: tenantId, f: displayName });
        } catch (ex) {}

        var rec;
        if (existing) {
            rec = existing;
            stats.updated.media++;
        } else {
            rec = new Record(txApp.findCollectionByNameOrId("media"));
            rec.set("tenant", tenantId);
            stats.created.media++;
        }
        rec.set("filename", displayName);
        rec.set("original_name", media.original_name || displayName);
        rec.set("mime_type", media.mime_type || "application/octet-stream");
        var mediaSize = typeof media.size === "number" ? media.size : 0;
        if ((!mediaSize || mediaSize <= 0) && fileBytes && fileBytes.length) mediaSize = fileBytes.length;
        rec.set("size", mediaSize);
        rec.set("width", typeof media.width === "number" ? media.width : 0);
        rec.set("height", typeof media.height === "number" ? media.height : 0);
        if (fileBytes && fileBytes.length) {
            var uploadName = storedName || displayName || "file.bin";
            rec.set("file", $filesystem.fileFromBytes(fileBytes, uploadName));
        }
        txApp.save(rec);
        mediaMap[media.id] = rec.id;
    }
}

function importProducts(txApp, tenantId, prods, catMap, mediaMap, stats) {
    for (var i = 0; i < prods.length; i++) {
        var prod = prods[i];
        var slug = prod.slug || slugify(prod.name || "");
        if (!slug) slug = "product-" + i;

        var existing = null;
        try {
            existing = txApp.findFirstRecordByFilter("products", "tenant={:t} && slug={:s}", { t: tenantId, s: slug });
        } catch (ex) {}

        var rec;
        if (existing) {
            rec = existing;
            stats.updated.products++;
        } else {
            rec = new Record(txApp.findCollectionByNameOrId("products"));
            rec.set("tenant", tenantId);
            stats.created.products++;
        }
        rec.set("name", prod.name || "Untitled");
        rec.set("slug", slug);
        rec.set("price", typeof prod.price === "number" ? prod.price : 0);
        rec.set("description", prod.description || "");
        rec.set("category", catMap[prod.category] || "");
        rec.set("active", prod.active !== false);
        rec.set("sort_order", typeof prod.sort_order === "number" ? prod.sort_order : 0);
        rec.set("custom_fields", jsonFieldValue(prod.custom_fields));

        if (prod.media) {
            var oldIds = Array.isArray(prod.media) ? prod.media : [prod.media];
            var newIds = [];
            for (var j = 0; j < oldIds.length; j++) {
                var mapped = mediaMap[oldIds[j]];
                if (mapped) newIds.push(mapped);
            }
            rec.set("media", newIds);
        }
        txApp.save(rec);
    }
}

function importV3(txApp, tenantId, manifest, files, stats) {
    var cats = (manifest.collections && manifest.collections.categories) || manifest.categories || [];
    var prods = (manifest.collections && manifest.collections.products) || manifest.products || [];
    var medias = (manifest.collections && manifest.collections.media) || manifest.media || [];

    var catMap = {};
    var mediaMap = {};

    var catRecords = importCategories(txApp, tenantId, cats, catMap, stats);
    importMedia(txApp, tenantId, medias, files, mediaMap, stats);

    // Remap category media relations now that media IDs are known.
    for (var i = 0; i < cats.length; i++) {
        var cat = cats[i];
        if (cat.media && mediaMap[cat.media]) {
            var rec = catRecords[cat.id];
            if (rec) {
                rec.set("media", mediaMap[cat.media]);
                txApp.save(rec);
            }
        }
    }

    importProducts(txApp, tenantId, prods, catMap, mediaMap, stats);
}

function importV1(txApp, tenantId, manifest, files, stats) {
    var cats = manifest.categories || [];
    var prods = manifest.products || [];
    var catMap = {};

    for (var i = 0; i < cats.length; i++) {
        var cat = cats[i];
        var slug = slugify(cat.name || "");
        if (!slug) slug = "category-" + i;

        var existing = null;
        try {
            existing = txApp.findFirstRecordByFilter("categories", "tenant={:t} && slug={:s}", { t: tenantId, s: slug });
        } catch (ex) {}

        var rec;
        if (existing) {
            rec = existing;
            stats.updated.categories++;
        } else {
            rec = new Record(txApp.findCollectionByNameOrId("categories"));
            rec.set("tenant", tenantId);
            stats.created.categories++;
        }
        rec.set("name", cat.name || "Untitled");
        rec.set("slug", slug);
        rec.set("description", cat.description || "");
        rec.set("active", cat.active !== false);
        rec.set("sort_order", 0);
        txApp.save(rec);
        catMap[cat._id] = rec.id;
    }

    for (var i = 0; i < prods.length; i++) {
        var prod = prods[i];
        var slug = slugify(prod.name || "");
        if (!slug) slug = "product-" + i;

        var existing = null;
        try {
            existing = txApp.findFirstRecordByFilter("products", "tenant={:t} && slug={:s}", { t: tenantId, s: slug });
        } catch (ex) {}

        var rec;
        if (existing) {
            rec = existing;
            stats.updated.products++;
        } else {
            rec = new Record(txApp.findCollectionByNameOrId("products"));
            rec.set("tenant", tenantId);
            stats.created.products++;
        }
        rec.set("name", prod.name || "Untitled");
        rec.set("slug", slug);
        rec.set("price", typeof prod.price === "number" ? prod.price : 0);
        rec.set("description", prod.description || "");
        rec.set("category", catMap[prod.category] || "");
        rec.set("active", prod.active !== false);
        rec.set("sort_order", 0);
        rec.set("custom_fields", jsonFieldValue({}));
        txApp.save(rec);
    }

    if (cats.some(function (c) { return !!c.image; })) {
        stats.warnings.push("v1 category image references ignored (v1 JSON contains filenames only, not the file bytes — re-upload via the admin UI to attach a media record)");
    }
}

function exportHandler(e) {
    try {
        if (!e.auth) {
            replyError(e, 401, "unauthorized");
            return;
        }

        var tenantId = String(e.request.pathValue("tenant") || "").trim();
        if (!tenantId) {
            replyError(e, 400, "tenant required");
            return;
        }

        try {
            $app.findRecordById("tenants", tenantId);
        } catch (ex) {
            replyError(e, 404, "tenant not found");
            return;
        }

        var userId = getUserId(e);
        if (!isSuperuser(e) && !isTenantMember(userId, tenantId)) {
            replyError(e, 403, "tenant membership required");
            return;
        }

        var tenant = $app.findRecordById("tenants", tenantId);
        var tenantPlain = recordToPlain(tenant, ["users"]);
        var manifest = {
            version: EXPORT_VERSION,
            kind: "stjorna-tenant-backup",
            exported_at: new Date().toISOString(),
            tenant: tenantPlain,
            collections: {}
        };

        var categories = $app.findRecordsByFilter("categories", "tenant={:t}", "sort_order", 0, 0, { t: tenantId });
        var products = $app.findRecordsByFilter("products", "tenant={:t}", "sort_order", 0, 0, { t: tenantId });
        var media = $app.findRecordsByFilter("media", "tenant={:t}", "", 0, 0, { t: tenantId });

        var catList = [];
        var prodList = [];
        var mediaList = [];
        var mediaEntries = [];

        for (var i = 0; i < categories.length; i++) {
            catList.push(recordToPlain(categories[i]));
        }
        for (var i = 0; i < products.length; i++) {
            prodList.push(recordToPlain(products[i]));
        }
        for (var i = 0; i < media.length; i++) {
            var m = media[i];
            var plain = recordToPlain(m);
            mediaList.push(plain);
            var filename = "";
            try {
                filename = String(m.get("file") || "");
            } catch (ex) {}
            if (filename) {
                var fileKey = m.baseFilesPath() + "/" + filename;
                mediaEntries.push({ oldId: m.id, filename: filename, fileKey: fileKey });
            }
        }

        manifest.collections.categories = catList;
        manifest.collections.products = prodList;
        manifest.collections.media = mediaList;

        var zipBytes = buildZipBytes(manifest, mediaEntries);
        e.response.header().set("Content-Type", "application/zip");
        e.response.header().set("Content-Disposition", "attachment; filename=\"stjorna-export-" + tenantId + "-" + Date.now() + ".zip\"");
        e.blob(200, "application/zip", zipBytes);
    } catch (ex) {
        console.log("[stjorna-backup] export error: " + (ex && ex.message ? ex.message : ex));
        replyError(e, 500, "export failed: " + (ex && ex.message ? ex.message : String(ex)));
    }
}

function importHandler(e) {
    try {
        if (!e.auth) {
            replyError(e, 401, "unauthorized");
            return;
        }

        var tenantId = String(e.request.pathValue("tenant") || "").trim();
        if (!tenantId) {
            replyError(e, 400, "tenant required");
            return;
        }

        try {
            $app.findRecordById("tenants", tenantId);
        } catch (ex) {
            replyError(e, 404, "tenant not found");
            return;
        }

        var userId = getUserId(e);
        if (!isSuperuser(e) && !isTenantAdmin(userId, tenantId)) {
            replyError(e, 403, "tenant admin required");
            return;
        }

        var contentType = "";
        try { contentType = String(e.request.header.get("Content-Type") || ""); } catch (ex) {}

        var source = String(e.request.url.query().get("source") || "").trim() || "v3";
        if (source !== "v1" && source !== "v3") {
            replyError(e, 400, "source must be v1 or v3");
            return;
        }

        // Read the raw request body. The endpoint accepts either
        // application/zip or application/json directly. We avoid multipart
        // because Node's native fetch + PB's multipart parser are flaky
        // together in some CI environments (multipart: NextPart: EOF).
        var fileBytes = toBytes(e.request.body);
        if (!fileBytes || !fileBytes.length) {
            replyError(e, 400, "empty request body");
            return;
        }
        if (fileBytes.length > MAX_FILE_BYTES) {
            replyError(e, 413, "backup file exceeds 500 MB limit");
            return;
        }

        var manifest = null;
        var files = {};
        if (fileBytes.length >= 4 && fileBytes[0] === 0x50 && fileBytes[1] === 0x4B && fileBytes[2] === 0x03 && fileBytes[3] === 0x04) {
            var parsed = parseZipBytes(fileBytes);
            manifest = parsed.manifest;
            files = parsed.files;
        } else {
            try {
                manifest = JSON.parse(bytesToUtf8(fileBytes));
            } catch (ex) {
                replyError(e, 400, "file is not a valid ZIP or JSON backup");
                return;
            }
        }

        var stats = { created: { categories: 0, products: 0, media: 0 }, updated: { categories: 0, products: 0, media: 0 }, warnings: [] };
        $app.runInTransaction(function (txApp) {
            if (source === "v1") {
                importV1(txApp, tenantId, manifest, files, stats);
            } else {
                importV3(txApp, tenantId, manifest, files, stats);
            }
        });

        replyJson(e, 200, { success: true, stats: stats });
    } catch (ex) {
        console.log("[stjorna-backup] import error: " + (ex && ex.message ? ex.message : ex));
        var stack = "";
        try { stack = String(ex && ex.stack ? ex.stack : ""); } catch (_) {}
        replyError(e, 500, "import failed: " + (ex && ex.message ? ex.message : String(ex)) + (stack ? " | " + stack.substring(0, 1000) : ""));
    }
}

module.exports = {
    exportHandler: exportHandler,
    importHandler: importHandler
};
