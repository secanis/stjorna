import { createSignal } from 'solid-js';
import { pb } from '~/services/pocketbase';
import { parseThemeConfig, asTrimmedString } from '~/utils/themeConfig';
import type { TenantThemeConfig } from '~/types';

// Per-tenant theme, loaded for the currently selected tenant and applied
// by the layout Header (logo + header background). Falls back to the
// STJÓRNA defaults whenever a value is missing or a lookup fails.
//
// The logo is exposed as { id, file } rather than a finished URL so the
// Header can call getMediaFileUrl() inside JSX — that keeps the <img>
// reactive to the file-token refresh (T-08 protected media files).

interface LogoMedia {
    id: string;
    file: string;
}

const [config, setConfig] = createSignal<TenantThemeConfig>({});
const [logoMedia, setLogoMedia] = createSignal<LogoMedia | null>(null);
let loadedFor: string | null = null;

function clear() {
    loadedFor = null;
    setConfig({});
    setLogoMedia(null);
}

async function load(tenantId: string | null, force = false): Promise<void> {
    if (!tenantId) {
        clear();
        return;
    }
    if (!force && loadedFor === tenantId) return;
    loadedFor = tenantId;

    try {
        const tenant = await pb.collection('tenants').getOne(tenantId);
        // Guard against a tenant switch racing an in-flight load.
        if (loadedFor !== tenantId) return;
        const cfg = parseThemeConfig(tenant.theme_config);
        setConfig(cfg);

        const mediaId = asTrimmedString(cfg.logoMediaId);
        if (!mediaId) {
            setLogoMedia(null);
            return;
        }
        try {
            const m = await pb.collection('media').getOne(mediaId);
            if (loadedFor !== tenantId) return;
            const file = String(m.get('file') || '');
            setLogoMedia(file ? { id: m.id, file } : null);
        } catch {
            // Unknown/deleted media ID or no read access — fall back to text.
            setLogoMedia(null);
        }
    } catch {
        if (loadedFor === tenantId) {
            setConfig({});
            setLogoMedia(null);
        }
    }
}

export const tenantTheme = {
    get logoMedia() {
        return logoMedia();
    },
    // CSS color override for the header background, '' = theme default.
    headerBg(mode: 'light' | 'dark'): string {
        return asTrimmedString(mode === 'dark' ? config().headerBgDark : config().headerBgLight);
    },
    load,
    // Re-read after the tenant's theme_config was edited.
    refresh(tenantId: string | null): Promise<void> {
        return load(tenantId, true);
    },
    clear,
};
