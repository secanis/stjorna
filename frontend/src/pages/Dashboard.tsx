import { createSignal, Show, onMount } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { Package, Folder, Image, Users, Building2 } from 'lucide-solid';
import Table, { Column } from '~/components/ui/Table';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';

async function fetchStats() {
  const tenant = getCurrentTenant();

  try {
    if (authStore.isPBAdmin) {
      let users = 0;
      let tenantsCount = 0;
      let categoriesCount = 0;
      let productsCount = 0;
      let mediaCount = 0;

      try {
        const tenantsResult = await pb.collection('tenants').getList(1, 1);
        tenantsCount = tenantsResult.totalItems;
      } catch {}

      try {
        const userTenantsResult = await pb.collection('user_tenants').getList(1, 1);
        users = userTenantsResult.totalItems;
      } catch {}

      try {
        const categoriesResult = await pb.collection('categories').getList(1, 1);
        categoriesCount = categoriesResult.totalItems;
      } catch {}

      try {
        const productsResult = await pb.collection('products').getList(1, 1);
        productsCount = productsResult.totalItems;
      } catch {}

      try {
        const mediaResult = await pb.collection('media').getList(1, 1);
        mediaCount = mediaResult.totalItems;
      } catch {}

      return {
        tenants: tenantsCount,
        categories: categoriesCount,
        products: productsCount,
        media: mediaCount,
        users,
      };
    }

    const filter = tenant ? `tenant = "${tenant}"` : '';
    const [categories, products, media, userTenants] = await Promise.all([
      pb.collection('categories').getList(1, 1, { filter }),
      pb.collection('products').getList(1, 1, { filter }),
      pb.collection('media').getList(1, 1, { filter }),
      pb.collection('user_tenants').getList(1, 1, { filter }),
    ]);

    return {
      tenants: 0,
      categories: categories.totalItems,
      products: products.totalItems,
      media: media.totalItems,
      users: userTenants.totalItems,
    };
  } catch {
    return { tenants: 0, categories: 0, products: 0, media: 0, users: 0 };
  }
}

const getItemName = (item: any, type: string): string => {
  if (type === 'tenant') return item.name;
  if (type === 'user') return item.email;
  if (type === 'product') return item.name;
  if (type === 'media') return item.filename || item.original_name || '(no name)';
  if (type === 'category') return item.name;
  return '?';
};

async function fetchRecentActivity() {
  try {
    const items: any[] = [];

    // Fetch each collection twice — once sorted by created, once by updated
    // — and merge. A record that was created and never updated appears once
    // (as 'created'); a record that was edited appears twice (one 'created'
    // and one 'updated' event).
    async function fetchCollection(
      collection: string,
      type: string,
      filter?: string
    ) {
      const [byCreated, byUpdated] = await Promise.all([
        pb.collection(collection).getList(1, 5, { filter, sort: '-created' }),
        pb.collection(collection).getList(1, 5, { filter, sort: '-updated' }),
      ]);
      byCreated.items.forEach((item: any) => {
        items.push({
          type,
          action: 'created',
          name: getItemName(item, type),
          id: item.id,
          at: item.created,
        });
      });
      byUpdated.items.forEach((item: any) => {
        if (item.updated && item.updated !== item.created) {
          items.push({
            type,
            action: 'updated',
            name: getItemName(item, type),
            id: item.id,
            at: item.updated,
          });
        }
      });
    }

    if (authStore.isPBAdmin) {
      await fetchCollection('tenants', 'tenant');
      await fetchCollection('users', 'user');
    } else {
      const filter = getCurrentTenant() ? `tenant = "${getCurrentTenant()}"` : '';
      await fetchCollection('products', 'product', filter);
      await fetchCollection('media', 'media', filter);
      await fetchCollection('categories', 'category', filter);
    }

    // Dedupe (same record, same action).
    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      const key = `${item.id}-${item.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by event timestamp, newest first.
    deduped.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return deduped.slice(0, 10);
  } catch {
    return [];
  }
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = createSignal<any>(null);
  const [statsLoading, setStatsLoading] = createSignal(true);
  const [recentActivity, setRecentActivity] = createSignal<any>(null);
  const [recentLoading, setRecentLoading] = createSignal(true);

  onMount(async () => {
    await authStore.init();
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    setStatsLoading(true);
    setRecentLoading(true);
    const s = await fetchStats();
    setStats(s);
    setStatsLoading(false);
    const r = await fetchRecentActivity();
    setRecentActivity(r);
    setRecentLoading(false);
  });

  const activityColumns: Column[] = [
    {
      key: 'type',
      label: 'Type',
      render: (v) => (
        <span class={`px-2 py-1 rounded text-xs font-medium ${
          v === 'tenant' ? 'bg-orange-600' : v === 'user' ? 'bg-cyan-600' : v === 'product' ? 'bg-blue-600' : v === 'media' ? 'bg-green-600' : 'bg-purple-600'
        } text-white`}>
          {v}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (v) => (
        <span class={`px-2 py-1 rounded text-xs font-medium ${
          v === 'created' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'
        }`}>
          {v}
        </span>
      ),
    },
    { key: 'name', label: 'Name' },
    { key: 'at', label: 'When', render: (v) => v ? new Date(v).toLocaleString() : '-' },
  ];

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-white">Dashboard</h1>

      <Show when={statsLoading()}>
        <div class="text-gray-400">Loading stats...</div>
      </Show>

      <Show when={stats()}>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Products" value={stats()!.products} icon={Package} />
          <StatCard label="Categories" value={stats()!.categories} icon={Folder} />
          <StatCard label="Media" value={stats()!.media} icon={Image} />
          <StatCard label="Users" value={stats()!.users} icon={Users} />
          <Show when={authStore.isPBAdmin}>
            <StatCard label="Tenants" value={stats()!.tenants} icon={Building2} />
          </Show>
        </div>
      </Show>

      <div>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-white">Quick Actions</h2>
        </div>
        <div class="flex gap-3">
          <Show when={authStore.isPBAdmin}>
            <A href="/tenants/add" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors">
              + Add Tenant
            </A>
          </Show>
          <Show when={!authStore.isPBAdmin && authStore.isEditorOrAbove()}>
            <A href="/categories/new" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-medium transition-colors">
              + Add Category
            </A>
            <A href="/media/new" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors">
              + Add Media
            </A>
          </Show>
        </div>
      </div>

      <div>
        <h2 class="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <div class="bg-gray-800 rounded-lg overflow-hidden">
          <Show
            when={!recentLoading()}
            fallback={<div class="p-4 text-gray-400">Loading...</div>}
          >
            <Table
              columns={activityColumns}
              data={recentActivity() || []}
              onRowClick={(row) => {
                if (row.type === 'media') navigate(`/media/${row.id}`);
                else if (row.type === 'product') navigate(`/products/${row.id}`);
                else if (row.type === 'category') navigate(`/categories/${row.id}`);
                else if (row.type === 'tenant') navigate(`/tenants/${row.id}`);
              }}
              emptyMessage="No recent activity"
            />
          </Show>
        </div>
      </div>
    </div>
  );
}

function StatCard(props: { label: string; value: number; icon: any }) {
  const Icon = props.icon;
  return (
    <div class="bg-gray-800 rounded-lg p-4 flex items-center gap-4">
      <Icon size={28} class="text-gray-400" />
      <div>
        <div class="text-2xl font-bold text-white">{props.value}</div>
        <div class="text-gray-400 text-sm">{props.label}</div>
      </div>
    </div>
  );
}