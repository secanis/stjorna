import { createSignal, Show } from 'solid-js';
import type { BackupSource, ImportResult } from '~/services/backup';
import { importBackup } from '~/services/backup';
import { Upload, FileWarning, CheckCircle2 } from 'lucide-solid';
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
    <div class="bg-gray-800 rounded-lg p-6 space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-white">Restore Backup</h2>
        <p class="text-sm text-gray-400 mt-1">
          Import content from a backup file into this tenant. Records that already exist
          (same category/product slug) are skipped. v1 imports drop <code>users</code>,{' '}
          <code>services</code> and <code>cronjobs</code> by design.
        </p>
      </div>

      <form onSubmit={handleImport} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Backup source</label>
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
              <span class="text-sm text-gray-200">Old STJÓRNA (v1)</span>
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
              <span class="text-sm text-gray-200">STJÓRNA v3 (current)</span>
            </label>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">Backup file</label>
          <input
            type="file"
            accept=".json,.zip"
            onChange={onFileChange}
            class="block w-full text-sm text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
          />
        </div>

        <div class="flex items-center gap-3">
          <button
            type="submit"
            disabled={importing() || !file()}
            class={`${PRIMARY_BUTTON_CLASSES} text-white font-medium py-2 px-4 rounded disabled:opacity-50 flex items-center gap-2`}
          >
            <Upload size={14} />
            {importing() ? 'Importing…' : 'Import'}
          </button>
          <Show when={file()}>
            <span class="text-xs text-gray-400">
              {file()!.name} ({Math.round(file()!.size / 1024)} KB)
            </span>
          </Show>
        </div>
      </form>

      <Show when={error()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-3 text-red-400 text-sm flex items-start gap-2">
          <FileWarning size={16} class="mt-0.5 flex-shrink-0" />
          <span>{error()}</span>
        </div>
      </Show>

      <Show when={result()?.success}>
        <div class="bg-green-500/10 border border-green-500 rounded p-3 text-green-300 text-sm space-y-1">
          <div class="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            <span>
              Imported {result()!.stats.imported.categories} categories,{' '}
              {result()!.stats.imported.products} products
              <Show when={result()!.stats.imported.media > 0}>
                , {result()!.stats.imported.media} media
              </Show>
              .
            </span>
          </div>
          <Show when={result()!.stats.skipped.categories + result()!.stats.skipped.products > 0}>
            <div class="text-gray-400 text-xs pl-6">
              Skipped {result()!.stats.skipped.categories} categories,{' '}
              {result()!.stats.skipped.products} products (already exist).
            </div>
          </Show>
          <Show when={result()!.stats.warnings.length > 0}>
            <div class="text-yellow-300 text-xs pl-6 space-y-0.5">
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
