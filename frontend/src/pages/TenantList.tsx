import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Settings } from 'lucide-solid';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import Table, { Column } from '~/components/ui/Table';

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

  const [data, { refetch }] = createResource(initialized, (ready) => {
    if (!ready) return undefined;
    return fetchTenants();
  });

  onMount(async () => {
    if (initStarted) return;
    initStarted = true;
    await authStore.init();
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

  const columns: Column[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'slug', label: 'Slug', sortable: true },
    { key: 'plan', label: 'Plan' },
    { key: 'custom_domain', label: 'Domain' },
    {
      key: 'created',
      label: 'Created',
      sortable: true,
      render: (v) => v ? new Date(v).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleSettings(row.id); }}
          class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm flex items-center gap-1"
        >
          <Settings size={14} />
          Settings
        </button>
      ),
    },
  ];

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Tenants</h1>
      </div>

      <Show
        when={!data.loading && data()}
        fallback={<div class="text-gray-500 dark:text-gray-400">Loading tenants...</div>}
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <Table
            columns={columns}
            data={data()?.items || []}
            onRowClick={(row) => handleSettings(row.id)}
            emptyMessage="No tenants found"
          />
        </div>
      </Show>

      <Show when={data()}>
        <p class="text-gray-600 dark:text-gray-500 text-sm">
          Total: {data()?.totalItems || 0} tenants
        </p>
      </Show>
    </div>
  );
}