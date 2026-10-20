// Runtime configuration.
//
// The container writes /config.js at start (docker/40-stjorna-config.sh)
// from the PB_URL env var, which sets `window.__STJORNA_CONFIG__` before the
// app bundle runs. That lets one image be pointed at a different PocketBase
// without a rebuild. Precedence:
//   1. window.__STJORNA_CONFIG__.pbUrl  (runtime, from PB_URL)
//   2. VITE_PB_URL                      (build time)
//   3. ''                               (same origin; nginx/vite proxy /api)

export interface StjornaRuntimeConfig {
  pbUrl?: string;
}

declare global {
  interface Window {
    __STJORNA_CONFIG__?: StjornaRuntimeConfig;
  }
}

function clean(url: string | undefined | null): string {
  return (url ?? '').trim().replace(/\/+$/, '');
}

// Configured PocketBase origin without trailing slash, or '' when the
// frontend and PocketBase share an origin. Read at call time (cheap) so
// tests can stub the environment.
export function getConfiguredPbUrl(): string {
  const runtime = typeof window !== 'undefined' ? clean(window.__STJORNA_CONFIG__?.pbUrl) : '';
  if (runtime) return runtime;
  return clean(import.meta.env.VITE_PB_URL as string | undefined);
}
