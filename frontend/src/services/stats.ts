import { pb } from './pocketbase';

export interface StatsTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  custom_domain: string;
}

export interface LargestMedia {
  id: string;
  filename: string;
  bytes: number;
  mime_type: string;
}

export interface MimeBreakdown {
  mime_type: string;
  count: number;
  bytes: number;
}

export interface StatsSnapshot {
  ok: true;
  tenant: StatsTenant;
  counts: {
    categories: number;
    products: number;
    media: number;
    users: number;
  };
  storage: {
    media_bytes: number;
    media_count: number;
    avg_media_bytes: number;
    largest_media: LargestMedia | null;
    by_mime_type: MimeBreakdown[];
  };
  activity_30d: {
    products_created: number;
    products_updated: number;
    media_uploaded: number;
    categories_created: number;
  };
  generated_at: string;
}

export interface StatsError {
  ok: false;
  error: { code: number; message: string };
}

function formatBytes(n: number): string {
  if (!n || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  if (gb < 1024) return `${gb.toFixed(2)} GB`;
  const tb = gb / 1024;
  return `${tb.toFixed(2)} TB`;
}

function friendlyMime(m: string): string {
  if (!m) return 'unknown';
  if (m.startsWith('image/')) return m.replace('image/', '').toUpperCase() + ' image';
  if (m.startsWith('video/')) return m.replace('video/', '').toUpperCase() + ' video';
  return m;
}

export async function fetchMyStats(): Promise<StatsSnapshot> {
  // Tenant user: no query param — hook reads the tenant from the JWT.
  try {
    const r = await pb.send('/api/stjorna/stats', { method: 'GET' });
    return r as StatsSnapshot;
  } catch (e: any) {
    const detail = e?.response?.message || e?.message || 'unknown error';
    throw new Error(`stats (me): ${detail}`);
  }
}

export async function fetchTenantStats(tenantId: string): Promise<StatsSnapshot> {
  try {
    const r = await pb.send('/api/stjorna/stats?tenant=' + encodeURIComponent(tenantId), { method: 'GET' });
    return r as StatsSnapshot;
  } catch (e: any) {
    const detail = e?.response?.message || e?.message || 'unknown error';
    throw new Error(`stats (${tenantId}): ${detail}`);
  }
}

export const StatsFormatting = { formatBytes, friendlyMime };
