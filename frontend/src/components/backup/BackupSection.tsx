import { createSignal, Show } from 'solid-js';
import type { BackupSource, ImportResult } from '~/services/backup';
import { downloadTenantBackup, importBackup } from '~/services/backup';
import { Download, Upload, FileWarning, CheckCircle2 } from 'lucide-solid';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

interface Props {
  tenantId: string;
}

export default function BackupSection(props: Props) {
  const [source, setSource] = createSignal<BackupSource>('v3');
  const [file, setFile] = createSignal<File | null>(null);
  const [importing, setImporting] = createSignal(false);
  const [result, setResult] = createSignal<ImportResult | null>(null);
  const [error, setError] = createSignal('');
  const [downloading, setDownloading] = createSignal(false);
  const [downloadError, setDownloadError] = createSignal('');

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadTenantBackup(props.tenantId);
    } catch (err: any) {
      setDownloadError(err.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const onFileChange = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0] || null;
    setFile(f);
    setResult(null);
    setError('');
  };

  const handleImport = async (e: Event) => {
    e.preventDefault();
    const f = file();
    if (!f) {
      setError('Please choose a backup file');
      return;
    }
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const r = await importBackup({ source: source(), file: f, tenantId: props.tenantId });
      if (!r.success) setError(r.error || 'Import failed');
      setResult(r);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Backup</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Download a ZIP of this tenant's categories, products and media.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading()}
          class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50 flex items-center gap-2 shrink-0`}
        >
          <Download size={14} />
          {downloading() ? 'Downloading…' : 'Download ZIP'}
        </button>
      </div>

      <Show when={downloadError()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-3 text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
          <FileWarning size={16} class="mt-0.5 flex-shrink-0" />
          <span>{downloadError()}</span>
        </div>
      </Show>

      <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Restore Backup</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Import content from a backup file into this tenant. Records that already exist
          (same category/product slug) are skipped. v1 imports drop <code>users</code>,{' '}
          <code>services</code> and <code>cronjobs</code> by design.
        </p>
      </div>

      <form onSubmit={handleImport} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup source</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="backup-source"
                value="v1"
                checked={source() === 'v1'}
                onChange={() => setSource('v1')}
                class="text-blue-600 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-800 dark:text-gray-200">Old STJÓRNA (v1)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="backup-source"
                value="v3"
                checked={source() === 'v3'}
                onChange={() => setSource('v3')}
                class="text-blue-600 focus:ring-blue-500"
              />
              <span class="text-sm text-gray-800 dark:text-gray-200">STJÓRNA v3 (current)</span>
            </label>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup file</label>
          <input
            type="file"
            accept=".json,.zip"
            onChange={onFileChange}
            class="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-50 dark:bg-gray-700 file:text-gray-800 dark:text-gray-200 hover:file:bg-gray-100 dark:bg-gray-600"
          />
        </div>

        <div class="flex items-center gap-3">
          <button
            type="submit"
            disabled={importing() || !file()}
            class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50 flex items-center gap-2`}
          >
            <Upload size={14} />
            {importing() ? 'Importing…' : 'Import'}
          </button>
          <Show when={file()}>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {file()!.name} ({Math.round(file()!.size / 1024)} KB)
            </span>
          </Show>
        </div>
      </form>

      <Show when={error()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-3 text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
          <FileWarning size={16} class="mt-0.5 flex-shrink-0" />
          <span>{error()}</span>
        </div>
      </Show>

      <Show when={result()?.success}>
        <div class="bg-green-500/10 border border-green-500 rounded p-3 text-green-700 dark:text-green-300 text-sm space-y-1">
          <div class="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            <span>
              Imported {result()!.stats.created.categories} categories,{' '}
              {result()!.stats.created.products} products
              <Show when={result()!.stats.created.media > 0}>
                , {result()!.stats.created.media} media
              </Show>
              .
            </span>
          </div>
          <Show when={result()!.stats.updated.categories + result()!.stats.updated.products + result()!.stats.updated.media > 0}>
            <div class="text-gray-500 dark:text-gray-400 text-xs pl-6">
              Updated {result()!.stats.updated.categories} categories,{' '}
              {result()!.stats.updated.products} products
              <Show when={result()!.stats.updated.media > 0}>
                , {result()!.stats.updated.media} media
              </Show>{' '}
              (already exist).
            </div>
          </Show>
          <Show when={result()!.stats.warnings.length > 0}>
            <div class="text-yellow-700 dark:text-yellow-300 text-xs pl-6 space-y-0.5">
              {result()!.stats.warnings.map((w) => (
                <div>⚠ {w}</div>
              ))}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
