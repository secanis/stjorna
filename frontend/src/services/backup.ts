import { pb } from '~/services/pocketbase';

export type BackupSource = 'v1' | 'v3';

export interface ImportStats {
  created: { categories: number; products: number; media: number };
  updated: { categories: number; products: number; media: number };
  warnings: string[];
}

export interface ImportResult {
  success: boolean;
  stats: ImportStats;
  error?: string;
}

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Downloads a tenant-scoped ZIP backup (categories, products, media).
// Full-instance disaster recovery should use PocketBase's built-in
// /api/backups endpoint from the admin UI.
export async function downloadTenantBackup(tenantId: string): Promise<void> {
  const url = pb.buildUrl(`/api/stjorna/export/${tenantId}`);
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: pb.authStore.token },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`download failed: ${res.status} ${text}`);
  }
  const blob = await res.blob();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  triggerDownload(blob, `stjorna-export-${tenantId}-${ts}.zip`);
}

export async function importBackup(args: {
  source: BackupSource;
  file: File;
  tenantId: string;
}): Promise<ImportResult> {
  const { source, file, tenantId } = args;
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(pb.buildUrl(`/api/stjorna/import/${tenantId}?source=${source}`), {
    method: 'POST',
    headers: {
      Authorization: pb.authStore.token,
    },
    body: form,
  });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text };
  }
  if (!res.ok) {
    return {
      success: false,
      stats: { created: { categories: 0, products: 0, media: 0 }, updated: { categories: 0, products: 0, media: 0 }, warnings: [] },
      error: body.error || `import failed: ${res.status}`,
    };
  }
  return body as ImportResult;
}
