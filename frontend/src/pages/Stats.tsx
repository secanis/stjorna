import { createSignal, Show, createEffect, on, For } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Package, Folder, Image, Users, HardDrive, Clock, BarChart3, RefreshCw } from 'lucide-solid';
import type { LucideIcon } from 'lucide-solid';
import { authStore } from '~/stores/auth';
import { tenantStore } from '~/stores/tenant';
import { fetchMyStats, fetchTenantStats, type StatsSnapshot, StatsFormatting } from '~/services/stats';
import { i18nStore } from '~/i18n';

export default function Stats() {
    const [snapshot, setSnapshot] = createSignal<StatsSnapshot | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);

    // Sequence guard: ignore responses from a superseded load (tenant
    // switched or Refresh clicked while a request was in flight).
    let loadSeq = 0;
    const load = async () => {
        const seq = ++loadSeq;
        const isCurrent = () => seq === loadSeq;
        setLoading(true);
        setError(null);
        try {
            // Admin → pass current tenant. Tenant user → server uses JWT.
            if (authStore.isPBAdmin) {
                // For admin, /stats reads current tenant (if any). Fall back to fetching
                // the first tenant so the page isn't empty.
                const tenant = (() => {
                    try {
                        return localStorage.getItem('stjorna_current_tenant') || '';
                    } catch {
                        return '';
                    }
                })();
                if (!tenant) {
                    throw new Error(i18nStore.t('stats.pickTenant'));
                }
                const snap = await fetchTenantStats(tenant);
                if (isCurrent()) setSnapshot(snap);
            } else {
                const snap = await fetchMyStats();
                if (isCurrent()) setSnapshot(snap);
            }
        } catch (e: unknown) {
            if (isCurrent()) setError(e instanceof Error ? e.message : String(e));
        } finally {
            if (isCurrent()) setLoading(false);
        }
    };

    // Initial load plus a refetch whenever the active tenant changes.
    createEffect(on(() => tenantStore.version, () => { void load(); }));

    const fmt = StatsFormatting.formatBytes;
    const friendly = StatsFormatting.friendlyMime;

    return (
        <div class="space-y-6">
            <div class="flex items-start justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart3 size={22} /> {i18nStore.t('stats.title')}
                    </h1>
                    <Show when={snapshot()}>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {snapshot()!.tenant.name} · {i18nStore.t('stats.plan')}: <span class="font-medium text-gray-900 dark:text-gray-100">{snapshot()!.tenant.plan}</span>
                            {' · '}
                            {i18nStore.t('stats.snapshotTaken')} <span class="text-gray-900 dark:text-gray-100">{new Date(snapshot()!.generated_at).toLocaleString()}</span>
                        </p>
                    </Show>
                </div>
                <button onClick={() => load()} disabled={loading()} class="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                    <RefreshCw size={14} class={loading() ? 'animate-spin' : ''} /> {i18nStore.t('stats.refresh')}
                </button>
            </div>

            <Show when={error()}>
                <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
                    <div class="font-medium mb-1">{i18nStore.t('stats.failedToLoad')}</div>
                    <code class="text-xs break-all">{error()}</code>
                </div>
            </Show>

            <Show when={loading() && !snapshot()}>
                <div class="text-gray-500 dark:text-gray-400">{i18nStore.t('common.loading')}</div>
            </Show>

            <Show when={snapshot()}>
                <SnapshotView s={snapshot()!} fmt={fmt} friendly={friendly} />
            </Show>
        </div>
    );
}

function SnapshotView(props: { s: StatsSnapshot; fmt: (n: number) => string; friendly: (m: string) => string }) {
    const s = () => props.s;
    const maxMimeBytes = () => s().storage.by_mime_type.reduce((m, x) => Math.max(m, x.bytes), 0) || 1;
    const maxMimeCount = () => s().storage.by_mime_type.reduce((m, x) => Math.max(m, x.count), 0) || 1;
    const largestValue = () => {
        const lm = s().storage.largest_media;
        return lm ? props.fmt(lm.bytes) : '—';
    };
    const largestSub = () => {
        const lm = s().storage.largest_media;
        return lm
            ? `${lm.filename || i18nStore.t('stats.unnamed')} · ${props.friendly(lm.mime_type)}`
            : i18nStore.t('stats.noMediaUploaded');
    };

    return (
        <>
            {/* Counts */}
            <section>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{i18nStore.t('stats.records')}</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <CountCard icon={Package} label={i18nStore.t('common.products')} value={s().counts.products} colorClass="text-blue-600 dark:text-blue-400" />
                    <CountCard icon={Folder} label={i18nStore.t('common.categories')} value={s().counts.categories} colorClass="text-green-600 dark:text-green-400" />
                    <CountCard icon={Image} label={i18nStore.t('common.media')} value={s().counts.media} colorClass="text-purple-600 dark:text-purple-400" />
                    <CountCard icon={Users} label={i18nStore.t('common.users')} value={s().counts.users} colorClass="text-orange-600 dark:text-orange-400" />
                </div>
            </section>

            {/* Storage */}
            <section>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{i18nStore.t('stats.storage')}</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <BigStat icon={HardDrive} label={i18nStore.t('stats.totalMedia')} value={props.fmt(s().storage.media_bytes)} sub={i18nStore.t('stats.files', { n: s().storage.media_count })} />
                    <BigStat icon={BarChart3} label={i18nStore.t('stats.averageFileSize')} value={props.fmt(s().storage.avg_media_bytes)} sub={i18nStore.t('stats.across', { n: s().storage.media_count })} />
                    <BigStat
                        icon={Image}
                        label={i18nStore.t('stats.largestFile')}
                        value={largestValue()}
                        sub={largestSub()}
                    />
                </div>

                {/* Per-mime breakdown */}
                <Show when={s().storage.by_mime_type.length > 0}>
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 mt-4">
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{i18nStore.t('stats.byFileType')}</h3>
                        <div class="space-y-2">
                            <For each={s().storage.by_mime_type}>{(m) => (
                                <div>
                                    <div class="flex items-center justify-between text-xs mb-1">
                                        <span class="text-gray-900 dark:text-gray-100">{props.friendly(m.mime_type)}</span>
                                        <span class="text-gray-500 dark:text-gray-400">
                                            {i18nStore.t('stats.files', { n: m.count })} · {props.fmt(m.bytes)}
                                        </span>
                                    </div>
                                    <div class="flex gap-1">
                                        <div class="bg-blue-500 h-2 rounded-l" style={{ width: `${(m.bytes / maxMimeBytes()) * 100}%`, 'min-width': '2px' }} title={`${props.fmt(m.bytes)}`} />
                                        <div class="bg-blue-300 dark:bg-blue-700 h-2 rounded-r" style={{ width: `${(m.count / maxMimeCount()) * 100 - (m.bytes / maxMimeBytes()) * 100}%`, 'min-width': '0' }} title={i18nStore.t('stats.files', { n: m.count })} />
                                    </div>
                                </div>
                            )}</For>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">{i18nStore.t('stats.solidBarLegend')}</p>
                    </div>
                </Show>
            </section>

            {/* Activity */}
            <section>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Clock size={16} /> {i18nStore.t('stats.last30Days')}
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <CountCard icon={Package} label={i18nStore.t('stats.productsCreated')} value={s().activity_30d.products_created} colorClass="text-blue-600 dark:text-blue-400" />
                    <CountCard icon={Package} label={i18nStore.t('stats.productsUpdated')} value={s().activity_30d.products_updated} colorClass="text-blue-400 dark:text-blue-500" />
                    <CountCard icon={Image} label={i18nStore.t('stats.mediaUploaded')} value={s().activity_30d.media_uploaded} colorClass="text-purple-600 dark:text-purple-400" />
                    <CountCard icon={Folder} label={i18nStore.t('stats.categoriesCreated')} value={s().activity_30d.categories_created} colorClass="text-green-600 dark:text-green-400" />
                </div>
            </section>
        </>
    );
}

function CountCard(props: { icon: LucideIcon; label: string; value: number; colorClass: string }) {
    return (
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div class="flex items-center gap-3">
                <Dynamic component={props.icon} size={22} class={props.colorClass} />
                <div>
                    <div class="text-2xl font-bold text-gray-900 dark:text-white">{props.value}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">{props.label}</div>
                </div>
            </div>
        </div>
    );
}

function BigStat(props: { icon: LucideIcon; label: string; value: string; sub: string }) {
    return (
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4">
            <div class="flex items-center gap-3">
                <Dynamic component={props.icon} size={22} class="text-gray-500 dark:text-gray-400" />
                <div class="min-w-0">
                    <div class="text-xs text-gray-500 dark:text-gray-400">{props.label}</div>
                    <div class="text-xl font-semibold text-gray-900 dark:text-white truncate">{props.value}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate" title={props.sub}>
                        {props.sub}
                    </div>
                </div>
            </div>
        </div>
    );
}
