import { createSignal, Show, onMount, For } from 'solid-js';
import { useNavigate, useParams, useLocation, A } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { tenantTheme } from '~/stores/tenantTheme';
import type { Tenant, TenantThemeConfig } from '~/types';
import { parseThemeConfig, buildThemeConfig, asTrimmedString } from '~/utils/themeConfig';
import ThemeConfigFields, { type ThemeFields } from '~/components/tenants/ThemeConfigFields';
import { ArrowLeft, Save, UserPlus, X, BarChart3 } from 'lucide-solid';
import BackupSection from '~/components/backup/BackupSection';
import Combobox from '~/components/ui/Combobox';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';
import { confirmDialog, alertDialog } from '~/components/ui/ConfirmDialog';

interface TenantUser {
  id: string;
  userTenantId: string;
  name: string;
  email: string;
  role: string;
  roleId: string;
}

export default function TenantSettings() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  // Mirrors the isNew pattern used by CategoryEdit / ProductEdit / MediaEdit:
  // '/tenants/new' is the create page; '/tenants/:id' with a real id is edit.
  // Falling back to location.pathname catches the case where `:id` is
  // missing entirely (e.g. somebody navigates to '/tenants/').
  const isNew = () => params.id === 'new' || location.pathname.endsWith('/new');
  const tenantId = () => (isNew() ? undefined : params.id);

  const [formData, setFormData] = createSignal({
    name: '',
    slug: '',
    plan: 'starter',
    custom_domain: '',
  });
  const [theme, setTheme] = createSignal<ThemeFields>({ logoMediaId: '', headerBgLight: '', headerBgDark: '' });
  // Unknown theme_config keys, merged back verbatim on save.
  const [themeExtra, setThemeExtra] = createSignal<TenantThemeConfig>({});
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);
  const [notFound, setNotFound] = createSignal(false);

  const [tenantUsers, setTenantUsers] = createSignal<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = createSignal(true);
  const [showAddUser, setShowAddUser] = createSignal(false);
  const [availableUsers, setAvailableUsers] = createSignal<{ id: string; email: string; name: string }[]>([]);
  const [availableLoading, setAvailableLoading] = createSignal(true);
  const [availableTruncated, setAvailableTruncated] = createSignal(false);
  const [userSearch, setUserSearch] = createSignal('');
  let userSearchTimer: ReturnType<typeof setTimeout> | undefined;
  const onUserSearchInput = (value: string) => {
    setUserSearch(value);
    clearTimeout(userSearchTimer);
    userSearchTimer = setTimeout(() => { void loadAvailableUsers(); }, 300);
  };
  const [selectedUserId, setSelectedUserId] = createSignal('');
  const [newUserRole, setNewUserRole] = createSignal('editor');
  const [addingUser, setAddingUser] = createSignal(false);
  const [editingUserId, setEditingUserId] = createSignal<string | null>(null);
  const [editingRole, setEditingRole] = createSignal('');

  const getRoleId = async (roleName: string): Promise<string> => {
    const roles = await pb.collection('roles').getList(1, 10);
    const role = roles.items.find((r: any) => r.name === roleName);
    return role?.id || '';
  };

  const loadTenantUsers = async () => {
    if (!tenantId()) return;
    setUsersLoading(true);
    try {
      const items = await pb.collection('user_tenants').getFullList({
        batch: 500,
        filter: pb.filter('tenant = {:tenant}', { tenant: tenantId() }),
        expand: 'user,role',
      });
      const users: TenantUser[] = items.map((ut: any) => ({
        id: ut.expand?.user?.id || ut.user,
        userTenantId: ut.id,
        name: ut.expand?.user?.name || '',
        email: ut.expand?.user?.email || '',
        role: ut.expand?.role?.name || ut.role,
        roleId: ut.expand?.role?.id || ut.role,
      }));
      setTenantUsers(users);
    } catch (e: any) {
      console.error('Failed to load tenant users:', e);
    } finally {
      setUsersLoading(false);
    }
    // Refresh the dropdown too — anything now in tenantUsers is no
    // longer a candidate.
    await loadAvailableUsers();
  };

  // Candidate users for the "assign existing user" dropdown, minus the
  // ones already linked to this tenant. Without a search term only the
  // first AVAILABLE_LIMIT users (by email) are listed instead of
  // downloading the whole users table; typing a term narrows the list
  // server-side via /api/stjorna/users/search (superuser substring
  // match). TenantSettings is PB-admin only (gated in onMount).
  const AVAILABLE_LIMIT = 200;
  let availableSeq = 0;
  const loadAvailableUsers = async () => {
    if (!tenantId()) return;
    const seq = ++availableSeq;
    const q = userSearch().trim();
    setAvailableLoading(true);
    try {
      let rows: { id: string; email: string; name: string }[];
      let more = false;
      if (q) {
        const res = (await pb.send('/api/stjorna/users/search', { method: 'GET', query: { q } })) as {
          users?: { id: string; email: string; name: string }[];
        };
        rows = res.users || [];
      } else {
        const page = await pb.collection('users').getList(1, AVAILABLE_LIMIT, { fields: 'id,email,name', sort: 'email' });
        rows = page.items.map((u: any) => ({ id: u.id, email: u.email || '', name: u.name || '' }));
        more = page.totalItems > page.items.length;
      }
      if (seq !== availableSeq) return;
      const takenIds = new Set(tenantUsers().map((u) => u.id));
      setAvailableUsers(rows.filter((u) => !takenIds.has(u.id)));
      setAvailableTruncated(more);
    } catch (e: any) {
      if (seq === availableSeq) console.error('Failed to load available users:', e);
    } finally {
      if (seq === availableSeq) setAvailableLoading(false);
    }
  };

  onMount(async () => {
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    if (!authStore.isPBAdmin) {
      navigate('/', { replace: true });
      return;
    }

    // Create mode: there's no record yet, so no getOne, no tenant users
    // to load. The form fields stay at their defaults.
    if (isNew()) {
      setLoading(false);
      return;
    }

    if (!tenantId()) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const tenant = await pb.collection('tenants').getOne<Tenant>(tenantId()!);
      setFormData({
        name: tenant.name || '',
        slug: tenant.slug || '',
        plan: tenant.plan || 'starter',
        custom_domain: tenant.custom_domain || '',
      });
      const cfg = parseThemeConfig(tenant.theme_config);
      setTheme({
        logoMediaId: asTrimmedString(cfg.logoMediaId),
        headerBgLight: asTrimmedString(cfg.headerBgLight),
        headerBgDark: asTrimmedString(cfg.headerBgDark),
      });
      setThemeExtra(cfg);
    } catch (e: any) {
      if (e.status === 404) {
        setNotFound(true);
      } else {
        setError(e.message || 'Failed to load tenant');
      }
    } finally {
      setLoading(false);
    }

    await loadTenantUsers();
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const payload = {
        name: formData().name,
        slug: formData().slug,
        plan: formData().plan,
        custom_domain: formData().custom_domain,
        theme_config: buildThemeConfig(themeExtra(), theme()),
      };
      if (isNew()) {
        const created = await pb.collection('tenants').create<Tenant>(payload);
        sidebarStore.bump();
        // Land admins on the freshly-created tenant's settings page
        // (replace=true so the back button won't return to /tenants/new).
        navigate(`/tenants/${created.id}`, { replace: true });
      } else {
        if (!tenantId()) return;
        await pb.collection('tenants').update(tenantId()!, payload);
        sidebarStore.bump();
        // Apply immediately when editing the currently selected tenant.
        if (authStore.currentTenant === tenantId()) {
          void tenantTheme.refresh(tenantId()!);
        }
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (e: any) {
      // Show the real PB error message — the same pattern CategoryEdit
      // uses (e.response.message holds the server-side reason).
      const detail = e?.response?.message || e?.message || 'Failed to save';
      const fields = e?.response?.data ? ` (${Object.keys(e.response.data).join(', ')})` : '';
      setError(`${detail}${fields}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async (e: Event) => {
    e.preventDefault();
    if (!tenantId() || !selectedUserId()) return;

    setAddingUser(true);
    setError('');

    try {
      // Just create the user_tenants link — the user record itself
      // already exists. New user creation lives on /users.
      const roleId = await getRoleId(newUserRole());
      await pb.collection('user_tenants').create({
        user: selectedUserId(),
        tenant: tenantId(),
        role: roleId,
      });

      setShowAddUser(false);
      setSelectedUserId('');
      setNewUserRole('editor');
      sidebarStore.bump();
      await loadTenantUsers();
    } catch (e: any) {
      const detail = e?.response?.message || e?.message || 'Failed to add user';
      const fields = e?.response?.data ? ` (${Object.keys(e.response.data).join(', ')})` : '';
      setError(`${detail}${fields}`);
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (userTenantId: string) => {
    if (!(await confirmDialog({ message: 'Remove this user from the tenant?', danger: true }))) return;
    try {
      await pb.collection('user_tenants').delete(userTenantId);
      sidebarStore.bump();
      await loadTenantUsers();
    } catch (e: any) {
      void alertDialog(`Failed to remove user: ${e.message}`);
    }
  };

  const handleRoleChange = async (userTenantId: string, newRoleName: string) => {
    try {
      const roleId = await getRoleId(newRoleName);
      await pb.collection('user_tenants').update(userTenantId, { role: roleId });
      setEditingUserId(null);
      await loadTenantUsers();
    } catch (e: any) {
      void alertDialog(`Failed to update role: ${e.message}`);
    }
  };

  const startEditRole = (user: TenantUser) => {
    setEditingUserId(user.userTenantId);
    setEditingRole(user.role);
  };

  return (
    <div class="space-y-6 max-w-2xl">
      <div class="flex items-center gap-4">
        <button
          onClick={() => navigate('/tenants')}
          class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white flex items-center gap-1"
        >
          <ArrowLeft size={16} />
          Back to Tenants
        </button>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{isNew() ? 'New Tenant' : 'Tenant Settings'}</h1>
      </div>

      <Show when={loading()}>
        <div class="text-gray-500 dark:text-gray-400">Loading...</div>
      </Show>

      <Show when={notFound()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
          Tenant not found.
        </div>
      </Show>

      <Show when={error() && !loading() && !notFound() && !addingUser()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <Show when={success()}>
        <div class="bg-green-500/10 border border-green-500 rounded p-4 text-green-600 dark:text-green-400 text-sm">
          Settings saved successfully!
        </div>
      </Show>

      <Show when={!loading() && !notFound() && !isNew()}>
        <div class="bg-blue-500/10 border border-blue-500 rounded p-4 text-blue-700 dark:text-blue-300 text-sm">
          Fill in the details below and save. After creating the tenant,
          you'll be able to invite users and manage backups from this page.
        </div>
      </Show>

      <Show when={!loading() && !notFound()}>
        <form onSubmit={handleSubmit} class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
            <input
              type="text"
              value={formData().name}
              onInput={(e) => setFormData(d => ({ ...d, name: e.currentTarget.value }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
            <input
              type="text"
              value={formData().slug}
              onInput={(e) => setFormData(d => ({ ...d, slug: e.currentTarget.value.toLowerCase().replace(/\s+/g, '-') }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan</label>
            <Combobox
              value={formData().plan}
              onChange={(v) => setFormData(d => ({ ...d, plan: v }))}
              options={[
                { value: 'free', label: 'Free' },
                { value: 'starter', label: 'Starter' },
                { value: 'professional', label: 'Professional' },
                { value: 'enterprise', label: 'Enterprise' },
              ]}
              placeholder="Select plan"
              allowClear={false}
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custom Domain</label>
            <input
              type="text"
              value={formData().custom_domain}
              onInput={(e) => setFormData(d => ({ ...d, custom_domain: e.currentTarget.value }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              placeholder="media.example.com"
            />
          </div>

          <ThemeConfigFields value={theme()} onChange={setTheme} />

          <button
            type="submit"
            disabled={saving()}
            class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-6 rounded disabled:opacity-50 flex items-center gap-2`}
          >
            <Save size={16} />
            {saving() ? (isNew() ? 'Creating...' : 'Saving...') : (isNew() ? 'Create Tenant' : 'Save Settings')}
          </button>
        </form>
      </Show>

      <Show when={!loading() && !notFound() && !isNew()}>
        <BackupSection tenantId={tenantId()!} />

        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold text-gray-900 dark:text-white">Statistics</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              Counts, storage usage and last-30-day activity for this tenant.
            </div>
          </div>
          <A
            href={`/tenants/${tenantId()}/stats`}
            class="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <BarChart3 size={14} />
            View stats
          </A>
        </div>
      </Show>

      <Show when={!loading() && !notFound() && !isNew()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Tenant Users</h2>
            <button
              onClick={() => setShowAddUser(true)}
              class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white px-3 py-1.5 rounded text-sm flex items-center gap-1`}
            >
              <UserPlus size={14} />
              Add User
            </button>
          </div>

          <Show when={showAddUser()}>
            <form onSubmit={handleAddUser} class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1" for="ts-existing-user">
                  Assign existing user
                </label>
                <input
                  id="ts-user-search"
                  type="search"
                  aria-label="Search users by email"
                  placeholder="Search by email…"
                  value={userSearch()}
                  onInput={(e) => onUserSearchInput(e.currentTarget.value)}
                  class="w-full mb-2 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded px-3 py-1.5 text-gray-900 dark:text-white text-sm"
                />
                <Combobox
                  id="ts-existing-user"
                  testId="ts-existing-user"
                  value={selectedUserId()}
                  onChange={(v) => setSelectedUserId(v)}
                  options={availableUsers().map((u) => ({
                    value: u.id,
                    label: u.name ? `${u.name} <${u.email}>` : u.email,
                  }))}
                  placeholder="— Select a user —"
                  allowClear={false}
                  disabled={availableLoading()}
                />
                <Show when={!userSearch() && availableTruncated()}>
                  <p class="text-xs text-gray-600 dark:text-gray-500 mt-1">
                    Showing the first {AVAILABLE_LIMIT} users. Search by email to find others.
                  </p>
                </Show>
                <Show when={!availableLoading() && availableUsers().length === 0 && !!userSearch()}>
                  <p class="text-xs text-gray-600 dark:text-gray-500 mt-1">No matching users.</p>
                </Show>
                <Show when={!availableLoading() && availableUsers().length === 0 && !userSearch()}>
                  <p class="text-xs text-gray-600 dark:text-gray-500 mt-1">
                    No users available. Go to{' '}
                    <a href="/users" class="text-blue-600 dark:text-blue-400 hover:underline">
                      User Management
                    </a>{' '}
                    to create a new one.
                  </p>
                </Show>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1" for="ts-existing-role">
                  Role
                </label>
                <Combobox
                  id="ts-existing-role"
                  testId="ts-existing-role"
                  value={newUserRole()}
                  onChange={(v) => setNewUserRole(v)}
                  options={[
                    { value: 'viewer', label: 'Viewer' },
                    { value: 'editor', label: 'Editor' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                  placeholder="Select role"
                  allowClear={false}
                />
              </div>
              <Show when={error()}>
                <p class="text-red-600 dark:text-red-400 text-sm">{error()}</p>
              </Show>
              <div class="flex gap-2">
                <button
                  type="submit"
                  disabled={addingUser() || !selectedUserId() || availableUsers().length === 0}
                  class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white px-4 py-1.5 rounded text-sm disabled:opacity-50`}
                >
                  {addingUser() ? 'Adding...' : 'Add to tenant'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddUser(false); setSelectedUserId(''); setError(''); }}
                  class="bg-gray-100 dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-900 dark:text-white px-4 py-1.5 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Show>

          <Show when={usersLoading()}>
            <div class="text-gray-500 dark:text-gray-400 text-sm">Loading users...</div>
          </Show>

          <Show when={!usersLoading() && tenantUsers().length === 0}>
            <div class="text-gray-600 dark:text-gray-500 text-sm">No users in this tenant</div>
          </Show>

          <Show when={!usersLoading() && tenantUsers().length > 0}>
            <div class="space-y-2">
              <For each={tenantUsers()}>
                {(user) => (
                  <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded px-3 py-2">
                    <div>
                      <div class="text-gray-900 dark:text-white text-sm">{user.name || 'Unknown'}</div>
                      <div class="text-gray-500 dark:text-gray-400 text-xs">{user.email}</div>
                    </div>
                    <div class="flex items-center gap-3">
                      <Show
                        when={editingUserId() === user.userTenantId}
                        fallback={
                          <>
                            <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded">{user.role}</span>
                            <button
                              onClick={() => startEditRole(user)}
                              class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs"
                            >
                              Change
                            </button>
                          </>
                        }
                      >
                        <Combobox
                          value={editingRole()}
                          onChange={(v) => setEditingRole(v)}
                          options={[
                            { value: 'viewer', label: 'Viewer' },
                            { value: 'editor', label: 'Editor' },
                            { value: 'admin', label: 'Admin' },
                          ]}
                          placeholder="Select role"
                          allowClear={false}
                          class="w-32"
                        />
                        <button
                          onClick={() => handleRoleChange(user.userTenantId, editingRole())}
                          class="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-xs"
                        >
                          Cancel
                        </button>
                      </Show>
                      <button
                        onClick={() => handleRemoveUser(user.userTenantId)}
                        class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}