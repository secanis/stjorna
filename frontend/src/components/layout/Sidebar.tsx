import { createSignal, onMount, Show, For, createEffect } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { LayoutDashboard, Settings, Users, Building2, Folder, Image, Package, BookOpen } from 'lucide-solid';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { pb, getCurrentTenant } from '~/services/pocketbase';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/media', label: 'Media', icon: Image, showCount: true, roles: ['editor', 'admin'] as const },
  { path: '/categories', label: 'Categories', icon: Folder, showCount: true, roles: ['editor', 'admin'] as const },
  { path: '/products', label: 'Products', icon: Package, showCount: true, roles: ['editor', 'admin'] as const },
  { path: '/api-docs', label: 'API Docs', icon: BookOpen, roles: ['editor', 'admin', 'pb_admin'] as const },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/users', label: 'Users', icon: Users, roles: ['pb_admin'] as const, showCount: true },
  { path: '/tenants', label: 'Tenants', icon: Building2, roles: ['pb_admin'] as const, showCount: true },
];

export default function Sidebar() {
  const location = useLocation();
  const [mediaCount, setMediaCount] = createSignal<number | null>(null);
  const [usersCount, setUsersCount] = createSignal<number | null>(null);
  const [categoriesCount, setCategoriesCount] = createSignal<number | null>(null);
  const [productsCount, setProductsCount] = createSignal<number | null>(null);
  const [tenantsCount, setTenantsCount] = createSignal<number | null>(null);

  const fetchCounts = async () => {
    await authStore.init();

    const tenant = getCurrentTenant();

    if (authStore.isPBAdmin) {
      try {
        const tenants = await pb.collection('tenants').getList(1, 1);
        setTenantsCount(tenants.totalItems);
      } catch (e: any) { console.warn('[Sidebar] tenants count:', e?.message); }
      try {
        const ut = await pb.collection('user_tenants').getList(1, 1);
        setUsersCount(ut.totalItems);
      } catch (e: any) { console.warn('[Sidebar] users count:', e?.message); }
      try {
        const products = await pb.collection('products').getList(1, 1);
        setProductsCount(products.totalItems);
      } catch (e: any) { console.warn('[Sidebar] products count:', e?.message); }
    } else {
      const filter = tenant ? `tenant = "${tenant}"` : '';
      if (authStore.isEditorOrAbove()) {
        try {
          const media = await pb.collection('media').getList(1, 1, { filter });
          setMediaCount(media.totalItems);
        } catch (e: any) { console.warn('[Sidebar] media count:', e?.message); }
        try {
          const categories = await pb.collection('categories').getList(1, 1, { filter });
          setCategoriesCount(categories.totalItems);
        } catch (e: any) { console.warn('[Sidebar] categories count:', e?.message); }
        try {
          const products = await pb.collection('products').getList(1, 1, { filter });
          setProductsCount(products.totalItems);
        } catch (e: any) { console.warn('[Sidebar] products count:', e?.message); }
      }
      try {
        const ut = await pb.collection('user_tenants').getList(1, 1, { filter });
        setUsersCount(ut.totalItems);
      } catch (e: any) { console.warn('[Sidebar] users count:', e?.message); }
    }
  };

  onMount(() => {
    fetchCounts();
  });

  createEffect(() => {
    sidebarStore.version;
    fetchCounts();
  });

  const visibleItems = () => {
    return navItems.filter(item => {
      if (!item.roles) return true;
      const roles = [...item.roles];
      if (authStore.isPBAdmin) return roles.includes('pb_admin');
      const userRole = authStore.role;
      return userRole ? roles.includes(userRole as 'editor' | 'admin') : false;
    });
  };

  return (
    <aside class="w-64 bg-gray-800 min-h-screen p-4 flex flex-col">
      <div class="text-2xl font-bold text-white mb-8">STJÓRNA</div>

      <nav class="flex-1 space-y-1">
        <For each={visibleItems()}>
          {(item) => {
            const Icon = item.icon;
            const itemPath = () => item.path === '/settings' && authStore.isPBAdmin ? '/settings/instance' : item.path;
            const isActive = () => location.pathname === itemPath() || (itemPath() !== '/' && location.pathname.startsWith(itemPath()));
            return (
              <A
                href={itemPath()}
                class={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive() ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Icon size={20} />
                <span class="flex-1">{item.label}</span>
                <Show when={item.showCount && item.path === '/media'}>
                  <span class={`text-xs px-2 py-0.5 rounded-full ${
                    isActive() ? 'bg-blue-700 text-blue-200' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {mediaCount() ?? '-'}
                  </span>
                </Show>
                <Show when={item.showCount && item.path === '/categories'}>
                  <span class={`text-xs px-2 py-0.5 rounded-full ${
                    isActive() ? 'bg-blue-700 text-blue-200' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {categoriesCount() ?? '-'}
                  </span>
                </Show>
                <Show when={item.showCount && item.path === '/products'}>
                  <span class={`text-xs px-2 py-0.5 rounded-full ${
                    isActive() ? 'bg-blue-700 text-blue-200' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {productsCount() ?? '-'}
                  </span>
                </Show>
                <Show when={item.showCount && item.path === '/users'}>
                  <span class={`text-xs px-2 py-0.5 rounded-full ${
                    isActive() ? 'bg-blue-700 text-blue-200' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {usersCount() ?? '-'}
                  </span>
                </Show>
                <Show when={item.showCount && item.path === '/tenants'}>
                  <span class={`text-xs px-2 py-0.5 rounded-full ${
                    isActive() ? 'bg-blue-700 text-blue-200' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {tenantsCount() ?? '-'}
                  </span>
                </Show>
              </A>
            );
          }}
        </For>
      </nav>
    </aside>
  );
}
