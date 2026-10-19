// STJÓRNA v3 — pure OIDC group-mapping helpers.
//
// Extracted from oidc_groups.pb.js so the same parsing logic is used by the
// hook (via require()) and unit-tested directly (pocketbase/tests/
// oidc-groups.unit.test.ts). No PocketBase runtime dependencies — pure
// functions only, so it can be loaded in Node/Vitest as well as PB's JSVM.

// Normalizes an IdP group claim (string, array, or nested object) into an
// array of trimmed, non-empty strings.
function normalizeToStringArray(value) {
    if (value === undefined || value === null) return [];
    if (typeof value === "string") {
        return value.split(",").map(function (s) { return s.trim(); }).filter(function (s) { return s; });
    }
    if (Array.isArray(value)) {
        return value.map(function (v) { return String(v || "").trim(); }).filter(function (s) { return s; });
    }
    // If the provider sends an object (e.g. { teams: [...] }), try common nested keys.
    if (typeof value === "object") {
        var nestedKeys = ["groups", "group", "roles", "role", "teams", "members", "permissions"];
        for (var n = 0; n < nestedKeys.length; n++) {
            if (value[nestedKeys[n]] !== undefined) {
                return normalizeToStringArray(value[nestedKeys[n]]);
            }
        }
    }
    return [];
}

// Parses a (prefix-stripped) group name into { tenantSlug, roleName }, or
// null when it is empty / has no separator before the role suffix. The
// suffix maps through roleMapping, falling back to defaultRole.
function parseGroup(group, separator, roleMapping, defaultRole) {
    var g = String(group || "").trim();
    if (!g) return null;

    var sepIdx = g.lastIndexOf(separator);
    if (sepIdx < 0 || sepIdx === g.length - 1) return null;

    var tenantSlug = g.substring(0, sepIdx).toLowerCase();
    var suffix = g.substring(sepIdx).toLowerCase();
    var roleName = roleMapping[suffix] || defaultRole;
    return { tenantSlug: tenantSlug, roleName: roleName };
}

module.exports = {
    normalizeToStringArray: normalizeToStringArray,
    parseGroup: parseGroup,
};
