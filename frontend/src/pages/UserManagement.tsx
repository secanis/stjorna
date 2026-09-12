import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { tenantStore } from '~/stores/tenant';
import type { Role } from '~/types';
import Table, { Column } from '~/components/ui/Table';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';
import { X, ExternalLink, Search, UserPlus } from 'lucide-solid';

// One row per tenant membership of a given user.
interface UserMembership {
  userTenantId: string;
  tenantId: string;
  tenantName: string;
  role: string;
  source?: string;
}

// One row per user, regardless of how many tenants they belong to.
interface AggregatedUser {
  userId: string;
  name: string;
  email: string;
  memberships: UserMembership[];
  hasSSO: boolean;
}

// Raw shape as it comes out of user_tenants.getList with expand.
interface RawUserTenant {
  id: string;
  user: string;
  tenant: string;
  role: string;
  source?: string;
  expand?: {
    user?: { id?: string; name?: string; email?: string };
    tenant?: { id?: string; name?: string };
    role?: { name?: string };
  };
}

interface SearchResult {
  id: string;
  email: string;
  name: string;
}

function aggregateUserTenants(rows: RawUserTenant[]): AggregatedUser[] {
  const byUser = new Map<string, AggregatedUser>();
  for (const ut of rows) {
    const userId = ut.expand?.user?.id || ut.user;
    const tenantId = ut.expand?.tenant?.id || ut.tenant;
    const existing = byUser.get(userId);
    const membership: UserMembership = {
      userTenantId: ut.id,
      tenantId,
      tenantName: ut.expand?.tenant?.name || 'Unknown tenant',
      role: ut.expand?.role?.name || ut.role || 'viewer',
      source: ut.source,
    };
    if (existing) {
      existing.memberships.push(membership);
      if (ut.source === 'oidc') existing.hasSSO = true;
    } else {
      byUser.set(userId, {
        userId,
        name: ut.expand?.user?.name || '',
        email: ut.expand?.user?.email || '',
        memberships: [membership],
        hasSSO: ut.source === 'oidc',
      });
    }
  }
  return Array.from(byUser.values()).map((u) => ({
    ...u,
    memberships: [...u.memberships].sort((a, b) =>
      a.tenantName.localeCompare(b.tenantName)
    ),
  }));
}

async function fetchUsers(): Promise<AggregatedUser[]> {
  const tenant = getCurrentTenant();
  try {
    let raw: RawUserTenant[];
    if (authStore.isPBAdmin) {
      const r = await pb.collection('user_tenants').getList(1, 500, {
        expand: 'user,tenant,role',
        sort: 'tenant',
      });
      raw = r.items as unknown as RawUserTenant[];
    } else {
      const filter = tenant ? `tenant = "${tenant}"` : '';
      const r = await pb.collection('user_tenants').getList(1, 500, {
        filter,
        expand: 'user,tenant,role',
        sort: 'tenant',
      });
      raw = r.items as unknown as RawUserTenant[];
    }
    return aggregateUserTenants(raw);
  } catch (e: any) {
    console.error('[fetchUsers] error:', e);
    return [];
  }
}

export default function UserManagement() {
  const navigate = useNavigate();
  const [initialized, setInitialized] = createSignal(false);

  onMount(async () => {
    await authStore.init();
    setInitialized(true);
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
    }
  });

  const [users, { refetch }] = createResource(
    () => ({ ready: initialized(), tenantVersion: tenantStore.version }),
    ({ ready }) => (ready ? fetchUsers() : undefined)
  );

  // Superuser invite flow (create new account).
  const [showInvite, setShowInvite] = createSignal(false);
  const [inviteEmail, setInviteEmail] = createSignal('');
  const [inviteRole, setInviteRole] = createSignal<Role>('editor');
  const [inviteName, setInviteName] = createSignal('');
  const [invitePassword, setInvitePassword] = createSignal('');
  const [invitePasswordConfirm, setInvitePasswordConfirm] = createSignal('');
  const [inviteTenant, setInviteTenant] = createSignal<string>('');
  const [inviting, setInviting] = createSignal(false);

  // Tenant admin add-existing-user flow.
  const [addRole, setAddRole] = createSignal<Role>('editor');
  const [searchEmail, setSearchEmail] = createSignal('');
  const [searching, setSearching] = createSignal(false);
  const [searchResults, setSearchResults] = createSignal<SearchResult[]>([]);
  const [selectedUser, setSelectedUser] = createSignal<SearchResult | null>(null);
  const [addingExisting, setAddingExisting] = createSignal(false);

  const [error, setError] = createSignal('');

  const getRoleId = async (roleName: string): Promise<string> => {
    const roles = await pb.collection('roles').getList(1, 10);
    const role = roles.items.find((r: any) => r.name === roleName);
    return role?.id || '';
  };

  const handleInvite = async (e: Event) => {
    e.preventDefault();
    if (invitePassword() !== invitePasswordConfirm()) {
      setError('Passwords do not match');
      return;
    }

    const tenant = inviteTenant();
    if (!tenant) {
      setError('Please select a tenant first');
      return;
    }

    setInviting(true);
    setError('');

    try {
      const newUser = await pb.collection('users').create({
        email: inviteEmail(),
        password: invitePassword(),
        passwordConfirm: invitePasswordConfirm(),
        name: inviteName(),
      });
      const roleId = await getRoleId(inviteRole());
      await pb.collection('user_tenants').create({
        user: newUser.id,
        tenant,
        role: roleId,
      });
      resetInvite();
      sidebarStore.bump();
      refetch();
    } catch (err: any) {
      setError(err.message || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  const resetInvite = () => {
    setShowInvite(false);
    setInviteEmail('');
    setInviteName('');
    setInvitePassword('');
    setInvitePasswordConfirm('');
    setInviteTenant('');
    setError('');
  };

  const resetAddExisting = () => {
    setSearchEmail('');
    setSearchResults([]);
    setSelectedUser(null);
    setAddRole('editor');
    setError('');
  };

  const handleSearch = async (e?: Event) => {
    e?.preventDefault();
    setError('');
    const q = searchEmail().trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = (await pb.send('/api/stjorna/users/search', {
        method: 'GET',
        query: { q },
      })) as { ok: boolean; users: SearchResult[] };
      setSearchResults(res.users || []);
      setSelectedUser(null);
      if ((res.users || []).length === 0) {
        setError('No existing user found with that email.');
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAddExisting = async (e: Event) => {
    e.preventDefault();
    const user = selectedUser();
    const tenant = getCurrentTenant();
    if (!user) {
      setError('Please select a user from the search results');
      return;
    }
    if (!tenant) {
      setError('No tenant selected');
      return;
    }
    setAddingExisting(true);
    setError('');
    try {
      const roleId = await getRoleId(addRole());
      await pb.collection('user_tenants').create({
        user: user.id,
        tenant,
        role: roleId,
      });
      resetAddExisting();
      setShowInvite(false);
      sidebarStore.bump();
      refetch();
    } catch (err: any) {
      setError(err.message || 'Failed to add user to tenant');
    } finally {
      setAddingExisting(false);
    }
  };

  const handleRoleChange = async (userTenantId: string, newRole: Role) => {
    try {
      const roleId = await getRoleId(newRole);
      await pb.collection('user_tenants').update(userTenantId, { role: roleId });
      refetch();
    } catch (e: any) {
      alert(`Failed to update role: ${e?.message}`);
    }
  };

  const handleRemove = async (userTenantId: string, tenantName: string) => {
    if (!confirm(`Remove this user from "${tenantName}"?`)) return;
    try {
      await pb.collection('user_tenants').delete(userTenantId);
      sidebarStore.bump();
      refetch();
    } catch (e: any) {
      alert(`Failed to remove user: ${e?.message}`);
    }
  };

  const renderMembershipCell = (row: AggregatedUser) => (
    <div class="space-y-1.5">
      <For each={row.memberships}>
        {(m) => (
          <div
            class="flex items-center gap-2 text-sm"
            data-membership-tenant-id={m.tenantId}
          >
            <Show
              when={authStore.isPBAdmin}
              fallback={
                <span class="text-gray-900 dark:text-white">{m.tenantName}</span>
              }
            >
              <a
                href={`/tenants/${m.tenantId}`}
                class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {m.tenantName}
                <ExternalLink size={12} />
              </a>
            </Show>
            <select
              value={m.role}
              onChange={(e) => handleRoleChange(m.userTenantId, e.currentTarget.value as Role)}
              onClick={(e) => e.stopPropagation()}
              disabled={!authStore.isAdminOrAbove()}
              class="ml-auto bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-gray-900 dark:text-white text-xs"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <Show when={authStore.isAdminOrAbove()}>
              <button
                onClick={(e) => { e.stopPropagation(); handleRemove(m.userTenantId, m.tenantName); }}
                title={`Remove from ${m.tenantName}`}
                class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                <X size={14} />
              </button>
            </Show>
          </div>
        )}
      </For>
    </div>
  );

  const columns: Column[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'hasSSO',
      label: 'Auth',
      render: (_v, row) => {
        const user = row as AggregatedUser;
        return (
          <span
            class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              user.hasSSO
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {user.hasSSO ? 'SSO' : 'Local'}
          </span>
        );
      },
    },
    {
      key: 'memberships',
      label: 'Tenants',
      render: (_v, row) => renderMembershipCell(row as AggregatedUser),
    },
  ];

  const isSuperuserInvite = () => authStore.isPBAdmin;

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <Show when={authStore.isAdminOrAbove()}>
          <button
            onClick={() => { setShowInvite(true); setError(''); }}
            class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white px-4 py-2 rounded font-medium transition-colors flex items-center gap-2`}
          >
            <UserPlus size={18} />
            {isSuperuserInvite() ? 'Invite User' : 'Add User'}
          </button>
        </Show>
      </div>

      <Show when={!authStore.isAdminOrAbove()}>
        <div class="bg-yellow-500/10 border border-yellow-500 rounded p-4 text-yellow-600 dark:text-yellow-400 text-sm">
          Only admins can manage users.
        </div>
      </Show>

      <Show when={showInvite()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {isSuperuserInvite() ? 'Invite User' : 'Add Existing User'}
          </h2>

          <Show when={isSuperuserInvite()}>
            <form onSubmit={handleInvite} class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={inviteName()}
                    onInput={(e) => setInviteName(e.currentTarget.value)}
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={inviteEmail()}
                    onInput={(e) => setInviteEmail(e.currentTarget.value)}
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={invitePassword()}
                    onInput={(e) => setInvitePassword(e.currentTarget.value)}
                    autocomplete="new-password"
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={invitePasswordConfirm()}
                    autocomplete="new-password"
                    onInput={(e) => setInvitePasswordConfirm(e.currentTarget.value)}
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={inviteRole()}
                  onChange={(e) => setInviteRole(e.currentTarget.value as Role)}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tenant</label>
                <select
                  value={inviteTenant()}
                  onChange={(e) => setInviteTenant(e.currentTarget.value)}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                  required
                >
                  <option value="" disabled>Select a tenant</option>
                  <For each={authStore.tenants}>
                    {(t) => <option value={t.tenant}>{t.tenantName}</option>}
                  </For>
                </select>
              </div>

              <Show when={error()}>
                <p class="text-red-600 dark:text-red-400 text-sm">{error()}</p>
              </Show>

              <div class="flex gap-3">
                <button
                  type="submit"
                  disabled={inviting()}
                  class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50`}
                >
                  {inviting() ? 'Inviting...' : 'Invite'}
                </button>
                <button
                  type="button"
                  onClick={() => resetInvite()}
                  class="bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Show>

          <Show when={!isSuperuserInvite()}>
            <div class="bg-blue-500/10 border border-blue-500 rounded p-4 text-blue-600 dark:text-blue-400 text-sm">
              Adding an existing user gives them access to the current tenant with the selected role.
              Their password and other tenants stay unchanged.
            </div>
            <form onSubmit={handleSearch} class="space-y-4">
              <div class="flex gap-2">
                <input
                  type="email"
                  value={searchEmail()}
                  onInput={(e) => setSearchEmail(e.currentTarget.value)}
                  placeholder="Search by email"
                  class="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                  required
                />
                <button
                  type="submit"
                  disabled={searching()}
                  class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white px-4 py-2 rounded font-medium transition-colors flex items-center gap-2 disabled:opacity-50`}
                >
                  <Search size={16} />
                  {searching() ? 'Searching...' : 'Search'}
                </button>
              </div>

              <Show when={searchResults().length > 0}>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select user</label>
                  <div class="space-y-2">
                    <For each={searchResults()}>
                      {(u) => (
                        <label class="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                          <input
                            type="radio"
                            name="selectedUser"
                            value={u.id}
                            checked={selectedUser()?.id === u.id}
                            onChange={() => setSelectedUser(u)}
                          />
                          <div>
                            <div class="text-gray-900 dark:text-white font-medium">{u.name || u.email}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                          </div>
                        </label>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={selectedUser()}>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select
                    value={addRole()}
                    onChange={(e) => setAddRole(e.currentTarget.value as Role)}
                    class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </Show>

              <Show when={error()}>
                <p class="text-red-600 dark:text-red-400 text-sm">{error()}</p>
              </Show>

              <div class="flex gap-3">
                <button
                  type="button"
                  disabled={!selectedUser() || addingExisting()}
                  onClick={handleAddExisting}
                  class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50`}
                >
                  {addingExisting() ? 'Adding...' : 'Add to Tenant'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowInvite(false); resetAddExisting(); }}
                  class="bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Show>
        </div>
      </Show>

      <Show when={users.loading}>
        <div class="text-gray-500 dark:text-gray-400">Loading users...</div>
      </Show>

      <Show when={!users.loading && users()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <Table
            columns={columns}
            data={users() || []}
            emptyMessage="No users found"
          />
        </div>
      </Show>
    </div>
  );
}
