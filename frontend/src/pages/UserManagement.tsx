import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { tenantStore } from '~/stores/tenant';
import type { Role } from '~/types';
import Table, { Column } from '~/components/ui/Table';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';
import { X, ExternalLink } from 'lucide-solid';

// One row per tenant membership of a given user.
// uniqUser below rolls several of these up into a single row.
interface UserMembership {
  userTenantId: string;
  tenantId: string;
  tenantName: string;
  role: string;
}

// One row per user, regardless of how many tenants they belong to.
interface AggregatedUser {
  userId: string;
  name: string;
  email: string;
  memberships: UserMembership[];
}

// Raw shape as it comes out of user_tenants.getList with expand.
// Kept narrow so unknown expand fields are tolerated.
interface RawUserTenant {
  id: string;
  user: string;
  tenant: string;
  role: string;
  expand?: {
    user?: { id?: string; name?: string; email?: string };
    tenant?: { id?: string; name?: string };
    role?: { name?: string };
  };
}

// Roll user_tenants records up by user so a user belonging to two
// tenants produces a single row, with their memberships listed
// inside it. The previous shape had one row per link, which made
// the same double up across the table — fine data, wrong UX.
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
    };
    if (existing) {
      existing.memberships.push(membership);
    } else {
      byUser.set(userId, {
        userId,
        name: ut.expand?.user?.name || '',
        email: ut.expand?.user?.email || '',
        memberships: [membership],
      });
    }
  }
  // Sort memberships inside each row by tenant name so the cells
  // have a stable order across re-fetches.
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

  // tenantStore.version inside the source key keeps the user list in
  // step with tenant switches — particularly for non-admin viewers
  // whose query is filtered by getCurrentTenant(); without this
  // subscription a switch to a different tenant left the table
  // showing the previous tenant's user_tenants rows.
  const [users, { refetch }] = createResource(
    () => ({ ready: initialized(), tenantVersion: tenantStore.version }),
    ({ ready }) => (ready ? fetchUsers() : undefined)
  );

  const [showInvite, setShowInvite] = createSignal(false);
  const [inviteEmail, setInviteEmail] = createSignal('');
  const [inviteRole, setInviteRole] = createSignal<Role>('editor');
  const [inviteName, setInviteName] = createSignal('');
  const [invitePassword, setInvitePassword] = createSignal('');
  const [invitePasswordConfirm, setInvitePasswordConfirm] = createSignal('');
  const [error, setError] = createSignal('');
  const [inviting, setInviting] = createSignal(false);

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
      const roleId = await getRoleId(inviteRole());
      await pb.collection('user_tenants').create({
        user: newUser.id,
        tenant,
        role: roleId,
      });
      setShowInvite(false);
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      setInvitePasswordConfirm('');
      sidebarStore.bump();
      refetch();
    } catch (e: any) {
      setError(e.message || 'Failed to invite user');
    } finally {
      setInviting(false);
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

  // Each membership gets its own inline row inside the Tenants
  // column. PB admin sees a tenant link + role select + remove.
  // Non-admin (single-tenant context) only sees the role select
  // — the membership is implicit and the row reflects the
  // viewer's own tenant.
  // data-membership-tenant-id is used by e2e tests to scope a
  // single membership without DOM-tree text collision risk.
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

  // Backend column rows carry an array of memberships. The Table
  // component calls render(value, wholeRow), so we ignore `value`
  // and read row.memberships directly. Header label is deliberately
  // always "Tenants" plural — solid in any context (singular cases
  // are still readable), and avoids the
  // `isPBAdmin ? 'Tenants' : 'Tenant'` capture-at-init race that
  // would otherwise leak the wrong label until a refetch.
  const columns: Column[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'memberships',
      label: 'Tenants',
      render: (_v, row) => renderMembershipCell(row as AggregatedUser),
    },
  ];

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <Show when={authStore.isAdminOrAbove()}>
          <button
            onClick={() => setShowInvite(true)}
            class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white px-4 py-2 rounded font-medium transition-colors`}
          >
            + Invite User
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
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Invite User</h2>
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
                onClick={() => { setShowInvite(false); setError(''); }}
                class="bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
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