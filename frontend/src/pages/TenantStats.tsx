import { createSignal, Show, onMount, createEffect, on } from 'solid-js';
import { useNavigate, useParams, A } from '@solidjs/router';
import { Package, Folder, Image, Users, HardDrive, Clock, BarChart3, RefreshCw, ArrowLeft } from 'lucide-solid';
import { authStore } from '~/stores/auth';
import { fetchTenantStats, type StatsSnapshot, StatsFormatting } from '~/services/stats';
import { pb } from '~/services/pocketbase';
import { i18nStore } from '~/i18n';

export default function TenantStats() {
    const navigate = useNavigate();
    const params = useParams<{ id: string }>();
    const [snapshot, setSnapshot] = createSignal<StatsSnapshot | null>(null);
    const [tenantName, setTenantName] = createSignal<string>('');
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);

    // Sequence guard: a response for a previous tenant id (SPA nav) or
    // a superseded Refresh never overwrites the current state.
    let loadSeq = 0;
    const load = async () => {
        const id = params.id;
        if (!id || !authStore.isPBAdmin) return;
        const seq = ++loadSeq;
        const isCurrent = () => seq === loadSeq;
        setLoading(true);
        setError(null);
        try {
            const [tenant, snap] = await Promise.all([
                pb.collection('tenants').getOne(id).catch(() => null),
                fetchTenantStats(id),
            ]);
            if (!isCurrent()) return;
            if (tenant) setTenantName(String((tenant as any).name || id));
            setSnapshot(snap);
        } catch (e: any) {
            if (isCurrent()) setError(String(e?.message || e));
        } finally {
            if (isCurrent()) setLoading(false);
        }
    };

    onMount(() => {
        if (!authStore.isPBAdmin) {
            // Non-admin landed here — bounce them.
            navigate('/', { replace: true });
        }
    });

    // Initial load plus a refetch if the URL id changes (SPA nav).
    createEffect(on(() => params.id, () => { void load(); }));

    const fmt = StatsFormatting.formatBytes;
    const friendly = StatsFormatting.friendlyMime;

    return (
        <div class="space-y-6">
            <div class="flex items-start justify-between">
                <div>
                    <A href="/tenants" class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                        <ArrowLeft size={14} /> {i18nStore.t('stats.backToTenants')}
                    </A>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mt-1">
                        <BarChart3 size={22} /> {tenantName() || i18nStore.t('common.tenant')} {i18nStore.t('stats.title')}
                    </h1>
                    <Show when={snapshot()}>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {i18nStore.t('stats.tenantId')} <code class="text-xs text-gray-900 dark:text-gray-100">{snapshot()!.tenant.id}</code>
                            {' · '}{i18nStore.t('stats.snapshotTaken')} <span class="text-gray-900 dark:text-gray-100">{new Date(snapshot()!.generated_at).toLocaleString()}</span>
                        </p>
                    </Show>
                </div>
                <div class="flex gap-2">
                    <A href={`/tenants/${params.id}`} class="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800">
                        {i18nStore.t('stats.editTenant')}
                    </A>
                    <button onClick={() => load()} disabled={loading()} class="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                        <RefreshCw size={14} class={loading() ? 'animate-spin' : ''} /> {i18nStore.t('stats.refresh')}
                    </button>
                </div>
            </div>

            <Show when={error()}>
                <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
                    <div class="font-medium mb-1">{i18nStore.t('stats.failedToLoadTenant')}</div>
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
    const s = props.s;
    const maxMimeBytes = () => s.storage.by_mime_type.reduce((m, x) => Math.max(m, x.bytes), 0) || 1;
    const maxMimeCount = () => s.storage.by_mime_type.reduce((m, x) => Math.max(m, x.count), 0) || 1;

    return (
        <>
            {/* Counts */}
            <section>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{i18nStore.t('stats.records')}</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <CountCard icon={Package} label={i18nStore.t('common.products')} value={s.counts.products} colorClass="text-blue-600 dark:text-blue-400" />
                    <CountCard icon={Folder} label={i18nStore.t('common.categories')} value={s.counts.categories} colorClass="text-green-600 dark:text-green-400" />
                    <CountCard icon={Image} label={i18nStore.t('common.media')} value={s.counts.media} colorClass="text-purple-600 dark:text-purple-400" />
                    <CountCard icon={Users} label={i18nStore.t('common.users')} value={s.counts.users} colorClass="text-orange-600 dark:text-orange-400" />
                </div>
            </section>

            {/* Storage */}
            <section>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">{i18nStore.t('stats.storage')}</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <BigStat icon={HardDrive} label={i18nStore.t('stats.totalMedia')} value={props.fmt(s.storage.media_bytes)} sub={i18nStore.t('stats.files', { n: s.storage.media_count })} />
                    <BigStat icon={BarChart3} label={i18nStore.t('stats.averageFileSize')} value={props.fmt(s.storage.avg_media_bytes)} sub={i18nStore.t('stats.across', { n: s.storage.media_count })} />
                    <BigStat
                        icon={Image}
                        label={i18nStore.t('stats.largestFile')}
                        value={s.storage.largest_media ? props.fmt(s.storage.largest_media.bytes) : '—'}
                        sub={s.storage.largest_media ? `${s.storage.largest_media.filename || i18nStore.t('stats.unnamed')} · ${props.friendly(s.storage.largest_media.mime_type)}` : i18nStore.t('stats.noMediaUploaded')}
                    />
                </div>

                <Show when={s.storage.by_mime_type.length > 0}>
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 mt-4">
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{i18nStore.t('stats.byFileType')}</h3>
                        <div class="space-y-2">
                            {s.storage.by_mime_type.map((m) => (
                                <div>
                                    <div class="flex items-center justify-between text-xs mb-1">
                                        <span class="text-gray-900 dark:text-gray-100">{props.friendly(m.mime_type)}</span>
                                        <span class="text-gray-500 dark:text-gray-400">
                                            {i18nStore.t('stats.files', { n: m.count })} · {props.fmt(m.bytes)}
                                        </span>
                                    </div>
                                    <div class="flex">
                                        <div class="bg-blue-500 h-2 rounded-l" style={{ width: `${(m.bytes / maxMimeBytes()) * 100}%`, 'min-width': '2px' }} title={`${props.fmt(m.bytes)}`} />
                                        <div class="bg-blue-300 dark:bg-blue-700 h-2 rounded-r" style={{ width: `${Math.max(0, (m.count / maxMimeCount()) * 100 - (m.bytes / maxMimeBytes()) * 100)}%`, 'min-width': '0' }} title={i18nStore.t('stats.files', { n: m.count })} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">{i18nStore.t('stats.solidBarLegendAlt')}</p>
                    </div>
                </Show>
            </section>

            {/* Activity */}
            <section>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Clock size={16} /> {i18nStore.t('stats.last30Days')}
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <CountCard icon={Package} label={i18nStore.t('stats.productsCreated')} value={s.activity_30d.products_created} colorClass="text-blue-600 dark:text-blue-400" />
                    <CountCard icon={Package} label={i18nStore.t('stats.productsUpdated')} value={s.activity_30d.products_updated} colorClass="text-blue-400 dark:text-blue-500" />
                    <CountCard icon={Image} label={i18nStore.t('stats.mediaUploaded')} value={s.activity_30d.media_uploaded} colorClass="text-purple-600 dark:text-purple-400" />
                    <CountCard icon={Folder} label={i18nStore.t('stats.categoriesCreated')} value={s.activity_30d.categories_created} colorClass="text-green-600 dark:text-green-400" />
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
                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate" title={props.sub}>
                        {props.sub}
                    </div>
                </div>
            </div>
        </div>
    );
}
