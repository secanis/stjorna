import { createSignal, Show, onMount, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';
import DescriptionBlock from '~/components/settings/DescriptionBlock';
import Table, { Column } from '~/components/ui/Table';
import { Database, Plus, Download, Trash2, Save, CalendarClock } from 'lucide-solid';

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
    await authStore.init();
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
    } catch (e: any) {
      console.warn('Failed to load backup settings:', e.message);
    }
  });

  const loadBackups = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await pb.backups.getFullList();
      setBackups(list as Backup[]);
    } catch (e: any) {
      setError(e.message || 'Failed to load backups');
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
      showSuccess('Backup created successfully.');
    } catch (e: any) {
      setError(e.message || 'Failed to create backup');
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
    } catch (e: any) {
      setError(e.message || 'Failed to start download');
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete backup "${key}"? This cannot be undone.`)) return;
    setError('');
    try {
      await pb.backups.delete(key);
      await loadBackups();
      showSuccess('Backup deleted.');
    } catch (e: any) {
      setError(e.message || 'Failed to delete backup');
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
      showSuccess('Automatic backup settings saved.');
    } catch (e: any) {
      setError(e.message || 'Failed to save automatic backup settings');
    } finally {
      setSavingAuto(false);
    }
  };

  const columns: Column[] = [
    { key: 'key', label: 'Backup' },
    {
      key: 'size',
      label: 'Size',
      render: (_v, row) => formatBytes(row.size),
    },
    {
      key: 'modified',
      label: 'Created',
      render: (_v, row) => formatDate(row.modified),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_v, row) => (
        <div class="flex items-center gap-3">
          <button
            onClick={() => handleDownload(row.key)}
            class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            title="Download"
          >
            <Download size={14} /> Download
          </button>
          <button
            onClick={() => handleDelete(row.key)}
            class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
            title="Delete"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div class="space-y-6 max-w-3xl">
      <div class="flex items-center gap-3">
        <Database size={24} class="text-gray-500 dark:text-gray-400" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Backups</h1>
      </div>

      <DescriptionBlock>
        <p>Create and download full PocketBase backups.</p>
        <p>
          These backups contain the entire database and uploaded files. Only superusers can create or
          download them.
        </p>
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
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">PocketBase Backups</h2>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating() || loading()}
            class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50 flex items-center gap-2`}
          >
            <Plus size={16} />
            {creating() ? 'Creating...' : 'Create Backup'}
          </button>
        </div>

        <Show when={loading()}>
          <div class="text-gray-500 dark:text-gray-400">Loading backups...</div>
        </Show>

        <Show when={!loading()}>
          <Table columns={columns} data={backups()} emptyMessage="No backups found" />
        </Show>
      </div>

      <form
        onSubmit={handleSaveAuto}
        class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4 border border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center gap-3">
          <CalendarClock size={20} class="text-gray-500 dark:text-gray-400" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Automatic Backups</h2>
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
            Enable scheduled backups
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cron expression</label>
            <input
              type="text"
              value={cron()}
              onInput={(e) => setCron(e.currentTarget.value)}
              disabled={!autoEnabled()}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="0 0 * * *"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">UTC timezone. Empty disables auto backups.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max backups to keep</label>
            <input
              type="number"
              min={0}
              value={cronMaxKeep()}
              onInput={(e) => setCronMaxKeep(Number(e.currentTarget.value))}
              disabled={!autoEnabled()}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Oldest cron-generated backups are deleted first.</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={savingAuto()}
          class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50 flex items-center gap-2`}
        >
          <Save size={16} />
          {savingAuto() ? 'Saving...' : 'Save Auto Backup Settings'}
        </button>
      </form>
    </div>
  );
}
