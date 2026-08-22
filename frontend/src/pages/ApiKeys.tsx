import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { KeyRound, Copy, Trash2, Plus, AlertTriangle, CheckCircle2 } from 'lucide-solid';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import Table, { Column } from '~/components/ui/Table';
import { ENTITY_TYPE_BUTTON_CLASSES } from '~/styles/colors';

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
  } catch (e: any) {
    // The pocketbase SDK wraps the response; surface the actual server
    // message so the user can debug from the FE (e.g. "list query
    // failed: …") instead of just "Something went wrong".
    const detail = e?.response?.message || e?.message || 'unknown error';
    const url = e?.url || '/api/stjorna/api-keys';
    throw new Error(`${e?.status || ''} ${url}: ${detail}`);
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

  const [keys, { refetch }] = createResource(initialized, (ready) => ready ? listKeys() : []);
  const [tenants] = createResource(initialized, (ready) => ready ? listTenants() : []);

  onMount(async () => {
    await authStore.init();
    if (!authStore.isAuthenticated()) { navigate('/login', { replace: true }); return; }
    if (!authStore.isPBAdmin)            { navigate('/', { replace: true }); return; }
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
    if (!newTenant()) { setFormError('Pick a tenant.'); return; }
    if (!newName().trim()) { setFormError('Name is required.'); return; }
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
    } catch (e: any) {
      setFormError(e?.message || 'Failed to issue key.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke API key "${name}"? This cannot be undone.`)) return;
    try {
      await revokeKey(id);
      await refetch();
    } catch (e: any) {
      alert(`Failed to revoke: ${e.message}`);
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
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'tenant',
      label: 'Tenant',
      render: (v) => tenantName(String(v)),
    },
    {
      key: 'prefix',
      label: 'Prefix',
      render: (v) => <code class="text-xs text-gray-700 dark:text-gray-300">{v}</code>,
    },
    {
      key: 'revoked',
      label: 'Status',
      render: (v) => (
        <span
          class={`text-xs px-2 py-0.5 rounded-full font-medium ${
            v
              ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
              : 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
          }`}
        >
          {v ? 'revoked' : 'active'}
        </span>
      ),
    },
    {
      key: 'last_used',
      label: 'Last used',
      render: (v) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      key: 'expires',
      label: 'Expires',
      render: (v) => (v ? new Date(v).toLocaleString() : 'never'),
    },
    {
      key: 'created',
      label: 'Created',
      sortable: true,
      render: (v) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!row.revoked) handleRevoke(row.id, row.name);
          }}
          disabled={row.revoked}
          class={`text-sm ${row.revoked ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 dark:text-red-400 hover:underline'}`}
        >
          <Trash2 size={14} class="inline -mt-0.5" /> Revoke
        </button>
      ),
    },
  ];

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">API Keys</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Tenant-scoped API keys for machine-to-machine access.
            <span class="block mt-0.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle size={12} class="inline -mt-0.5" /> Plaintext is shown only at
              creation time — store it immediately. Lost keys must be revoked and re-issued.
            </span>
          </p>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          class={`${ENTITY_TYPE_BUTTON_CLASSES.tenant} px-4 py-2 rounded font-medium transition-colors flex items-center gap-1`}
        >
          <Plus size={14} /> Issue key
        </button>
      </div>

      <Show when={formOpen()}>
        <form onSubmit={handleCreate} class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tenant</label>
              <select
                value={newTenant()}
                onChange={(e) => setNewTenant(e.currentTarget.value)}
                required
                class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
              >
                <option value="">— pick tenant —</option>
                <For each={tenants()}>
                  {(t) => <option value={t.id}>{t.name} ({t.slug})</option>}
                </For>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name (label)</label>
              <input
                type="text"
                value={newName()}
                onInput={(e) => setNewName(e.currentTarget.value)}
                placeholder="e.g. storefront-prod"
                required
                maxLength={200}
                class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Expires (optional)</label>
              <input
                type="datetime-local"
                value={newExpires()}
                onInput={(e) => setNewExpires(e.currentTarget.value)}
                class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
              />
            </div>
          </div>
          <Show when={formError()}>
            <div class="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded">
              {formError()}
            </div>
          </Show>
          <div class="flex gap-2">
            <button
              type="submit"
              disabled={creating()}
              class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {creating() ? 'Issuing…' : 'Issue key'}
            </button>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setFormError(null); }}
              class="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </Show>

      <Show when={!keys.loading} fallback={<div class="text-gray-500 dark:text-gray-400">Loading keys…</div>}>
        <Show when={keys.error}>
          <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm mb-3">
            <div class="font-medium mb-1">Failed to load API keys</div>
            <code class="text-xs break-all">{String((keys.error as any)?.message || keys.error)}</code>
          </div>
        </Show>
        <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <Table
            columns={columns}
            data={keys() || []}
            emptyMessage="No API keys yet. Issue one to get started."
          />
        </div>
      </Show>

      <Show when={keys()}>
        <p class="text-gray-600 dark:text-gray-500 text-sm">
          Total: {keys()!.length} keys (active + revoked).
        </p>
      </Show>

      <Show when={issued()}>
        <Modal onClose={() => { setIssued(null); setCopied(false); }}>
          <div class="space-y-4">
            <div class="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <KeyRound size={20} />
              <h2 class="text-lg font-semibold">API key issued</h2>
            </div>
            <p class="text-sm text-gray-700 dark:text-gray-300">
              <span class="font-medium">{issued()!.apiKey.name}</span> for tenant{' '}
              <span class="font-medium">{tenantName(issued()!.apiKey.tenant)}</span>.
            </p>
            <p class="text-sm bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 px-3 py-2 rounded">
              <AlertTriangle size={14} class="inline -mt-0.5" />{' '}
              <span class="font-medium">Copy now.</span> The plaintext key is shown only here
              and cannot be retrieved later.
            </p>
            <div class="bg-gray-900 text-green-300 rounded p-3 font-mono text-xs break-all relative">
              {issued()!.plaintext}
              <button
                onClick={copyPlaintext}
                class="absolute top-2 right-2 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-100 text-xs flex items-center gap-1"
              >
                <Show when={!copied()} fallback={<CheckCircle2 size={12} />}>
                  <Copy size={12} />
                </Show>
                {copied() ? 'copied' : 'copy'}
              </button>
            </div>
            <details class="text-xs text-gray-600 dark:text-gray-400">
              <summary class="cursor-pointer">How to use this key</summary>
              <div class="mt-2 space-y-1 font-mono">
                <div>curl -H "Authorization: Bearer {issued()!.plaintext}" \<br />&nbsp;&nbsp;{window.location.origin}/api/collections/categories/records</div>
              </div>
            </details>
            <div class="flex justify-end">
              <button
                onClick={() => { setIssued(null); setCopied(false); }}
                class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >
                I've stored it — close
              </button>
            </div>
          </div>
        </Modal>
      </Show>
    </div>
  );
}

function Modal(props: { onClose: () => void; children: any }) {
  return (
    <div class="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={props.onClose}>
      <div
        class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-2xl max-w-xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>
  );
}
