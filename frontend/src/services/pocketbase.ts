import PocketBase from 'pocketbase';

export function getPbUrl(): string {
  return localStorage.getItem('stjorna_pb_url') || 'http://localhost:8090';
}

export let pb = new PocketBase(getPbUrl());
pb.autoCancellation(false);

export function setPbUrl(url: string) {
  localStorage.setItem('stjorna_pb_url', url);
}

export function recreatePb(url?: string) {
  const finalUrl = url || getPbUrl();
  pb = new PocketBase(finalUrl);
  pb.autoCancellation(false);
}

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