import { createSignal, Show, onMount, For } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import type { Tenant } from '~/types';
import { ArrowLeft, Save, UserPlus, X } from 'lucide-solid';
import BackupSection from '~/components/backup/BackupSection';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

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
  const tenantId = () => params.id;

  const [formData, setFormData] = createSignal({
    name: '',
    slug: '',
    plan: 'starter',
    custom_domain: '',
    theme_config: '',
  });
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);
  const [notFound, setNotFound] = createSignal(false);

  const [tenantUsers, setTenantUsers] = createSignal<TenantUser[]>([]);
  const [usersLoading, setUsersLoading] = createSignal(true);
  const [showAddUser, setShowAddUser] = createSignal(false);
  const [newUserEmail, setNewUserEmail] = createSignal('');
  const [newUserName, setNewUserName] = createSignal('');
  const [newUserPassword, setNewUserPassword] = createSignal('');
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
      const result = await pb.collection('user_tenants').getList(1, 500, {
        filter: `tenant = "${tenantId()}"`,
        expand: 'user,role',
      });
      const users: TenantUser[] = result.items.map((ut: any) => ({
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
  };

  onMount(async () => {
    await authStore.init();
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    if (!authStore.isPBAdmin) {
      navigate('/', { replace: true });
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
        theme_config: tenant.theme_config || '{}',
      });
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
    if (!tenantId()) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const themeConfig = JSON.parse(formData().theme_config || '{}');
      await pb.collection('tenants').update(tenantId()!, {
        name: formData().name,
        slug: formData().slug,
        plan: formData().plan,
        custom_domain: formData().custom_domain,
        theme_config: JSON.stringify(themeConfig),
      });
      sidebarStore.bump();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async (e: Event) => {
    e.preventDefault();
    if (!tenantId() || !newUserEmail() || !newUserPassword()) return;

    setAddingUser(true);
    setError('');

    try {
      let user: any;
      const existingUsers = await pb.collection('users').getList(1, 1, {
        filter: `email = "${newUserEmail()}"`,
      });

      if (existingUsers.items.length > 0) {
        user = existingUsers.items[0];
      } else {
        user = await pb.collection('users').create({
          email: newUserEmail(),
          password: newUserPassword(),
          passwordConfirm: newUserPassword(),
          name: newUserName() || newUserEmail().split('@')[0],
        });
      }

      const roleId = await getRoleId(newUserRole());
      await pb.collection('user_tenants').create({
        user: user.id,
        tenant: tenantId(),
        role: roleId,
      });

      setShowAddUser(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('editor');
      sidebarStore.bump();
      await loadTenantUsers();
    } catch (e: any) {
      setError(e.message || 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (userTenantId: string) => {
    if (!confirm('Remove this user from the tenant?')) return;
    try {
      await pb.collection('user_tenants').delete(userTenantId);
      sidebarStore.bump();
      await loadTenantUsers();
    } catch (e: any) {
      alert(`Failed to remove user: ${e.message}`);
    }
  };

  const handleRoleChange = async (userTenantId: string, newRoleName: string) => {
    try {
      const roleId = await getRoleId(newRoleName);
      await pb.collection('user_tenants').update(userTenantId, { role: roleId });
      setEditingUserId(null);
      await loadTenantUsers();
    } catch (e: any) {
      alert(`Failed to update role: ${e.message}`);
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
          class="text-gray-400 hover:text-white flex items-center gap-1"
        >
          <ArrowLeft size={16} />
          Back to Tenants
        </button>
        <h1 class="text-2xl font-bold text-white">Tenant Settings</h1>
      </div>

      <Show when={loading()}>
        <div class="text-gray-400">Loading...</div>
      </Show>

      <Show when={notFound()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-400 text-sm">
          Tenant not found.
        </div>
      </Show>

      <Show when={error() && !loading() && !notFound() && !addingUser()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <Show when={success()}>
        <div class="bg-green-500/10 border border-green-500 rounded p-4 text-green-400 text-sm">
          Settings saved successfully!
        </div>
      </Show>

      <Show when={!loading() && !notFound()}>
        <form onSubmit={handleSubmit} class="bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Company Name</label>
            <input
              type="text"
              value={formData().name}
              onInput={(e) => setFormData(d => ({ ...d, name: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Slug</label>
            <input
              type="text"
              value={formData().slug}
              onInput={(e) => setFormData(d => ({ ...d, slug: e.currentTarget.value.toLowerCase().replace(/\s+/g, '-') }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Plan</label>
            <select
              value={formData().plan}
              onChange={(e) => setFormData(d => ({ ...d, plan: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Custom Domain</label>
            <input
              type="text"
              value={formData().custom_domain}
              onInput={(e) => setFormData(d => ({ ...d, custom_domain: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="media.example.com"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Theme Config (JSON)</label>
            <textarea
              value={formData().theme_config}
              onInput={(e) => setFormData(d => ({ ...d, theme_config: e.currentTarget.value }))}
              rows={4}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
              placeholder='{"primaryColor": "#000000"}'
            />
          </div>

          <button
            type="submit"
            disabled={saving()}
            class={`${PRIMARY_BUTTON_CLASSES} text-white font-medium py-2 px-6 rounded disabled:opacity-50 flex items-center gap-2`}
          >
            <Save size={16} />
            {saving() ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </Show>

      <Show when={!loading() && !notFound()}>
        <BackupSection tenantId={tenantId()!} />
      </Show>

      <Show when={!loading() && !notFound()}>
        <div class="bg-gray-800 rounded-lg p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Tenant Users</h2>
            <button
              onClick={() => setShowAddUser(true)}
              class={`${PRIMARY_BUTTON_CLASSES} text-white px-3 py-1.5 rounded text-sm flex items-center gap-1`}
            >
              <UserPlus size={14} />
              Add User
            </button>
          </div>

          <Show when={showAddUser()}>
            <form onSubmit={handleAddUser} class="bg-gray-700 rounded-lg p-4 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newUserEmail()}
                    onInput={(e) => setNewUserEmail(e.currentTarget.value)}
                    class="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1.5 text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={newUserName()}
                    onInput={(e) => setNewUserName(e.currentTarget.value)}
                    class="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1.5 text-white text-sm"
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={newUserPassword()}
                    onInput={(e) => setNewUserPassword(e.currentTarget.value)}
                    class="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1.5 text-white text-sm"
                    required
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">Role</label>
                  <select
                    value={newUserRole()}
                    onChange={(e) => setNewUserRole(e.currentTarget.value)}
                    class="w-full bg-gray-600 border border-gray-500 rounded px-3 py-1.5 text-white text-sm"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <Show when={error()}>
                <p class="text-red-400 text-sm">{error()}</p>
              </Show>
              <div class="flex gap-2">
                <button
                  type="submit"
                  disabled={addingUser()}
                  class={`${PRIMARY_BUTTON_CLASSES} text-white px-4 py-1.5 rounded text-sm disabled:opacity-50`}
                >
                  {addingUser() ? 'Adding...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddUser(false); setError(''); }}
                  class="bg-gray-600 hover:bg-gray-500 text-white px-4 py-1.5 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Show>

          <Show when={usersLoading()}>
            <div class="text-gray-400 text-sm">Loading users...</div>
          </Show>

          <Show when={!usersLoading() && tenantUsers().length === 0}>
            <div class="text-gray-500 text-sm">No users in this tenant</div>
          </Show>

          <Show when={!usersLoading() && tenantUsers().length > 0}>
            <div class="space-y-2">
              <For each={tenantUsers()}>
                {(user) => (
                  <div class="flex items-center justify-between bg-gray-700 rounded px-3 py-2">
                    <div>
                      <div class="text-white text-sm">{user.name || 'Unknown'}</div>
                      <div class="text-gray-400 text-xs">{user.email}</div>
                    </div>
                    <div class="flex items-center gap-3">
                      <Show
                        when={editingUserId() === user.userTenantId}
                        fallback={
                          <>
                            <span class="text-xs text-gray-400 bg-gray-600 px-2 py-0.5 rounded">{user.role}</span>
                            <button
                              onClick={() => startEditRole(user)}
                              class="text-blue-400 hover:text-blue-300 text-xs"
                            >
                              Change
                            </button>
                          </>
                        }
                      >
                        <select
                          value={editingRole()}
                          onChange={(e) => setEditingRole(e.currentTarget.value)}
                          class="bg-gray-600 border border-gray-500 rounded px-2 py-0.5 text-white text-xs"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() => handleRoleChange(user.userTenantId, editingRole())}
                          class="text-green-400 hover:text-green-300 text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          class="text-gray-400 hover:text-gray-300 text-xs"
                        >
                          Cancel
                        </button>
                      </Show>
                      <button
                        onClick={() => handleRemoveUser(user.userTenantId)}
                        class="text-red-400 hover:text-red-300"
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