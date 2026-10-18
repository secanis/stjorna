import type { Tenant, TenantThemeConfig } from '~/types';

// PocketBase JSON fields arrive as parsed objects via the SDK; legacy
// records may still hold a raw JSON string. Anything else normalizes
// to an empty config.
export function parseThemeConfig(value: Tenant['theme_config']): TenantThemeConfig {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object' && !Array.isArray(value)) return value as TenantThemeConfig;
    return {};
}

export function asTrimmedString(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

// Builds the object to persist from the structured editor fields.
// Unknown keys from the loaded config are preserved; the three known
// keys are only written when non-empty so the JSON stays minimal.
export function buildThemeConfig(
    extra: TenantThemeConfig,
    fields: { logoMediaId: string; headerBgLight: string; headerBgDark: string },
): TenantThemeConfig {
    const out: TenantThemeConfig = { ...extra };
    delete out.logoMediaId;
    delete out.headerBgLight;
    delete out.headerBgDark;
    if (fields.logoMediaId.trim()) out.logoMediaId = fields.logoMediaId.trim();
    if (fields.headerBgLight.trim()) out.headerBgLight = fields.headerBgLight.trim();
    if (fields.headerBgDark.trim()) out.headerBgDark = fields.headerBgDark.trim();
    return out;
}
