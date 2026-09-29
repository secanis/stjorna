import PocketBase from 'pocketbase';
import { createSignal } from 'solid-js';
import { startApiLog } from '~/lib/apiLog';

const URL_KEY = 'demo_pb_url';
const TOKEN_KEY = 'demo_pb_token';
const API_KEY_KEY = 'demo_pb_api_key';
const THEME_KEY = 'demo_theme';

// T-05.1: credentials live in sessionStorage only. sessionStorage is
// cleared when the tab is closed and is not shared with other tabs, so
// neither the raw API key nor the service-user JWT outlives the demo
// session. The URL and theme are harmless and stay in localStorage.
// (`sessionStorage` can throw in some privacy modes; every access is
// guarded so the demo still works without persistence.)
function sessionGet(key: string): string {
  try {
    return sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function sessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function sessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

// One-off migration: older demo builds persisted the key + JWT in
// localStorage. Drop them so a stale credential does not linger.
try {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(API_KEY_KEY);
} catch {}

const initialUrl = (localStorage.getItem(URL_KEY) || '').replace(/\/+$/, '');

export const [pbUrl, setPbUrl] = createSignal<string>(initialUrl);

export function hasSavedUrl() {
  return () => !!pbUrl();
}

export let pb: PocketBase = initialUrl ? new PocketBase(initialUrl) : new PocketBase('/');
pb.autoCancellation(false);

// NOTE: we deliberately do NOT auto-load TOKEN_KEY into authStore at
// module load time. A stale or invalid JWT would otherwise persist
// across page reloads and silently cause /api/collections/* requests
// to return 200 / items: []. The token is applied only when the user
// explicitly saves via saveToken() or when recreatePb() rebuilds the
// client after a URL change.

// One-time fetch monkey-patch for the live API log.
startApiLog();

export function recreatePb(url: string) {
  const clean = url.replace(/\/+$/, '');
  localStorage.setItem(URL_KEY, clean);
  setPbUrl(clean);
  pb = new PocketBase(clean);
  pb.autoCancellation(false);
  // Re-apply whatever's in sessionStorage — this is the one place where
  // we honor the saved token without going through the full
  // exchange/validation flow. The Settings page always overrides this
  // by calling saveToken() after recreatePb().
  const t = sessionGet(TOKEN_KEY);
  if (t) {
    try {
      pb.authStore.save(t, null);
    } catch {}
  }
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
  const apiKey = sessionGet(API_KEY_KEY);
  if (!apiKey) return;
  const current = sessionGet(TOKEN_KEY);
  const exp = current ? jwtExpiresAt(current) : 0;
  if (current && exp > Date.now() + 60_000) return;
  const jwt = await upgradeApiKeyToJwt(apiKey);
  sessionSet(TOKEN_KEY, jwt);
  pb.authStore.save(jwt, null);
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

  if (isApiKey(t)) {
    setAuthStatus('Exchanging API key for STJÓRN A user JWT…');
    try {
      const jwt = await upgradeApiKeyToJwt(t);
      sessionSet(API_KEY_KEY, t);
      sessionSet(TOKEN_KEY, jwt);
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
      sessionRemove(TOKEN_KEY);
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
  sessionSet(TOKEN_KEY, t);
  sessionRemove(API_KEY_KEY);
  try {
    pb.authStore.save(t, null);
  } catch {}
}

export function clearToken() {
  sessionRemove(TOKEN_KEY);
  sessionRemove(API_KEY_KEY);
  pb.authStore.clear();
}

export function getTokenRaw(): string {
  return sessionGet(TOKEN_KEY);
}

// Useful for the demo "API key" textarea to prefill the original key,
// not the derived JWT.
export function getApiKeyRaw(): string {
  return sessionGet(API_KEY_KEY);
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

// File URL — uses the SDK so the token is appended automatically when present.
export function fileUrl(record: { id: string }, filename: string, opts?: { thumb?: string }): string {
  if (!record?.id || !filename) return '';
  try {
    return pb.files.getUrl(record as any, filename, opts as any);
  } catch {
    return '';
  }
}
