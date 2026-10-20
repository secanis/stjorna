import { createSignal, createMemo, createRoot } from 'solid-js';
import { pbInstance as pb, setCurrentTenant, getCurrentTenant, clearAuth } from '~/services/pocketbase';
import type { Role, UserTenant, TenantThemeConfig } from '~/types';
import { parseThemeConfig } from '~/utils/themeConfig';
import { tenantStore } from '~/stores/tenant';

// Only trust a persisted record when its token is still valid (not
// expired). A stale localStorage entry must not look "logged in".
const [user, setUser] = createSignal<Record<string, any> | null>(
  pb.authStore.isValid ? pb.authStore.record : null
);
const [tenants, setTenants] = createSignal<UserTenant[]>([]);
const [currentTenant, setCurrentTenantSignal] = createSignal<string | null>(
  getCurrentTenant()
);
const [role, setRole] = createSignal<Role | null>(null);
const [isPBAdmin, setIsPBAdmin] = createSignal<boolean>(false);
const [isLoading, setIsLoading] = createSignal<boolean>(false);
const [error, setError] = createSignal<string | null>(null);

// Derived state lives in an explicit root so the memos are owned (no
// "computations created outside a createRoot" leak) for the app lifetime.
const derived = createRoot(() => ({
  isAuthenticated: createMemo(() => user() !== null),
  isEditorOrAbove: createMemo(() => {
    if (isPBAdmin()) return true;
    const r = role();
    return r === 'editor' || r === 'admin';
  }),
  isAdminOrAbove: createMemo(() => {
    if (isPBAdmin()) return true;
    return role() === 'admin';
  }),
}));

function resetState() {
  setUser(null);
  setTenants([]);
  setCurrentTenantSignal(null);
  setRole(null);
  setIsPBAdmin(false);
}

let initPromise: Promise<void> | null = null;

async function doInit(): Promise<void> {
  if (!pb.authStore.isValid) {
    if (pb.authStore.token) clearAuth();
    resetState();
    return;
  }
  // Confirm the session server-side and rotate the token. A 401/403/404
  // means the token was revoked or the account is gone: drop it. Network
  // errors keep the (locally valid) session so an unreachable backend
  // does not force a logout.
  const collection = pb.authStore.isSuperuser ? '_superusers' : 'users';
  try {
    await pb.collection(collection).authRefresh();
  } catch (e: any) {
    if (e?.status === 401 || e?.status === 403 || e?.status === 404) {
      clearAuth();
      resetState();
      return;
    }
  }
  setUser(pb.authStore.record);
  if (pb.authStore.isSuperuser) {
    setIsPBAdmin(true);
    await authStore.loadAllTenantsForPBAdmin();
    return;
  }
  await authStore.loadTenants();
}

// Keep the store in sync with the SDK: token cleared (logout in another
// tab, 401 handler, expiry) or replaced (authRefresh, login).
pb.authStore.onChange((token, record) => {
  if (!token || !record) {
    if (user() !== null) {
      resetState();
      tenantStore.bump();
    }
    initPromise = null;
    return;
  }
  setUser(record);
});

export const authStore = {
  get user() {
    return user();
  },
  get tenants() {
    return tenants();
  },
  get currentTenant() {
    return currentTenant();
  },
  get role() {
    return role();
  },
  get isPBAdmin() {
    return isPBAdmin();
  },
  get isLoading() {
    return isLoading();
  },
  get error() {
    return error();
  },

  isAuthenticated: derived.isAuthenticated,

  hasRole: (requiredRoles: Role | Role[]) => {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    const currentRole = role();
    if (!currentRole) return false;
    return roles.includes(currentRole);
  },

  isEditorOrAbove: derived.isEditorOrAbove,

  isAdminOrAbove: derived.isAdminOrAbove,

  /**
   * Restore and verify the persisted session. Idempotent: called once by
   * the route guard (RequireAuth); later callers share the same promise.
   */
  init(): Promise<void> {
    if (!initPromise) initPromise = doInit();
    return initPromise;
  },

  async login(email: string, password: string) {
    setIsLoading(true);
    setError(null);
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      setUser(authData.record);

      // PB v0.40+ stores superusers in the `_superusers` auth collection.
      // If someone somehow used a superuser identity here, reject it so they
      // use the admin login form instead.
      if (pb.authStore.isSuperuser) {
        await this.logout();
        const err = new Error('This account is a superuser. Please use the admin login instead.');
        setError(err.message);
        throw err;
      }

      await this.loadTenants();
      initPromise = Promise.resolve();
    } catch (e: any) {
      if (!e.message?.includes('superuser')) {
        setError(e.message || 'Login failed');
      }
      throw e;
    } finally {
      setIsLoading(false);
    }
  },

  async loginAsAdmin(email: string, password: string) {
    setIsLoading(true);
    setError(null);
    try {
      await pb.collection('_superusers').authWithPassword(email, password);
      setUser(pb.authStore.record);
      setIsPBAdmin(true);
      setCurrentTenantSignal(null);
      setRole(null);
      await this.loadAllTenantsForPBAdmin();
      initPromise = Promise.resolve();
    } catch (e: any) {
      setError(e.message || 'Admin login failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  },

  async requestAdminOTP(email: string) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await pb.collection('_superusers').requestOTP(email);
      return result.otpId as string;
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP');
      throw e;
    } finally {
      setIsLoading(false);
    }
  },

  async verifyAdminOTP(otpId: string, code: string, mfaId: string) {
    setIsLoading(true);
    setError(null);
    try {
      await pb.collection('_superusers').authWithOTP(otpId, code, { mfaId });
      setUser(pb.authStore.record);
      setIsPBAdmin(true);
      setCurrentTenantSignal(null);
      setRole(null);
      await this.loadAllTenantsForPBAdmin();
      initPromise = Promise.resolve();
    } catch (e: any) {
      setError(e.message || 'OTP verification failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  },

  async requestOTP(email: string) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await pb.collection('users').requestOTP(email);
      return result.otpId as string;
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP');
      throw e;
    } finally {
      setIsLoading(false);
    }
  },

  async verifyOTP(otpId: string, code: string, mfaId: string) {
    setIsLoading(true);
    setError(null);
    try {
      const authData = await pb.collection('users').authWithOTP(otpId, code, { mfaId });
      setUser(authData.record);
      await this.loadTenants();
      initPromise = Promise.resolve();
    } catch (e: any) {
      setError(e.message || 'OTP verification failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  },

  async loginWithOAuth2(providerName: string, scopes?: string[]) {
    setIsLoading(true);
    setError(null);
    try {
      // Fall back to the scopes configured in instance_settings so the
      // "groups" scope (or any custom scope) is actually requested.
      let effectiveScopes = scopes;
      if (!effectiveScopes || effectiveScopes.length === 0) {
        try {
          const cfg = await pb.send('/api/stjorna/oidc-config', { method: 'GET' });
          if (cfg && typeof cfg.scopes === 'string') {
            effectiveScopes = cfg.scopes
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
          }
        } catch (_) {
          // ignore and let the SDK use the provider defaults
        }
      }

      const authData = await pb.collection('users').authWithOAuth2({
        provider: providerName,
        scopes: effectiveScopes,
        createData: { emailVisibility: false },
      });
      setUser(authData.record);
      setIsPBAdmin(false);
      await this.loadTenants();
      initPromise = Promise.resolve();
    } catch (e: any) {
      setError(e.message || 'OIDC login failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  },

  async loadTenants() {
    try {
      const userId = user()?.id || pb.authStore.record?.id;
      if (!userId) return;
      const items = await pb.collection('user_tenants').getFullList({
        batch: 200,
        filter: pb.filter('user = {:userId}', { userId }),
        expand: 'tenant,role',
      });

      const tenantList: UserTenant[] = await Promise.all(items.map(async (r: any) => {
        let tenantName = r.expand?.tenant?.name;
        let themeConfig: TenantThemeConfig = parseThemeConfig(r.expand?.tenant?.theme_config);
        let roleName = r.expand?.role?.name;

        if (!tenantName && r.tenant) {
          try {
            const tenantRec = await pb.collection('tenants').getOne(r.tenant);
            tenantName = tenantRec.name || r.tenant;
            themeConfig = parseThemeConfig(tenantRec.theme_config);
          } catch {
            tenantName = r.tenant;
          }
        }

        if (!roleName && r.role) {
          try {
            const roleRec = await pb.collection('roles').getOne(r.role);
            roleName = roleRec.name || 'viewer';
          } catch {
            roleName = 'viewer';
          }
        }

        return {
          id: r.id,
          tenant: r.tenant,
          tenantName: tenantName || r.tenant,
          role: (roleName || 'viewer') as Role,
          themeConfig,
        };
      }));

      setTenants(tenantList);

      let targetTenant: string | null = null;
      const lastTenant = pb.authStore.record?.last_tenant;
      const savedTenant = getCurrentTenant();

      if (savedTenant && tenantList.some(t => t.tenant === savedTenant)) {
        targetTenant = savedTenant;
      } else if (lastTenant && tenantList.some(t => t.tenant === lastTenant)) {
        targetTenant = lastTenant;
      } else if (tenantList.length > 0) {
        targetTenant = tenantList[0].tenant;
      }

      if (targetTenant) {
        setCurrentTenantSignal(targetTenant);
        setCurrentTenant(targetTenant);
        const t = tenantList.find(t => t.tenant === targetTenant);
        if (t) setRole(t.role);
      }
    } catch (e: any) {
      console.error('Failed to load tenants:', e);
    }
  },

  async loadAllTenantsForPBAdmin() {
    try {
      const items = await pb.collection('tenants').getFullList({ batch: 500, sort: 'name' });
      const allTenants: UserTenant[] = items.map((t: any) => ({
        id: t.id,
        tenant: t.id,
        tenantName: t.name || t.id,
        role: 'admin' as Role,
        themeConfig: parseThemeConfig(t.theme_config),
      }));
      setTenants(allTenants);
    } catch (e: any) {
      console.error('Failed to load tenants for PB admin:', e);
    }
  },

  async switchTenant(tenantId: string | null) {
    if (tenantId === null) {
      setCurrentTenantSignal(null);
      setCurrentTenant(null);
      setRole(null);
      tenantStore.bump();
      return;
    }
    const t = tenants().find(t => t.tenant === tenantId);
    if (t) {
      setCurrentTenantSignal(tenantId);
      setCurrentTenant(tenantId);
      setRole(t.role);
      tenantStore.bump();
      if (!isPBAdmin() && user()?.id) {
        try {
          await pb.collection('users').update(user()!.id!, { last_tenant: tenantId });
        } catch {}
      }
    }
  },

  async logout() {
    clearAuth();
    resetState();
    setError(null);
    initPromise = null;
    tenantStore.bump();
  },
};

// Debug handle for local development only; never exposed in production.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__authStore = authStore;
}
