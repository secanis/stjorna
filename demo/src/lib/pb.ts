import PocketBase, { BaseAuthStore } from 'pocketbase';
import { createSignal } from 'solid-js';
import { startApiLog } from '~/lib/apiLog';

const URL_KEY = 'demo_pb_url';
const TOKEN_KEY = 'demo_pb_token';
const API_KEY_KEY = 'demo_pb_api_key';
const THEME_KEY = 'demo_theme';

// T-05.1: credentials (the API key and the short-lived service-user JWT) are
// kept in memory only and never written to localStorage/sessionStorage, so no
// secret outlives the page. The URL and theme are harmless and stay in
// localStorage.
let inMemoryToken = '';
let inMemoryApiKey = '';

// One-off migration: older demo builds persisted the key + JWT in
// localStorage/sessionStorage. Drop them so a stale credential does not linger.
try {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(API_KEY_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(API_KEY_KEY);
} catch {}

const initialUrl = (localStorage.getItem(URL_KEY) || '').replace(/\/+$/, '');

export const [pbUrl, setPbUrl] = createSignal<string>(initialUrl);

export function hasSavedUrl() {
  return () => !!pbUrl();
}

export let pb: PocketBase = initialUrl
  ? new PocketBase(initialUrl, new BaseAuthStore())
  : new PocketBase('/', new BaseAuthStore());
pb.autoCancellation(false);
attachAuthSync(pb);

// SDK >=0.29 auto-clears the auth store on any 401 response (expired or
// revoked token). The demo keeps its own in-memory copy of the token, so
// mirror the clear into it — otherwise the UI would keep claiming a token
// exists while requests silently go out unauthenticated. A saved API key is
// intentionally kept: ensureFreshToken() re-exchanges it on the next request.
function attachAuthSync(client: PocketBase) {
  client.authStore.onChange((token) => {
    if (token) return;
    inMemoryToken = '';
  });
}

// NOTE: the JWT lives only in memory (BaseAuthStore + inMemoryToken), so it
// is never auto-loaded at module load. The token is applied only when the
// user explicitly saves via saveToken() or when recreatePb() rebuilds the
// client after a URL change.

// One-time fetch monkey-patch for the live API log.
startApiLog();

export function recreatePb(url: string) {
  const clean = url.replace(/\/+$/, '');
  localStorage.setItem(URL_KEY, clean);
  setPbUrl(clean);
  pb = new PocketBase(clean, new BaseAuthStore());
  pb.autoCancellation(false);
  attachAuthSync(pb);
  // Re-apply the in-memory token — this is the one place where
  // we honor the saved token without going through the full
  // exchange/validation flow. The Settings page always overrides this
  // by calling saveToken() after recreatePb().
  const t = inMemoryToken;
  if (t) {
    try {
      pb.authStore.save(t, null);
    } catch {}
  }
  resetFileToken();
  return pb;
}

export function isApiKey(raw: string): boolean {
  return /^stjorna_[A-Za-z0-9_]{6,64}\.[A-Za-z0-9]{16,128}$/.test(raw.trim());
}

// Exchange an STJÓRN A API key for service-user credentials. STJÓRN A
// collection rules reference @request.auth, so PB only injects an auth
// record for a JWT it can validate — an STJÓRN A API key alone gets
// 200 /items:[] from /api/collections/* because PB sees an empty
// @request.auth. T-05: the exchange route mints a short-lived (1 h,
// non-refreshable) JWT server-side and hands back the token string.
// The service-user password never leaves the server.
async function exchangeApiKey(apiKey: string): Promise<{ token: string; tenant: string; email: string }> {
  const url = (pb.baseUrl || '').replace(/\/+$/, '') + '/api/stjorna/api-keys/exchange';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey.trim() },
    body: JSON.stringify({ key: apiKey.trim() }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || body?.message || '';
    } catch {}
    throw new Error(`API key exchange failed (${res.status}${detail ? ': ' + detail : ''})`);
  }
  const body = await res.json();
  if (!body?.token) {
    throw new Error('API key exchange returned no token');
  }
  return {
    token: String(body.token),
    tenant: String(body.tenant || ''),
    email: String(body?.record?.email || ''),
  };
}

// Swap a saved API key for a real STJÓRN A user JWT. The JWT is what's
// stored as the "token" for subsequent requests; the original API key
// is kept for the session so we can re-exchange when the JWT expires.
async function upgradeApiKeyToJwt(apiKey: string): Promise<string> {
  const { token } = await exchangeApiKey(apiKey);
  return token;
}

// Decode the `exp` claim (seconds) of a JWT without verifying it — the
// server verifies; we only need to know when to re-exchange.
function jwtExpiresAt(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

// If the session holds an API key and the JWT is missing or about to
// expire, exchange again. Safe to call before any request.
export async function ensureFreshToken(): Promise<void> {
  const apiKey = inMemoryApiKey;
  if (!apiKey) return;
  const current = inMemoryToken;
  const exp = current ? jwtExpiresAt(current) : 0;
  if (current && exp > Date.now() + 60_000) return;
  const jwt = await upgradeApiKeyToJwt(apiKey);
  inMemoryToken = jwt;
  pb.authStore.save(jwt, null);
  resetFileToken();
}

// Update the on-screen status banner. The demo's App.tsx subscribes to
// this signal and renders it in the header.
export const [authStatus, setAuthStatus] = createSignal<string>('');

export async function saveToken(raw: string): Promise<void> {
  const t = raw.trim();
  if (!t) {
    clearToken();
    return;
  }
  resetFileToken();

  if (isApiKey(t)) {
    setAuthStatus('Exchanging API key for STJÓRN A user JWT…');
    try {
      const jwt = await upgradeApiKeyToJwt(t);
      inMemoryApiKey = t;
      inMemoryToken = jwt;
      pb.authStore.save(jwt, null);
      setAuthStatus('API key exchanged — using service user JWT.');
      // auto-clear the banner after a beat
      setTimeout(() => setAuthStatus(''), 3000);
    } catch (e: any) {
      const msg = String(e?.message || e);
      // Wipe the authStore so we don't leave a stale (and now-invalid)
      // JWT that would still send 200/empty on subsequent requests.
      // The caller will see the error in the form.
      pb.authStore.clear();
      inMemoryToken = '';
      // Note: keep API_KEY_KEY around so the user can see their
      // original key in the textarea. They can clear it via the
      // "Clear saved token" button.
      setAuthStatus('Exchange failed: ' + msg);
      throw e;
    }
    return;
  }

  // Regular user JWT or PB admin token: store as-is and clear any
  // stale api-key marker (we no longer need to refresh).
  inMemoryToken = t;
  inMemoryApiKey = '';
  try {
    pb.authStore.save(t, null);
  } catch {}
}

export function clearToken() {
  inMemoryToken = '';
  inMemoryApiKey = '';
  pb.authStore.clear();
  resetFileToken();
}

export function getTokenRaw(): string {
  return inMemoryToken;
}

// Useful for the demo "API key" textarea to prefill the original key,
// not the derived JWT.
export function getApiKeyRaw(): string {
  return inMemoryApiKey;
}

export function getTheme(): 'light' | 'dark' {
  return (localStorage.getItem(THEME_KEY) as 'light' | 'dark') || 'light';
}

export function setTheme(t: 'light' | 'dark') {
  localStorage.setItem(THEME_KEY, t);
  document.documentElement.classList.toggle('dark', t === 'dark');
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

// Apply theme on module load.
setTheme(getTheme());

// --- File token for protected media (T-08) ---
// Media files are protected on the schema: serving one needs a SHORT-LIVED
// file token (pb.files.getToken()), appended as ?token= — never the auth JWT.
// The SDK's pb.files.getUrl() does NOT append a token, so we cache one here
// (module-scoped) and refresh ~5 min before PB's ~1 h expiry.
let fileToken = '';
let fileTokenExpiresAt = 0;
let fileTokenInFlight: Promise<void> | null = null;

function resetFileToken(): void {
  fileToken = '';
  fileTokenExpiresAt = 0;
}

// Fetch (or reuse) the file token. No-op when not authenticated. Await it
// before rendering media so the URL builder has a token ready.
export async function ensureFileToken(): Promise<void> {
  if (!pb.authStore.token) return;
  if (fileToken && Date.now() < fileTokenExpiresAt) return;
  if (fileTokenInFlight) return fileTokenInFlight;
  fileTokenInFlight = (async () => {
    try {
      const t = await pb.files.getToken();
      fileToken = t || '';
      fileTokenExpiresAt = Date.now() + 55 * 60 * 1000;
    } catch {
      resetFileToken();
    } finally {
      fileTokenInFlight = null;
    }
  })();
  return fileTokenInFlight;
}

// File URL — appends ?thumb= and the cached file ?token= when present.
export function fileUrl(record: { id: string }, filename: string, opts?: { thumb?: string }): string {
  if (!record?.id || !filename) return '';
  try {
    const query: Record<string, string> = {};
    if (opts?.thumb) query.thumb = opts.thumb;
    if (fileToken) query.token = fileToken;
    return pb.files.getURL(record as any, filename, query as any);
  } catch {
    return '';
  }
}
