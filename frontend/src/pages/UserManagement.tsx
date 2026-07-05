import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import type { Role } from '~/types';
import Table, { Column } from '~/components/ui/Table';

async function fetchUsers() {
  const tenant = getCurrentTenant();
  try {
    if (authStore.isPBAdmin) {
      const userTenantsResult = await pb.collection('user_tenants').getList(1, 500, {
        expand: 'user,tenant',
      });
      return userTenantsResult.items.map((ut: any) => ({
        ...ut,
        id: ut.id,
        name: ut.expand?.user?.name || '',
        email: ut.expand?.user?.email || '',
        tenantName: ut.expand?.tenant?.name || 'Unknown',
        userTenantId: ut.id,
        userRole: ut.role,
      }));
    } else {
      const filter = tenant ? `tenant = "${tenant}"` : '';
      const userTenantsResult = await pb.collection('user_tenants').getList(1, 500, {
        filter,
        expand: 'user,tenant',
      });
      return userTenantsResult.items.map((ut: any) => ({
        ...ut,
        id: ut.id,
        name: ut.expand?.user?.name || '',
        email: ut.expand?.user?.email || '',
        tenantName: ut.expand?.tenant?.name || '',
        userTenantId: ut.id,
        userRole: ut.role,
      }));
    }
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
    console.log('[Users] mounted, isPBAdmin:', authStore.isPBAdmin, 'user:', authStore.user);
    setInitialized(true);
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
    }
  });

  const [users, { refetch }] = createResource(initialized, (ready) => {
    if (!ready) return undefined;
    return fetchUsers();
  });

  const [showInvite, setShowInvite] = createSignal(false);
  const [inviteEmail, setInviteEmail] = createSignal('');
  const [inviteRole, setInviteRole] = createSignal<Role>('editor');
  const [inviteName, setInviteName] = createSignal('');
  const [invitePassword, setInvitePassword] = createSignal('');
  const [invitePasswordConfirm, setInvitePasswordConfirm] = createSignal('');
  const [error, setError] = createSignal('');
  const [inviting, setInviting] = createSignal(false);

  const handleInvite = async (e: Event) => {
    e.preventDefault();
    if (invitePassword() !== invitePasswordConfirm()) {
      setError('Passwords do not match');
      return;
    }
    setInviting(true);
    setError('');

    try {
      const tenant = getCurrentTenant();
      const newUser = await pb.collection('users').create({
        email: inviteEmail(),
        password: invitePassword(),
        passwordConfirm: invitePasswordConfirm(),
        name: inviteName(),
        tenant,
      });
      await pb.collection('user_tenants').create({
        user: newUser.id,
        tenant,
        role: inviteRole(),
      });
      setShowInvite(false);
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      setInvitePasswordConfirm('');
      refetch();
    } catch (e: any) {
      setError(e.message || 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userTenantId: string, newRole: Role) => {
    try {
      await pb.collection('user_tenants').update(userTenantId, { role: newRole });
      refetch();
    } catch (e: any) {
      alert(`Failed to update role: ${e.message}`);
    }
  };

  const handleRemove = async (userTenantId: string) => {
    if (!confirm('Remove this user from the tenant?')) return;
    try {
      await pb.collection('user_tenants').delete(userTenantId);
      refetch();
    } catch (e: any) {
      alert(`Failed to remove user: ${e.message}`);
    }
  };

  const columns: Column[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'userRole',
      label: 'Role',
      render: (v, row) => (
        <select
          value={v || ''}
          onChange={(e) => handleRoleChange(row.userTenantId || row.id, e.currentTarget.value as Role)}
          onClick={(e) => e.stopPropagation()}
          disabled={!authStore.isAdminOrAbove()}
          class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      ),
    },
    {
      key: 'tenantName',
      label: 'Tenant',
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <Show when={authStore.isAdminOrAbove()}>
          <button
            onClick={(e) => { e.stopPropagation(); handleRemove(row.userTenantId || row.id); }}
            class="text-red-400 hover:text-red-300 text-sm"
          >
            Remove
          </button>
        </Show>
      ),
    },
  ];

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-white">User Management</h1>
        <Show when={authStore.isAdminOrAbove()}>
          <button
            onClick={() => setShowInvite(true)}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
          >
            + Invite User
          </button>
        </Show>
      </div>

      <Show when={!authStore.isAdminOrAbove()}>
        <div class="bg-yellow-500/10 border border-yellow-500 rounded p-4 text-yellow-400 text-sm">
          Only admins can manage users.
        </div>
      </Show>

      <Show when={showInvite()}>
        <div class="bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 class="text-lg font-semibold text-white">Invite User</h2>
          <form onSubmit={handleInvite} class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={inviteName()}
                  onInput={(e) => setInviteName(e.currentTarget.value)}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail()}
                  onInput={(e) => setInviteEmail(e.currentTarget.value)}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  value={invitePassword()}
                  onInput={(e) => setInvitePassword(e.currentTarget.value)}
                  autocomplete="new-password"
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={invitePasswordConfirm()}
                  autocomplete="new-password"
                  onInput={(e) => setInvitePasswordConfirm(e.currentTarget.value)}
                  class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  required
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1">Role</label>
              <select
                value={inviteRole()}
                onChange={(e) => setInviteRole(e.currentTarget.value as Role)}
                class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <Show when={error()}>
              <p class="text-red-400 text-sm">{error()}</p>
            </Show>

            <div class="flex gap-3">
              <button
                type="submit"
                disabled={inviting()}
                class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
              >
                {inviting() ? 'Inviting...' : 'Invite'}
              </button>
              <button
                type="button"
                onClick={() => { setShowInvite(false); setError(''); }}
                class="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </Show>

      <Show when={users.loading}>
        <div class="text-gray-400">Loading users...</div>
      </Show>

      <Show when={!users.loading && users()}>
        <div class="bg-gray-800 rounded-lg overflow-hidden">
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