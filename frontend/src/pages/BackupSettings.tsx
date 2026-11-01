import { createSignal, createMemo, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { i18nStore } from '~/i18n';
import { errorMessage } from '~/utils/errors';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';
import DescriptionBlock from '~/components/settings/DescriptionBlock';
import Table, { Column } from '~/components/ui/Table';
import { Database, Plus, Download, Trash2, Save, CalendarClock } from 'lucide-solid';
import { confirmDialog } from '~/components/ui/ConfirmDialog';

interface Backup {
  key: string;
  size: number;
  modified: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatDate = (value: string): string => {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString();
};

export default function BackupSettings() {
  const navigate = useNavigate();

  const [backups, setBackups] = createSignal<Backup[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [autoEnabled, setAutoEnabled] = createSignal(false);
  const [cron, setCron] = createSignal('0 0 * * *');
  const [cronMaxKeep, setCronMaxKeep] = createSignal(3);
  const [savingAuto, setSavingAuto] = createSignal(false);

  onMount(async () => {
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    if (!authStore.isPBAdmin) {
      navigate('/', { replace: true });
      return;
    }
    await loadBackups();
    try {
      const settings = await pb.settings.getAll();
      const backupsCfg = settings.backups || {};
      setAutoEnabled(!!backupsCfg.cron);
      setCron(backupsCfg.cron || '0 0 * * *');
      setCronMaxKeep(backupsCfg.cronMaxKeep ?? 3);
    } catch (e: unknown) {
      console.warn('Failed to load backup settings:', errorMessage(e));
    }
  });

  const loadBackups = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await pb.backups.getFullList();
      setBackups(list as Backup[]);
    } catch (e: unknown) {
      setError(errorMessage(e, i18nStore.t('backup.failedToLoad')));
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const now = new Date();
      const ts =
        `${now.getFullYear()}-` +
        `${String(now.getMonth() + 1).padStart(2, '0')}-` +
        `${String(now.getDate()).padStart(2, '0')}_` +
        `${String(now.getHours()).padStart(2, '0')}-` +
        `${String(now.getMinutes()).padStart(2, '0')}-` +
        `${String(now.getSeconds()).padStart(2, '0')}`;
      await pb.backups.create(`stjorna_backup_${ts}.zip`);
      await loadBackups();
      showSuccess(i18nStore.t('backup.created'));
    } catch (e: unknown) {
      setError(errorMessage(e, i18nStore.t('backup.failedToCreate')));
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (key: string) => {
    setError('');
    try {
      const token = await pb.files.getToken();
      const url = pb.backups.getDownloadURL(token, key);
      window.location.href = url;
    } catch (e: unknown) {
      setError(errorMessage(e, i18nStore.t('backup.failedToDownload')));
    }
  };

  const handleDelete = async (key: string) => {
    if (!(await confirmDialog({ message: i18nStore.t('backup.deleteConfirm', { key }), danger: true }))) return;
    setError('');
    try {
      await pb.backups.delete(key);
      await loadBackups();
      showSuccess(i18nStore.t('backup.deleted'));
    } catch (e: unknown) {
      setError(errorMessage(e, i18nStore.t('backup.failedToDelete')));
    }
  };

  const handleSaveAuto = async (e: Event) => {
    e.preventDefault();
    setSavingAuto(true);
    setError('');
    try {
      const settings = await pb.settings.getAll();
      await pb.settings.update({
        backups: {
          ...settings.backups,
          cron: autoEnabled() ? cron().trim() : '',
          cronMaxKeep: Number(cronMaxKeep()) || 0,
        },
      });
      showSuccess(i18nStore.t('backup.savedAuto'));
    } catch (e: unknown) {
      setError(errorMessage(e, i18nStore.t('backup.failedToSaveAuto')));
    } finally {
      setSavingAuto(false);
    }
  };

  const columns = createMemo<Column[]>(() => [
    { key: 'key', label: i18nStore.t('backup.backupCol') },
    {
      key: 'size',
      label: i18nStore.t('common.size'),
      render: (_v, row) => formatBytes(row.size as number),
    },
    {
      key: 'modified',
      label: i18nStore.t('common.created'),
      render: (_v, row) => formatDate(row.modified as string),
    },
    {
      key: 'actions',
      label: i18nStore.t('common.actions'),
      render: (_v, row) => {
        const key = String(row.key);
        return (
          <div class="flex items-center gap-3">
            <button
              onClick={() => handleDownload(key)}
              class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
              title={i18nStore.t('backup.download')}
            >
              <Download size={14} /> {i18nStore.t('backup.download')}
            </button>
            <button
              onClick={() => handleDelete(key)}
              class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
              title={i18nStore.t('common.delete')}
            >
              <Trash2 size={14} /> {i18nStore.t('common.delete')}
            </button>
          </div>
        );
      },
    },
  ]);

  return (
    <div class="space-y-6 max-w-3xl">
      <div class="flex items-center gap-3">
        <Database size={24} class="text-gray-500 dark:text-gray-400" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{i18nStore.t('backup.title')}</h1>
      </div>

      <DescriptionBlock>
        <p>{i18nStore.t('backup.description')}</p>
      </DescriptionBlock>

      <Show when={error()}>
        <div class="bg-red-50 dark:bg-red-500/10 border border-red-500/30 dark:border-red-500/50 rounded p-4 text-sm text-red-700 dark:text-red-300">
          {error()}
        </div>
      </Show>

      <Show when={success()}>
        <div class="bg-green-50 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/50 rounded p-4 text-sm text-green-700 dark:text-green-300">
          {success()}
        </div>
      </Show>

      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{i18nStore.t('backup.pocketbaseBackups')}</h2>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating() || loading()}
            class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50 flex items-center gap-2`}
          >
            <Plus size={16} />
            {creating() ? i18nStore.t('backup.creating') : i18nStore.t('backup.createBackup')}
          </button>
        </div>

        <Show when={loading()}>
          <div class="text-gray-500 dark:text-gray-400">{i18nStore.t('backup.loading')}</div>
        </Show>

        <Show when={!loading()}>
          <Table columns={columns()} data={backups() as unknown as Record<string, unknown>[]} emptyMessage={i18nStore.t('backup.empty')} />
        </Show>
      </div>

      <form
        onSubmit={handleSaveAuto}
        class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4 border border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center gap-3">
          <CalendarClock size={20} class="text-gray-500 dark:text-gray-400" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{i18nStore.t('backup.automaticBackups')}</h2>
        </div>

        <div class="flex items-center gap-3">
          <input
            id="auto-backup-enabled"
            type="checkbox"
            checked={autoEnabled()}
            onChange={(e) => setAutoEnabled(e.currentTarget.checked)}
            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label for="auto-backup-enabled" class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {i18nStore.t('backup.enableScheduled')}
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('backup.cronExpression')}</label>
            <input
              type="text"
              value={cron()}
              onInput={(e) => setCron(e.currentTarget.value)}
              disabled={!autoEnabled()}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="0 0 * * *"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{i18nStore.t('backup.cronHint')}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('backup.maxKeep')}</label>
            <input
              type="number"
              min={0}
              value={cronMaxKeep()}
              onInput={(e) => setCronMaxKeep(Number(e.currentTarget.value))}
              disabled={!autoEnabled()}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{i18nStore.t('backup.maxKeepHint')}</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={savingAuto()}
          class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50 flex items-center gap-2`}
        >
          <Save size={16} />
          {savingAuto() ? i18nStore.t('settings.saving') : i18nStore.t('backup.saveAutoSettings')}
        </button>
      </form>
    </div>
  );
}
