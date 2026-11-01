import { createSignal, createResource, createMemo, Show, onMount } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { Settings, BarChart3 } from 'lucide-solid';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import Table, { Column } from '~/components/ui/Table';
import { ENTITY_TYPE_BUTTON_CLASSES } from '~/styles/colors';
import { i18nStore } from '~/i18n';

interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  plan: string;
  custom_domain: string;
  created: string;
}

async function fetchTenants() {
  return await pb.collection('tenants').getList<TenantRecord>(1, 500, {
    sort: 'created',
  });
}

export default function TenantList() {
  const navigate = useNavigate();
  const [initialized, setInitialized] = createSignal(false);
  let initStarted = false;

  const [data] = createResource(initialized, (ready) => {
    if (!ready) return undefined;
    return fetchTenants();
  });

  onMount(async () => {
    if (initStarted) return;
    initStarted = true;
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

  const handleSettings = (tenantId: string) => {
    navigate(`/tenants/${tenantId}`);
  };
  const handleStats = (tenantId: string) => {
    navigate(`/tenants/${tenantId}/stats`);
  };

  const columns = createMemo<Column[]>(() => [
    { key: 'name', label: i18nStore.t('common.name'), sortable: true },
    { key: 'slug', label: i18nStore.t('common.slug'), sortable: true },
    { key: 'plan', label: i18nStore.t('common.plan') },
    { key: 'custom_domain', label: i18nStore.t('common.domain') },
    {
      key: 'created',
      label: i18nStore.t('common.created'),
      sortable: true,
      render: (v) => v ? new Date(v as string | number).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div class="flex gap-3 items-center justify-end">
          <button
            onClick={(e) => { e.stopPropagation(); handleStats(String(row.id)); }}
            class="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm flex items-center gap-1"
            title={i18nStore.t('tenants.viewStatistics')}
          >
            <BarChart3 size={14} />
            {i18nStore.t('tenants.stats')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSettings(String(row.id)); }}
            class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm flex items-center gap-1"
          >
            <Settings size={14} />
            {i18nStore.t('nav.settings')}
          </button>
        </div>
      ),
    },
  ]);

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{i18nStore.t('tenants.title')}</h1>
        <A
          href="/tenants/new"
          class={`${ENTITY_TYPE_BUTTON_CLASSES.tenant} px-4 py-2 rounded font-medium transition-colors`}
        >
          {i18nStore.t('tenants.addTenant')}
        </A>
      </div>

      <Show
        when={!data.loading && data()}
        fallback={<div class="text-gray-500 dark:text-gray-400">{i18nStore.t('tenants.loading')}</div>}
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <Table
            columns={columns()}
            data={(data()?.items || []) as unknown as Record<string, unknown>[]}
            onRowClick={(row) => handleSettings(String(row.id))}
            emptyMessage={i18nStore.t('tenants.empty')}
          />
        </div>
      </Show>

      <Show when={data()}>
        <p class="text-gray-600 dark:text-gray-500 text-sm">
          {i18nStore.t('tenants.total', { n: data()?.totalItems || 0 })}
        </p>
      </Show>
    </div>
  );
}
