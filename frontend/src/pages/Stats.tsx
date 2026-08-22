import { createSignal, Show, onMount, createEffect } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import {
  Package, Folder, Image, Users, Building2, HardDrive, Clock, BarChart3, RefreshCw,
} from 'lucide-solid';
import { authStore } from '~/stores/auth';
import { tenantStore } from '~/stores/tenant';
import {
  fetchMyStats, fetchTenantStats,
  type StatsSnapshot,
  StatsFormatting,
} from '~/services/stats';

export default function Stats() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = createSignal<StatsSnapshot | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Admin → pass current tenant. Tenant user → server uses JWT.
      if (authStore.isPBAdmin) {
        // For admin, /stats reads current tenant (if any). Fall back to fetching
        // the first tenant so the page isn't empty.
        const tenant = (() => { try { return localStorage.getItem('stjorna_current_tenant') || ''; } catch { return ''; } })();
        if (!tenant) {
          throw new Error('Pick a tenant from the header to view its stats.');
        }
        setSnapshot(await fetchTenantStats(tenant));
      } else {
        setSnapshot(await fetchMyStats());
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await authStore.init();
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    await load();
  });

  createEffect(() => {
    // Refetch when the active tenant changes (PB admin scenario).
    tenantStore.version;
    if (!authStore.isAuthenticated()) return;
    load();
  });

  const fmt = StatsFormatting.formatBytes;
  const friendly = StatsFormatting.friendlyMime;

  return (
    <div class="space-y-6">
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={22} /> Statistics
          </h1>
          <Show when={snapshot()}>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {snapshot()!.tenant.name} · plan:{' '}
              <span class="font-medium text-gray-900 dark:text-gray-100">{snapshot()!.tenant.plan}</span>
              {' · '}
              snapshot taken{' '}
              <span class="text-gray-900 dark:text-gray-100">{new Date(snapshot()!.generated_at).toLocaleString()}</span>
            </p>
          </Show>
        </div>
        <button
          onClick={() => load()}
          disabled={loading()}
          class="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw size={14} class={loading() ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <Show when={error()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
          <div class="font-medium mb-1">Failed to load stats</div>
          <code class="text-xs break-all">{error()}</code>
        </div>
      </Show>

      <Show when={loading() && !snapshot()}>
        <div class="text-gray-500 dark:text-gray-400">Loading…</div>
      </Show>

      <Show when={snapshot()}>
        <SnapshotView s={snapshot()!} fmt={fmt} friendly={friendly} />
      </Show>
    </div>
  );
}

function SnapshotView(props: { s: StatsSnapshot; fmt: (n: number) => string; friendly: (m: string) => string }) {
  const s = props.s;
  const maxMimeBytes = () => s.storage.by_mime_type.reduce((m, x) => Math.max(m, x.bytes), 0) || 1;
  const maxMimeCount = () => s.storage.by_mime_type.reduce((m, x) => Math.max(m, x.count), 0) || 1;

  return (
    <>
      {/* Counts */}
      <section>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Records</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CountCard icon={Package} label="Products" value={s.counts.products} colorClass="text-blue-600 dark:text-blue-400" />
          <CountCard icon={Folder} label="Categories" value={s.counts.categories} colorClass="text-green-600 dark:text-green-400" />
          <CountCard icon={Image} label="Media" value={s.counts.media} colorClass="text-purple-600 dark:text-purple-400" />
          <CountCard icon={Users} label="Users" value={s.counts.users} colorClass="text-orange-600 dark:text-orange-400" />
        </div>
      </section>

      {/* Storage */}
      <section>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Storage</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BigStat
            icon={HardDrive}
            label="Total media"
            value={props.fmt(s.storage.media_bytes)}
            sub={`${s.storage.media_count} files`}
          />
          <BigStat
            icon={BarChart3}
            label="Average file size"
            value={props.fmt(s.storage.avg_media_bytes)}
            sub={`across ${s.storage.media_count} files`}
          />
          <BigStat
            icon={Image}
            label="Largest file"
            value={s.storage.largest_media ? props.fmt(s.storage.largest_media.bytes) : '—'}
            sub={s.storage.largest_media ? `${s.storage.largest_media.filename || 'unnamed'} · ${props.friendly(s.storage.largest_media.mime_type)}` : 'no media uploaded'}
          />
        </div>

        {/* Per-mime breakdown */}
        <Show when={s.storage.by_mime_type.length > 0}>
          <div class="bg-white dark:bg-gray-800 rounded-lg p-4 mt-4">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">By file type</h3>
            <div class="space-y-2">
              {s.storage.by_mime_type.map((m) => (
                <div>
                  <div class="flex items-center justify-between text-xs mb-1">
                    <span class="text-gray-900 dark:text-gray-100">{props.friendly(m.mime_type)}</span>
                    <span class="text-gray-500 dark:text-gray-400">
                      {m.count} files · {props.fmt(m.bytes)}
                    </span>
                  </div>
                  <div class="flex gap-1">
                    <div
                      class="bg-blue-500 h-2 rounded-l"
                      style={{ width: `${(m.bytes / maxMimeBytes()) * 100}%`, 'min-width': '2px' }}
                      title={`${props.fmt(m.bytes)}`}
                    />
                    <div
                      class="bg-blue-300 dark:bg-blue-700 h-2 rounded-r"
                      style={{ width: `${((m.count / maxMimeCount()) * 100) - ((m.bytes / maxMimeBytes()) * 100)}%`, 'min-width': '0' }}
                      title={`${m.count} files`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Solid bar = share of total bytes. Striped bar = share of file count.
            </p>
          </div>
        </Show>
      </section>

      {/* Activity */}
      <section>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Clock size={16} /> Last 30 days
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CountCard icon={Package} label="Products created" value={s.activity_30d.products_created} colorClass="text-blue-600 dark:text-blue-400" />
          <CountCard icon={Package} label="Products updated" value={s.activity_30d.products_updated} colorClass="text-blue-400 dark:text-blue-500" />
          <CountCard icon={Image} label="Media uploaded" value={s.activity_30d.media_uploaded} colorClass="text-purple-600 dark:text-purple-400" />
          <CountCard icon={Folder} label="Categories created" value={s.activity_30d.categories_created} colorClass="text-green-600 dark:text-green-400" />
        </div>
      </section>
    </>
  );
}

function CountCard(props: { icon: any; label: string; value: number; colorClass: string }) {
  const Icon = props.icon;
  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg p-4">
      <div class="flex items-center gap-3">
        <Icon size={22} class={props.colorClass} />
        <div>
          <div class="text-2xl font-bold text-gray-900 dark:text-white">{props.value}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{props.label}</div>
        </div>
      </div>
    </div>
  );
}

function BigStat(props: { icon: any; label: string; value: string; sub: string }) {
  const Icon = props.icon;
  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg p-4">
      <div class="flex items-center gap-3">
        <Icon size={22} class="text-gray-500 dark:text-gray-400" />
        <div class="min-w-0">
          <div class="text-xs text-gray-500 dark:text-gray-400">{props.label}</div>
          <div class="text-xl font-semibold text-gray-900 dark:text-white truncate">{props.value}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 truncate" title={props.sub}>{props.sub}</div>
        </div>
      </div>
    </div>
  );
}
