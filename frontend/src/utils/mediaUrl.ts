import { createSignal } from 'solid-js';
import { pb } from '~/services/pocketbase';

interface MediaUrlOptions {
    thumb?: string;
}

// T-08: media files are now protected on the schema (migration
// 1770001400_protect_media_files.js). A protected file requires a
// SHORT-LIVED file token (issued via pb.files.getToken()) on every
// request. The previous implementation appended the AUTH JWT (a
// long-lived superuser or user token) as ?token=..., which is the
// wrong token type and leaked into nginx logs, browser history,
// referers and copied links.
//
// Cache: module-scoped. PB's file token is valid for ~1 hour; we
// refresh ~5 minutes before expiry so in-flight <img> requests
// never carry an expired token. The signal makes the URL
// reactive — SolidJS components that render <img src={getMediaFileUrl(...)} />
// re-render when the token updates, replacing the placeholder with
// a real authenticated URL.
//
// Reading the signal via fileToken() inside the URL builder means
// every JSX site that calls getMediaFileUrl gets tracked by SolidJS
// and re-runs when the token changes. Outside of a reactive scope
// (tests, SSR) the signal accessor is just a function returning the
// current value.

const [fileToken, setFileToken] = createSignal<string>('');
let cachedAt = 0;
let inFlight: Promise<void> | null = null;

// PB default file-token TTL is ~1h. Refresh every 55 min.
const TOKEN_TTL_MS = 55 * 60 * 1000;

async function refreshFileToken(): Promise<void> {
    const now = Date.now();
    if (cachedAt && now - cachedAt < TOKEN_TTL_MS) return;
    if (inFlight) return inFlight;
    inFlight = (async () => {
        try {
            // pb.files.getToken() requires an authenticated auth store.
            // If nobody is logged in, pb.files.getToken() throws — and
            // the URL builder falls back to a no-token path so the
            // caller's <img> just 401s cleanly instead of crashing.
            const t = await pb.files.getToken();
            setFileToken(t || '');
            cachedAt = Date.now();
        } catch (_e) {
            // Keep the previous token (or empty) — the next call will
            // retry once auth state changes.
            cachedAt = 0;
        } finally {
            inFlight = null;
        }
    })();
    return inFlight;
}

// Exposed for tests so they can inject a known token without
// monkey-patching pb.files.getToken() across all imports.
export function _setCachedFileTokenForTest(token: string): void {
    setFileToken(token);
    cachedAt = Date.now();
}

export function _clearCachedFileTokenForTest(): void {
    setFileToken('');
    cachedAt = 0;
}

function ensureFileToken(): string {
    const t = fileToken();
    if (!t) {
        // Fire-and-forget refresh. URL builders below return a
        // no-token URL on the first render; the signal update from
        // refreshFileToken() triggers SolidJS to re-run any reactive
        // expression that called getMediaFileUrl, and the <img> src
        // picks up the real token on the next frame.
        void refreshFileToken();
    } else if (!cachedAt || Date.now() - cachedAt > TOKEN_TTL_MS) {
        void refreshFileToken();
    }
    return t;
}

// Indirection over `window.location.protocol` so tests can mock it.
function pageProtocol(): string {
    if (typeof window === 'undefined') return 'http:';
    return window.location.protocol;
}

// Pure URL builder — exposed for tests. Takes the configured origin and the
// current page protocol explicitly so the test can drive the protocol
// branch without fighting jsdom's read-only Location.
export function buildAbsolutePath(origin: string, path: string, pageProto: string): string {
    if (!origin) return path;
    if (pageProto === 'https:' && origin.startsWith('http://')) {
        return `${origin.replace(/^http:/, '')}${path}`;
    }
    return `${origin}${path}`;
}

// Returns the configured PB origin (without trailing slash) if the FE was
// built with an explicit VITE_PB_URL — meaning the FE and PB live on
// different origins and the FE must hit PB directly. Returns '' otherwise
// (empty VITE_PB_URL = FE and PB share an origin, vite proxy handles it).
function pbOrigin(): string {
    return (import.meta.env.VITE_PB_URL as string | undefined)?.replace(/\/+$/, '') || '';
}

function buildFileUrl(recordId: string, filename: string, options: MediaUrlOptions, includeToken: boolean): string {
    if (!recordId || !filename) return '';
    const params = new URLSearchParams();
    if (includeToken) {
        const t = ensureFileToken();
        if (t) params.set('token', t);
    }
    if (options.thumb) params.set('thumb', options.thumb);
    const qs = params.toString();
    const path = `/api/files/media/${recordId}/${filename}${qs ? '?' + qs : ''}`;
    return buildAbsolutePath(pbOrigin(), path, pageProtocol());
}

// Reactive: re-runs when the cached file-token signal updates.
// Call sites in JSX (`src={getMediaFileUrl(...)}`) re-render when
// the token arrives.
export function getMediaFileUrl(recordId: string, filename: string, options: MediaUrlOptions = {}): string {
    return buildFileUrl(recordId, filename, options, true);
}

// Same as getMediaFileUrl but without the file token. With
// `protected: true` on the schema, this URL will 401/404 — only
// kept for compatibility with "share" buttons in the admin UI that
// pre-date T-08; those buttons will be redesigned in a follow-up
// (a token URL is not a "share" URL — it expires).
export function getMediaFileUrlAbsolute(recordId: string, filename: string, options: MediaUrlOptions = {}): string {
    return buildFileUrl(recordId, filename, options, false);
}
