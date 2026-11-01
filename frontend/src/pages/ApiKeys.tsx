import { createSignal, createResource, Show, onMount } from 'solid-js';
import type { ParentProps } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { KeyRound, Copy, Trash2, Plus, AlertTriangle, CheckCircle2 } from 'lucide-solid';
import { pb } from '~/services/pocketbase';
import { ClientResponseError } from 'pocketbase';
import { authStore } from '~/stores/auth';
import Table, { Column } from '~/components/ui/Table';
import Combobox from '~/components/ui/Combobox';
import { ENTITY_TYPE_BUTTON_CLASSES } from '~/styles/colors';
import { confirmDialog, alertDialog } from '~/components/ui/ConfirmDialog';
import { i18nStore } from '~/i18n';
import { errorMessage } from '~/utils/errors';

// PB-side enum of API key records. Plaintext NEVER appears here — it's only
// emitted in the issue endpoint response and never persisted.
interface ApiKeyRow {
    id: string;
    tenant: string;
    name: string;
    prefix: string;
    permissions: Record<string, unknown> | string | null;
    last_used: string | null;
    expires: string | null;
    revoked: boolean;
    created: string;
}

interface TenantOption {
    id: string;
    name: string;
    slug: string;
}

async function listKeys(): Promise<ApiKeyRow[]> {
    try {
        const r = await pb.send('/api/stjorna/api-keys', { method: 'GET' });
        return (r?.items || []) as ApiKeyRow[];
    } catch (e: unknown) {
        // The pocketbase SDK wraps the response; surface the actual server
        // message so the user can debug from the FE (e.g. "list query
        // failed: …") instead of just "Something went wrong".
        const status = e instanceof ClientResponseError ? e.status : undefined;
        const url = e instanceof ClientResponseError ? e.url : '/api/stjorna/api-keys';
        const detail = e instanceof ClientResponseError
            ? e.response?.message || e.message || 'unknown error'
            : errorMessage(e, 'unknown error');
        throw new Error(`${status || ''} ${url}: ${detail}`);
    }
}

async function listTenants(): Promise<TenantOption[]> {
    return (await pb.collection('tenants').getFullList({ fields: 'id,name,slug' })) as TenantOption[];
}

async function issueKey(body: { tenant: string; name: string; permissions?: Record<string, unknown>; expires?: string }) {
    return await pb.send('/api/stjorna/api-keys', { method: 'POST', body });
}

async function revokeKey(id: string) {
    return await pb.send('/api/stjorna/api-keys/' + id, { method: 'DELETE' });
}

export default function ApiKeys() {
    const navigate = useNavigate();
    const [initialized, setInitialized] = createSignal(false);

    const [keys, { refetch }] = createResource(initialized, (ready) => (ready ? listKeys() : []));
    const [tenants] = createResource(initialized, (ready) => (ready ? listTenants() : []));

    onMount(async () => {
        if (!authStore.isAuthenticated()) {
            navigate('/login', { replace: true });
            return;
        }
        if (!authStore.isPBAdmin) {
            navigate('/', { replace: true });
            return;
        }
        setInitialized(true);
    });

    // Creation form state
    const [formOpen, setFormOpen] = createSignal(false);
    const [creating, setCreating] = createSignal(false);
    const [formError, setFormError] = createSignal<string | null>(null);
    const [newTenant, setNewTenant] = createSignal('');
    const [newName, setNewName] = createSignal('');
    const [newExpires, setNewExpires] = createSignal('');

    // Show-once modal
    const [issued, setIssued] = createSignal<{ plaintext: string; apiKey: ApiKeyRow; warning: string } | null>(null);
    const [copied, setCopied] = createSignal(false);

    async function handleCreate(e: Event) {
        e.preventDefault();
        setFormError(null);
        if (!newTenant()) {
            setFormError(i18nStore.t('apiKeys.pickTenantError'));
            return;
        }
        if (!newName().trim()) {
            setFormError(i18nStore.t('apiKeys.nameRequired'));
            return;
        }
        setCreating(true);
        try {
            const r = await issueKey({
                tenant: newTenant(),
                name: newName().trim(),
                expires: newExpires() ? new Date(newExpires()).toISOString() : undefined,
            });
            setIssued({
                plaintext: r.plaintext,
                apiKey: r.apiKey,
                warning: r.warning,
            });
            setFormOpen(false);
            setNewName('');
            setNewExpires('');
            await refetch();
        } catch (e: unknown) {
            setFormError(errorMessage(e, i18nStore.t('apiKeys.failedToIssue')));
        } finally {
            setCreating(false);
        }
    }

    async function handleRevoke(id: string, name: string) {
        if (!(await confirmDialog({ message: i18nStore.t('apiKeys.revokeConfirm', { name }), danger: true }))) return;
        try {
            await revokeKey(id);
            await refetch();
        } catch (e: unknown) {
            void alertDialog(i18nStore.t('apiKeys.failedToRevoke', { msg: errorMessage(e) }));
        }
    }

    async function copyPlaintext() {
        const v = issued();
        if (!v) return;
        try {
            await navigator.clipboard.writeText(v.plaintext);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // ignore — user can still copy manually
        }
    }

    const tenantName = (id: string) => {
        const t = (tenants() || []).find((x) => x.id === id);
        return t ? t.name : id;
    };

    const columns: Column[] = [
        { key: 'name', label: i18nStore.t('common.name'), sortable: true },
        {
            key: 'tenant',
            label: i18nStore.t('common.tenant'),
            render: (v) => tenantName(String(v)),
        },
        {
            key: 'prefix',
            label: i18nStore.t('apiKeys.prefix'),
            render: (v) => <code class="text-xs text-gray-700 dark:text-gray-300">{String(v)}</code>,
        },
        {
            key: 'revoked',
            label: i18nStore.t('common.status'),
            render: (v) => <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${v ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' : 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'}`}>{v ? i18nStore.t('apiKeys.revoked') : i18nStore.t('apiKeys.active')}</span>,
        },
        {
            key: 'last_used',
            label: i18nStore.t('apiKeys.lastUsed'),
            render: (v) => (v ? new Date(v as string).toLocaleString() : '—'),
        },
        {
            key: 'expires',
            label: i18nStore.t('apiKeys.expiresCol'),
            render: (v) => (v ? new Date(v as string).toLocaleString() : i18nStore.t('apiKeys.never')),
        },
        {
            key: 'created',
            label: i18nStore.t('common.created'),
            sortable: true,
            render: (v) => (v ? new Date(v as string).toLocaleString() : '—'),
        },
        {
            key: 'actions',
            label: '',
            render: (_, row) => {
                const key = row as unknown as ApiKeyRow;
                return (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!key.revoked) handleRevoke(key.id, key.name);
                        }}
                        disabled={key.revoked}
                        class={`text-sm ${key.revoked ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 dark:text-red-400 hover:underline'}`}
                    >
                        <Trash2 size={14} class="inline -mt-0.5" /> {i18nStore.t('apiKeys.revoke')}
                    </button>
                );
            },
        },
    ];

    return (
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{i18nStore.t('apiKeys.title')}</h1>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {i18nStore.t('apiKeys.subtitle')}
                        <span class="block mt-0.5 text-amber-700 dark:text-amber-400">
                            <AlertTriangle size={12} class="inline -mt-0.5" /> {i18nStore.t('apiKeys.warning')}
                        </span>
                    </p>
                </div>
                <button onClick={() => setFormOpen((v) => !v)} class={`${ENTITY_TYPE_BUTTON_CLASSES.tenant} px-4 py-2 rounded font-medium transition-colors flex items-center gap-1`}>
                    <Plus size={14} /> {i18nStore.t('apiKeys.issueKey')}
                </button>
            </div>

            <Show when={formOpen()}>
                <form onSubmit={handleCreate} class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('common.tenant')}</label>
                            <Combobox
                                value={newTenant()}
                                onChange={(v) => setNewTenant(v)}
                                options={(tenants() || []).map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` }))}
                                placeholder={i18nStore.t('apiKeys.pickTenant')}
                                allowClear={false}
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('apiKeys.nameLabel')}</label>
                            <input
                                type="text"
                                value={newName()}
                                onInput={(e) => setNewName(e.currentTarget.value)}
                                placeholder="e.g. storefront-prod"
                                required
                                maxLength={200}
                                class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('apiKeys.expires')}</label>
                            <input type="datetime-local" value={newExpires()} onInput={(e) => setNewExpires(e.currentTarget.value)} class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm" />
                        </div>
                    </div>
                    <Show when={formError()}>
                        <div class="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded">{formError()}</div>
                    </Show>
                    <div class="flex gap-2">
                        <button type="submit" disabled={creating()} class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
                            {creating() ? i18nStore.t('apiKeys.issuing') : i18nStore.t('apiKeys.issueKey')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setFormOpen(false);
                                setFormError(null);
                            }}
                            class="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 text-sm"
                        >
                            {i18nStore.t('common.cancel')}
                        </button>
                    </div>
                </form>
            </Show>

            <Show when={!keys.loading} fallback={<div class="text-gray-500 dark:text-gray-400">{i18nStore.t('apiKeys.loading')}</div>}>
                <Show when={keys.error}>
                    <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm mb-3">
                        <div class="font-medium mb-1">{i18nStore.t('apiKeys.failedToLoad')}</div>
                        <code class="text-xs break-all">{String(keys.error?.message || keys.error)}</code>
                    </div>
                </Show>
                <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
                    <Table columns={columns} data={(keys() || []) as unknown as Record<string, unknown>[]} emptyMessage={i18nStore.t('apiKeys.empty')} />
                </div>
            </Show>

            <Show when={keys()}>
                <p class="text-gray-600 dark:text-gray-500 text-sm">{i18nStore.t('apiKeys.total', { n: keys()!.length })}</p>
            </Show>

            <Show when={issued()}>
                <Modal
                    onClose={() => {
                        setIssued(null);
                        setCopied(false);
                    }}
                >
                    <div class="space-y-4">
                        <div class="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                            <KeyRound size={20} />
                            <h2 class="text-lg font-semibold">{i18nStore.t('apiKeys.issued')}</h2>
                        </div>
                        <p class="text-sm text-gray-700 dark:text-gray-300">
                            {i18nStore.t('apiKeys.issuedFor', { name: issued()!.apiKey.name, tenant: tenantName(issued()!.apiKey.tenant) })}
                        </p>
                        <p class="text-sm bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 px-3 py-2 rounded">
                            <AlertTriangle size={14} class="inline -mt-0.5" /> <span class="font-medium">{i18nStore.t('apiKeys.copyNow')}</span> {i18nStore.t('apiKeys.copyHint')}
                        </p>
                        <div class="bg-gray-900 text-green-300 rounded p-3 font-mono text-xs break-all relative">
                            {issued()!.plaintext}
                            <button onClick={copyPlaintext} class="absolute top-2 right-2 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs flex items-center gap-1">
                                <Show when={!copied()} fallback={<CheckCircle2 size={12} />}>
                                    <Copy size={12} />
                                </Show>
                                {copied() ? i18nStore.t('apiKeys.copied') : i18nStore.t('apiKeys.copy')}
                            </button>
                        </div>
                        <details class="text-xs text-gray-600 dark:text-gray-400">
                            <summary class="cursor-pointer">{i18nStore.t('apiKeys.howToUse')}</summary>
                            <div class="mt-2 space-y-1 font-mono">
                                <div>
                                    curl -H "Authorization: Bearer {issued()!.plaintext}" \<br />
                                    &nbsp;&nbsp;{window.location.origin}/api/collections/categories/records
                                </div>
                            </div>
                        </details>
                        <div class="flex justify-end">
                            <button
                                onClick={() => {
                                    setIssued(null);
                                    setCopied(false);
                                }}
                                class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                            >
                                {i18nStore.t('apiKeys.storedClose')}
                            </button>
                        </div>
                    </div>
                </Modal>
            </Show>
        </div>
    );
}

function Modal(props: ParentProps & { onClose: () => void }) {
    return (
        <div class="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={() => props.onClose()}>
            <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl max-w-xl w-full p-6" onClick={(e) => e.stopPropagation()}>
                {props.children}
            </div>
        </div>
    );
}
