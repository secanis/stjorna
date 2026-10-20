import PocketBase from 'pocketbase';
import { getConfiguredPbUrl } from '~/services/config';

// Runtime config (/config.js) → VITE_PB_URL → same origin.
const ENV_PB_URL = getConfiguredPbUrl() || '/';

export function getPbUrl(): string {
  return ENV_PB_URL;
}

export const pb = new PocketBase(ENV_PB_URL);
pb.autoCancellation(false);

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

export function clearAuth() {
  pb.authStore.clear();
  localStorage.removeItem('stjorna_current_tenant');
}

export { pb as pbInstance };
