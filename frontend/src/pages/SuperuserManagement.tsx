import { createSignal, createResource, Show, For, onMount, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import Table, { Column } from '~/components/ui/Table';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';
import { Shield, Plus, KeyRound, Trash2 } from 'lucide-solid';
import { confirmDialog, alertDialog } from '~/components/ui/ConfirmDialog';
import { i18nStore } from '~/i18n';

interface Superuser {
  id: string;
  email: string;
  active: boolean;
}

async function fetchSuperusers(): Promise<Superuser[]> {
  try {
    const items = await pb.collection('_superusers').getFullList({
      batch: 500,
      sort: 'email',
      fields: 'id,email,active',
    });
    return items.map((r: any) => ({
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
      setError(i18nStore.t('superusers.passwordsDoNotMatch'));
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
      setError(err.message || i18nStore.t('superusers.failedToCreate'));
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (su: Superuser) => {
    try {
      await pb.collection('_superusers').update(su.id, { active: !su.active });
      refetch();
    } catch (err: any) {
      void alertDialog(i18nStore.t('superusers.failedToUpdateStatus', { msg: err?.message }));
    }
  };

  const handlePasswordSave = async (e: Event, id: string) => {
    e.preventDefault();
    if (password() !== passwordConfirm()) {
      setError(i18nStore.t('superusers.passwordsDoNotMatch'));
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
      setError(err.message || i18nStore.t('superusers.failedToChangePassword'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!(await confirmDialog({ message: i18nStore.t('superusers.deleteConfirm', { email }), danger: true }))) return;
    try {
      await pb.collection('_superusers').delete(id);
      sidebarStore.bump();
      refetch();
    } catch (err: any) {
      void alertDialog(i18nStore.t('superusers.failedToDelete', { msg: err?.message }));
    }
  };

  const columns = createMemo<Column[]>(() => [
    { key: 'email', label: i18nStore.t('common.email') },
    {
      key: 'active',
      label: i18nStore.t('common.active'),
      render: (_v, row: Superuser) => (
        <label class="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={row.active}
            onChange={() => toggleActive(row)}
          />
          <span class="text-gray-900 dark:text-white">{row.active ? i18nStore.t('common.enabled') : i18nStore.t('common.disabled')}</span>
        </label>
      ),
    },
    {
      key: 'actions',
      label: i18nStore.t('common.actions'),
      render: (_v, row: Superuser) => (
        <div class="flex items-center gap-3">
          <button
            onClick={() => { setShowPassword(row.id); setPassword(''); setPasswordConfirm(''); setError(''); }}
            class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            title={i18nStore.t('superusers.changePassword')}
          >
            <KeyRound size={14} /> {i18nStore.t('superusers.password')}
          </button>
          <button
            onClick={() => handleDelete(row.id, row.email)}
            class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
          >
            <Trash2 size={14} /> {i18nStore.t('common.delete')}
          </button>
        </div>
      ),
    },
  ]);

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Shield class="text-gray-900 dark:text-white" size={24} />
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{i18nStore.t('superusers.title')}</h1>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError(''); }}
          class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white px-4 py-2 rounded font-medium transition-colors flex items-center gap-2`}
        >
          <Plus size={18} /> {i18nStore.t('superusers.addSuperuser')}
        </button>
      </div>

      <Show when={showCreate()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{i18nStore.t('superusers.addSuperuser')}</h2>
          <form onSubmit={handleCreate} class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('common.email')}</label>
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
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('common.password')}</label>
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
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('common.confirmPassword')}</label>
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
                {creating() ? i18nStore.t('superusers.adding') : i18nStore.t('superusers.addSuperuser')}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setError(''); }}
                class="bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded"
              >
                {i18nStore.t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      </Show>

      <Show when={showPassword()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{i18nStore.t('superusers.changePassword')}</h2>
          <form onSubmit={(e) => handlePasswordSave(e, showPassword()!)} class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('superusers.newPassword')}</label>
                <input
                  type="password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('superusers.confirmNewPassword')}</label>
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
                {savingPassword() ? i18nStore.t('common.saving') : i18nStore.t('superusers.savePassword')}
              </button>
              <button
                type="button"
                onClick={() => { setShowPassword(null); setError(''); }}
                class="bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded"
              >
                {i18nStore.t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      </Show>

      <Show when={superusers.loading}>
        <div class="text-gray-500 dark:text-gray-400">{i18nStore.t('superusers.loading')}</div>
      </Show>

      <Show when={!superusers.loading && superusers()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <Table
            columns={columns()}
            data={superusers() || []}
            emptyMessage={i18nStore.t('superusers.empty')}
          />
        </div>
      </Show>
    </div>
  );
}
