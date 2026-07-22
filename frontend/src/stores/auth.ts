import { createSignal, createMemo } from 'solid-js';
import { pbInstance as pb, setCurrentTenant, getCurrentTenant, clearAuth } from '~/services/pocketbase';
import type { Role, UserTenant } from '~/types';

const [user, setUser] = createSignal<Record<string, any> | null>(
  pb.authStore.model
);
const [tenants, setTenants] = createSignal<UserTenant[]>([]);
const [currentTenant, setCurrentTenantSignal] = createSignal<string | null>(
  getCurrentTenant()
);
const [role, setRole] = createSignal<Role | null>(null);
const [isPBAdmin, setIsPBAdmin] = createSignal<boolean>(false);
const [isLoading, setIsLoading] = createSignal<boolean>(false);
const [error, setError] = createSignal<string | null>(null);

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

  isAuthenticated: createMemo(() => user() !== null || pb.authStore.isValid),

  hasRole: (requiredRoles: Role | Role[]) => {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    const currentRole = role();
    if (!currentRole) return false;
    return roles.includes(currentRole);
  },

  isEditorOrAbove: createMemo(() => {
    if (isPBAdmin()) return true;
    const r = role();
    return r === 'editor' || r === 'admin';
  }),

  isAdminOrAbove: createMemo(() => {
    if (isPBAdmin()) return true;
    const r = role();
    return r === 'admin';
  }),

  async init() {
    if (pb.authStore.isValid) {
      setUser(pb.authStore.model);
      const model = pb.authStore.model;

      if (pb.authStore.isAdmin) {
        try {
          await pb.admins.getList(1, 1);
        } catch (e: any) {
          if (e.status === 401) {
            await this.logout();
            window.location.href = '/login';
            return;
          }
        }
        setIsPBAdmin(true);
        await this.loadAllTenantsForPBAdmin();
        return;
      }

      await this.loadTenants();
    } else {
      const setupDone = await checkSetupDone();
      if (!setupDone) {
        window.location.href = '/setup';
        return;
      }
    }
  },

  async login(email: string, password: string) {
    setIsLoading(true);
    setError(null);
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      setUser(authData.record);

      let isAdmin = false;
      try {
        await pb.admins.getList(1, 1);
        isAdmin = true;
      } catch (e: any) {
        if (e.status === 401) {
          isAdmin = false;
        } else {
          throw e;
        }
      }

      if (isAdmin) {
        await this.logout();
        const err = new Error('This account is a PB admin. Please use the admin login instead.');
        setError(err.message);
        throw err;
      }

      await this.loadTenants();
    } catch (e: any) {
      if (!e.message?.includes('PB admin')) {
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
      await pb.admins.authWithPassword(email, password);
      setUser(pb.authStore.model);
      setIsPBAdmin(true);
      setCurrentTenantSignal(null);
      setRole(null);
      await this.loadAllTenantsForPBAdmin();
    } catch (e: any) {
      setError(e.message || 'Admin login failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  },

  async loadTenants() {
    try {
      const userId = user()?.id || pb.authStore.model?.id;
      if (!userId) return;
      const result = await pb.collection('user_tenants').getList(1, 50, {
        filter: `user = "${userId}"`,
        expand: 'tenant,role',
      });

      const tenantList: UserTenant[] = await Promise.all(result.items.map(async (r: any) => {
        let tenantName = r.expand?.tenant?.name;
        let roleName = r.expand?.role?.name;

        if (!tenantName && r.tenant) {
          try {
            const tenantRec = await pb.collection('tenants').getOne(r.tenant);
            tenantName = tenantRec.name || r.tenant;
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
        };
      }));

      setTenants(tenantList);

      let targetTenant: string | null = null;
      const lastTenant = pb.authStore.model?.last_tenant;
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
      const result = await pb.collection('tenants').getList(1, 500);
      const allTenants: UserTenant[] = result.items.map((t: any) => ({
        id: t.id,
        tenant: t.id,
        tenantName: t.name || t.id,
        role: 'admin' as Role,
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
      return;
    }
    const t = tenants().find(t => t.tenant === tenantId);
    if (t) {
      setCurrentTenantSignal(tenantId);
      setCurrentTenant(tenantId);
      setRole(t.role);
      if (!isPBAdmin() && user()?.id) {
        try {
          await pb.collection('users').update(user()!.id!, { last_tenant: tenantId });
        } catch {}
      }
    }
  },

  async logout() {
    clearAuth();
    setUser(null);
    setTenants([]);
    setCurrentTenantSignal(null);
    setRole(null);
    setIsPBAdmin(false);
    setError(null);
  },
};

if (typeof window !== 'undefined') {
  (window as any).__authStore = authStore;
}

export async function checkHasAdmins(): Promise<boolean> {
  try {
    pb.authStore.clear();
    await pb.health.check();
    await pb.admins.getList(1, 1);
    return true;
  } catch (e: any) {
    if (e.status === 404) return false;
    if (e.status === 401) return false;
    return false;
  }
}

export async function checkSetupDone(): Promise<boolean> {
  try {
    const settings = await pb.collection('instance_settings').getList(1, 1);
    if (settings.items && settings.items.length > 0) {
      return settings.items[0].setup_done === true;
    }
    return false;
  } catch {
    return false;
  }
}