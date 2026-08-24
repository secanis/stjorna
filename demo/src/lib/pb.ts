import PocketBase from 'pocketbase';
import { createSignal } from 'solid-js';
import { startApiLog } from '~/lib/apiLog';

const URL_KEY = 'demo_pb_url';
const TOKEN_KEY = 'demo_pb_token';
const API_KEY_KEY = 'demo_pb_api_key';
const THEME_KEY = 'demo_theme';

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
  // Re-apply whatever's in localStorage — this is the one place where
  // we honor the saved token without going through the full
  // exchange/validation flow. The Settings page always overrides this
  // by calling saveToken() after recreatePb().
  const t = localStorage.getItem(TOKEN_KEY);
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
// @request.auth. The exchange route hands back per-tenant service-user
// credentials (email + password) that the caller auths as to get a
// real STJÓRN A user JWT.
async function exchangeApiKey(apiKey: string): Promise<{ email: string; password: string; tenant: string }> {
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
  if (!body?.email || !body?.password) {
    throw new Error('API key exchange returned no credentials');
  }
  return { email: body.email, password: body.password, tenant: body.tenant || '' };
}

// Swap a saved API key for a real STJÓRN A user JWT. The JWT is what's
// stored as the "token" for subsequent requests; the original API key
// is kept around in demo_pb_api_key so we can refresh when the JWT
// expires.
async function upgradeApiKeyToJwt(apiKey: string): Promise<string> {
  const { email, password } = await exchangeApiKey(apiKey);
  // Use a one-shot PB client so we don't pollute the main pb.authStore
  // until we know the auth actually succeeded.
  const probe = new PocketBase(pb.baseUrl || '/');
  const result = await probe.collection('users').authWithPassword(email, password);
  if (!result?.token) {
    throw new Error('authWithPassword returned no token');
  }
  return result.token;
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
      localStorage.setItem(API_KEY_KEY, t);
      localStorage.setItem(TOKEN_KEY, jwt);
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
      localStorage.removeItem(TOKEN_KEY);
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
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.removeItem(API_KEY_KEY);
  try {
    pb.authStore.save(t, null);
  } catch {}
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(API_KEY_KEY);
  pb.authStore.clear();
}

export function getTokenRaw(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

// Useful for the demo "API key" textarea to prefill the original key,
// not the derived JWT.
export function getApiKeyRaw(): string {
  return localStorage.getItem(API_KEY_KEY) || '';
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