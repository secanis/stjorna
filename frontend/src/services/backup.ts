import { pb } from '~/services/pocketbase';

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

// Imports a v3 backup ZIP (as produced by downloadTenantBackup). Legacy v1
// JSON exports are no longer accepted by the UI; the API still supports
// ?source=v1 for scripted migrations.
export async function importBackup(args: {
  file: File;
  tenantId: string;
}): Promise<ImportResult> {
  const { file, tenantId } = args;
  const arrayBuffer = await file.arrayBuffer();

  const res = await fetch(pb.buildUrl(`/api/stjorna/import/${tenantId}`), {
    method: 'POST',
    headers: {
      Authorization: pb.authStore.token,
      'Content-Type': 'application/zip',
    },
    body: arrayBuffer,
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
      error: body.error?.message || body.message || `import failed: ${res.status}`,
    };
  }
  return body as ImportResult;
}
