import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import Table, { Column } from '~/components/ui/Table';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';
import { Shield, Plus, KeyRound, Trash2 } from 'lucide-solid';

interface Superuser {
  id: string;
  email: string;
  active: boolean;
}

async function fetchSuperusers(): Promise<Superuser[]> {
  try {
    const result = await pb.collection('_superusers').getList(1, 500, {
      sort: 'email',
      fields: 'id,email,active',
    });
    return result.items.map((r: any) => ({
      id: r.id,
      email: r.email || '',
      active: r.active !== false,
    }));
  } catch (e: any) {
    console.error('Failed to load superusers:', e);
    return [];
  }
}

export default function SuperuserManagement() {
  const navigate = useNavigate();
  const [initialized, setInitialized] = createSignal(false);

  onMount(async () => {
    await authStore.init();
    setInitialized(true);
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    if (!authStore.isPBAdmin) {
      navigate('/', { replace: true });
    }
  });

  const [superusers, { refetch }] = createResource(
    () => initialized(),
    (ready) => (ready ? fetchSuperusers() : undefined)
  );

  const [showCreate, setShowCreate] = createSignal(false);
  const [newEmail, setNewEmail] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [newPasswordConfirm, setNewPasswordConfirm] = createSignal('');
  const [creating, setCreating] = createSignal(false);

  const [showPassword, setShowPassword] = createSignal<string | null>(null);
  const [password, setPassword] = createSignal('');
  const [passwordConfirm, setPasswordConfirm] = createSignal('');
  const [savingPassword, setSavingPassword] = createSignal(false);

  const [error, setError] = createSignal('');

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (newPassword() !== newPasswordConfirm()) {
      setError('Passwords do not match');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await pb.collection('_superusers').create({
        email: newEmail(),
        password: newPassword(),
        passwordConfirm: newPasswordConfirm(),
        active: true,
      });
      setShowCreate(false);
      setNewEmail('');
      setNewPassword('');
      setNewPasswordConfirm('');
      sidebarStore.bump();
      refetch();
    } catch (err: any) {
      setError(err.message || 'Failed to create superuser');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (su: Superuser) => {
    try {
      await pb.collection('_superusers').update(su.id, { active: !su.active });
      refetch();
    } catch (err: any) {
      alert(`Failed to update status: ${err?.message}`);
    }
  };

  const handlePasswordSave = async (e: Event, id: string) => {
    e.preventDefault();
    if (password() !== passwordConfirm()) {
      setError('Passwords do not match');
      return;
    }
    setSavingPassword(true);
    setError('');
    try {
      await pb.collection('_superusers').update(id, {
        password: password(),
        passwordConfirm: passwordConfirm(),
      });
      setShowPassword(null);
      setPassword('');
      setPasswordConfirm('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete superuser "${email}"? This cannot be undone.`)) return;
    try {
      await pb.collection('_superusers').delete(id);
      sidebarStore.bump();
      refetch();
    } catch (err: any) {
      alert(`Failed to delete superuser: ${err?.message}`);
    }
  };

  const columns: Column[] = [
    { key: 'email', label: 'Email' },
    {
      key: 'active',
      label: 'Active',
      render: (_v, row: Superuser) => (
        <label class="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={row.active}
            onChange={() => toggleActive(row)}
          />
          <span class="text-gray-900 dark:text-white">{row.active ? 'Enabled' : 'Disabled'}</span>
        </label>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_v, row: Superuser) => (
        <div class="flex items-center gap-3">
          <button
            onClick={() => { setShowPassword(row.id); setPassword(''); setPasswordConfirm(''); setError(''); }}
            class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            title="Change password"
          >
            <KeyRound size={14} /> Password
          </button>
          <button
            onClick={() => handleDelete(row.id, row.email)}
            class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Shield class="text-gray-900 dark:text-white" size={24} />
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Superusers</h1>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError(''); }}
          class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white px-4 py-2 rounded font-medium transition-colors flex items-center gap-2`}
        >
          <Plus size={18} /> Add Superuser
        </button>
      </div>

      <Show when={showCreate()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Add Superuser</h2>
          <form onSubmit={handleCreate} class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail()}
                  onInput={(e) => setNewEmail(e.currentTarget.value)}
                  autocomplete="username"
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword()}
                  onInput={(e) => setNewPassword(e.currentTarget.value)}
                  autocomplete="new-password"
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={newPasswordConfirm()}
                  onInput={(e) => setNewPasswordConfirm(e.currentTarget.value)}
                  autocomplete="new-password"
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>
            <Show when={error()}>
              <p class="text-red-600 dark:text-red-400 text-sm">{error()}</p>
            </Show>
            <div class="flex gap-3">
              <button
                type="submit"
                disabled={creating()}
                class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50`}
              >
                {creating() ? 'Adding...' : 'Add Superuser'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setError(''); }}
                class="bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </Show>

      <Show when={showPassword()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h2>
          <form onSubmit={(e) => handlePasswordSave(e, showPassword()!)} class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordConfirm()}
                  onInput={(e) => setPasswordConfirm(e.currentTarget.value)}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>
            <Show when={error()}>
              <p class="text-red-600 dark:text-red-400 text-sm">{error()}</p>
            </Show>
            <div class="flex gap-3">
              <button
                type="submit"
                disabled={savingPassword()}
                class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50`}
              >
                {savingPassword() ? 'Saving...' : 'Save Password'}
              </button>
              <button
                type="button"
                onClick={() => { setShowPassword(null); setError(''); }}
                class="bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </Show>

      <Show when={superusers.loading}>
        <div class="text-gray-500 dark:text-gray-400">Loading superusers...</div>
      </Show>

      <Show when={!superusers.loading && superusers()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <Table
            columns={columns}
            data={superusers() || []}
            emptyMessage="No superusers found"
          />
        </div>
      </Show>
    </div>
  );
}
