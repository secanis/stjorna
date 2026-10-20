import PocketBase from 'pocketbase';
import { getConfiguredPbUrl } from '~/services/config';

// Runtime config (/config.js) → VITE_PB_URL → same origin.
const ENV_PB_URL = getConfiguredPbUrl() || '/';

export function getPbUrl(): string {
  return ENV_PB_URL;
}

// Auth endpoints legitimately answer 401 (wrong password, MFA required),
// so they must not trigger the global "session expired" handling.
const AUTH_ENDPOINT_RE = /\/(auth-with-[a-z0-9]+|request-otp|auth-methods)(\?|$)/;

function configure(client: PocketBase): PocketBase {
  client.autoCancellation(false);
  client.afterSend = (response, data) => {
    if (response.status === 401 && client.authStore.token && !AUTH_ENDPOINT_RE.test(response.url)) {
      // Token expired or revoked server-side: drop it. authStore listens
      // to onChange and the route guard sends the user to /login.
      client.authStore.clear();
    }
    return data;
  };
  return client;
}

export const pb = configure(new PocketBase(ENV_PB_URL));

export function setCurrentTenant(tenantId: string | null) {
  if (tenantId === null) {
    localStorage.removeItem('stjorna_current_tenant');
  } else {
    localStorage.setItem('stjorna_current_tenant', tenantId);
  }
}

export function getCurrentTenant(): string | null {
  return localStorage.getItem('stjorna_current_tenant');
}

/**
 * Build a PocketBase sort expression from a table sort key/direction.
 * A secondary key keeps ordering stable across pages.
 */
export function toSortExpr(key: string, dir: 'asc' | 'desc', tiebreak?: string): string {
  const primary = `${dir === 'desc' ? '-' : ''}${key}`;
  return tiebreak && tiebreak !== key ? `${primary},${tiebreak}` : primary;
}

/**
 * Safe tenant filter for the current tenant (the id comes from
 * localStorage, so it must never be interpolated into a filter string).
 */
export function tenantFilter(tenant: string | null = getCurrentTenant()): string {
  return tenant ? pb.filter('tenant = {:tenant}', { tenant }) : '';
}

export function clearAuth() {
  pb.authStore.clear();
  localStorage.removeItem('stjorna_current_tenant');
}

export { pb as pbInstance };
