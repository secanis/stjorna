import { createSignal } from 'solid-js';

export interface ApiCall {
  id: number;
  method: string;
  path: string;
  status: number | null;
  durationMs: number;
  ok: boolean;
  itemCount: number | null;
  error?: string;
  time: number;
}

const [calls, setCalls] = createSignal<ApiCall[]>([]);
export const apiCalls = calls;

let nextId = 1;
let patched = false;

function record(call: ApiCall) {
  setCalls((prev) => [call, ...prev].slice(0, 30));
}

export function startApiLog() {
  if (patched || typeof window === 'undefined') return;
  patched = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const req = args[0] as RequestInfo | URL;
    const init = args[1] as RequestInit | undefined;
    const urlStr =
      typeof req === 'string'
        ? req
        : req instanceof URL
        ? req.toString()
        : req.url;
    const method = (init?.method || (typeof req !== 'string' && !(req instanceof URL) ? req.method : 'GET') || 'GET').toUpperCase();
    const path = urlStr.startsWith('http') ? new URL(urlStr).pathname + new URL(urlStr).search : urlStr;

    // Only log STJÓRNA traffic.
    const isApi = path.startsWith('/api/') || path.includes('/api/');

    const started = performance.now();
    try {
      const res = await origFetch(...args);
      const ms = Math.round(performance.now() - started);
      if (isApi) {
        let itemCount: number | null = null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          try {
            const clone = res.clone();
            const data = await clone.json();
            if (Array.isArray(data?.items)) itemCount = data.items.length;
            else if (Array.isArray(data)) itemCount = data.length;
          } catch {}
        }
        record({
          id: nextId++,
          method,
          path,
          status: res.status,
          durationMs: ms,
          ok: res.ok,
          itemCount,
          time: Date.now(),
        });
      }
      return res;
    } catch (e: any) {
      const ms = Math.round(performance.now() - started);
      if (isApi) {
        record({
          id: nextId++,
          method,
          path,
          status: null,
          durationMs: ms,
          ok: false,
          itemCount: null,
          error: e?.message || 'fetch failed',
          time: Date.now(),
        });
      }
      throw e;
    }
  };
}

export function clearApiLog() {
  setCalls([]);
}
