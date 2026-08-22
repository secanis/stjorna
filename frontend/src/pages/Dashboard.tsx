import { createSignal, Show, onMount } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { Package, Folder, Image, Users, Building2 } from 'lucide-solid';
import Table from '~/components/ui/Table';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { fetchRecentActivity, type ActivityEvent, type ActivityType } from '~/utils/activity';
import {
  ENTITY_TYPE_TEXT_COLORS,
  ENTITY_TYPE_BUTTON_CLASSES,
  PRIMARY_BUTTON_CLASSES,
} from '~/styles/colors';
import { dashboardActivityColumns } from '~/utils/activityColumns';

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

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = createSignal<any>(null);
  const [statsLoading, setStatsLoading] = createSignal(true);
  const [recentActivity, setRecentActivity] = createSignal<ActivityEvent[] | null>(null);
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

  const activityColumns = dashboardActivityColumns;

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>

      <Show when={statsLoading()}>
        <div class="text-gray-500 dark:text-gray-400">Loading stats...</div>
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
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
        </div>
        <div class="flex gap-3">
          <Show when={authStore.isPBAdmin}>
            <A href="/tenants/add" class={`${ENTITY_TYPE_BUTTON_CLASSES.tenant} px-4 py-2 rounded font-medium transition-colors`}>
              + Add Tenant
            </A>
          </Show>
          <Show when={!authStore.isPBAdmin && authStore.isEditorOrAbove()}>
            <A href="/categories/new" class={`${ENTITY_TYPE_BUTTON_CLASSES.category} px-4 py-2 rounded font-medium transition-colors`}>
              + Add Category
            </A>
            <A href="/media/new" class={`${ENTITY_TYPE_BUTTON_CLASSES.media} px-4 py-2 rounded font-medium transition-colors`}>
              + Add Media
            </A>
            <A href="/products/new" class={`${ENTITY_TYPE_BUTTON_CLASSES.product} px-4 py-2 rounded font-medium transition-colors`}>
              + Add Product
            </A>
          </Show>
        </div>
      </div>

      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
        <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <Show
            when={!recentLoading()}
            fallback={<div class="p-4 text-gray-500 dark:text-gray-400">Loading...</div>}
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
  // Auto-color the icon to match the entity whose name is in the label.
  // Falls back to gray for any stat card whose label isn't a known entity.
  const typeFromLabel = labelToEntityType(props.label);
  const iconClass = typeFromLabel
    ? ENTITY_TYPE_TEXT_COLORS[typeFromLabel]
    : 'text-gray-500 dark:text-gray-400';
  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center gap-4">
      <Icon size={28} class={iconClass} />
      <div>
        <div class="text-2xl font-bold text-gray-900 dark:text-white">{props.value}</div>
        <div class="text-gray-500 dark:text-gray-400 text-sm">{props.label}</div>
      </div>
    </div>
  );
}

// Maps a stat-card label to its entity type so the icon can pick up the
// matching color. Returns undefined for labels that aren't entities.
function labelToEntityType(label: string): ActivityType | undefined {
  const map: Record<string, ActivityType> = {
    Products: 'product',
    Categories: 'category',
    Media: 'media',
    Users: 'user',
    Tenants: 'tenant',
  };
  return map[label];
}