import { pb } from '~/services/pocketbase';

export type BackupFormat = 'json' | 'zip';
export type BackupSource = 'v1' | 'v3';

export interface ImportStats {
  imported: { categories: number; products: number; media: number };
  skipped: { categories: number; products: number; media: number };
  warnings: string[];
}

export interface ImportResult {
  success: boolean;
  stats: ImportStats;
  error?: string;
}

const arrayBufferToBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
};

const fileToBase64 = (file: File): Promise<string> =>
  file.arrayBuffer().then(arrayBufferToBase64);

// Defensive UTF-8 preflight: read the file as text with explicit UTF-8
// decoding and (for v1 JSON) parse to make sure we don't ship mojibake
// to the backend. The PB hook also decodes UTF-8, so this is belt +
// suspenders — catches corrupt or wrongly-encoded files early with a
// user-friendly error.
const validateUtf8File = async (file: File, source: BackupSource): Promise<void> => {
  if (typeof TextDecoder === 'undefined') {
    return; // very old browser; let the backend catch the issue
  }
  const buf = await file.arrayBuffer();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    const text = decoder.decode(buf);
    if (source === 'v1' || file.name.toLowerCase().endsWith('.json')) {
      JSON.parse(text);
    }
  } catch (e: any) {
    throw new Error(
      `File is not valid UTF-8${source === 'v1' || file.name.toLowerCase().endsWith('.json') ? ' JSON' : ''}: ${e.message || 'decode failed'}. ` +
      `If this is an old STJÓRNA export, re-export it from a machine with a UTF-8 locale.`
    );
  }
};

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

export async function downloadBackup(format: BackupFormat): Promise<void> {
  const url = `${pb.baseUrl}/api/backup/${format}`;
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
  triggerDownload(blob, `stjorna-backup-${ts}.${format}`);
}

export async function importBackup(args: {
  source: BackupSource;
  file: File;
  tenantId: string;
}): Promise<ImportResult> {
  const { source, file, tenantId } = args;
  await validateUtf8File(file, source);
  const data_base64 = await fileToBase64(file);
  const res = await fetch(`${pb.baseUrl}/api/backup/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pb.authStore.token,
    },
    body: JSON.stringify({
      tenant: tenantId,
      source,
      filename: file.name,
      data_base64,
    }),
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
      stats: { imported: { categories: 0, products: 0, media: 0 }, skipped: { categories: 0, products: 0, media: 0 }, warnings: [] },
      error: body.error || `import failed: ${res.status}`,
    };
  }
  return body as ImportResult;
}
