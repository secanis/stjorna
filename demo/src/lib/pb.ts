import PocketBase from 'pocketbase';
import { createSignal } from 'solid-js';
import { startApiLog } from '~/lib/apiLog';

const URL_KEY = 'demo_pb_url';
const TOKEN_KEY = 'demo_pb_token';
const THEME_KEY = 'demo_theme';

const initialUrl = (localStorage.getItem(URL_KEY) || '').replace(/\/+$/, '');

export const [pbUrl, setPbUrl] = createSignal<string>(initialUrl);

export function hasSavedUrl() {
  return () => !!pbUrl();
}

export let pb: PocketBase = initialUrl ? new PocketBase(initialUrl) : new PocketBase('/');
pb.autoCancellation(false);

// Apply a saved token (if any) so the SDK sends Authorization: Bearer on every request.
(function applyToken() {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) {
    try {
      pb.authStore.save(t, null);
    } catch {
      // ignore corrupt token
    }
  }
})();

// One-time fetch monkey-patch for the live API log.
startApiLog();

export function recreatePb(url: string) {
  const clean = url.replace(/\/+$/, '');
  localStorage.setItem(URL_KEY, clean);
  setPbUrl(clean);
  pb = new PocketBase(clean);
  pb.autoCancellation(false);
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) {
    try {
      pb.authStore.save(t, null);
    } catch {}
  }
  return pb;
}

export function saveToken(raw: string) {
  const t = raw.trim();
  if (!t) {
    localStorage.removeItem(TOKEN_KEY);
    pb.authStore.clear();
    return;
  }
  localStorage.setItem(TOKEN_KEY, t);
  try {
    pb.authStore.save(t, null);
  } catch {}
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  pb.authStore.clear();
}

export function getTokenRaw(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
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
