import { createSignal, createResource, createMemo, Show, onMount, For } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import Table, { Column } from '~/components/ui/Table';
import { pb, tenantFilter, toSortExpr } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { tenantStore } from '~/stores/tenant';
import MediaThumb from '~/components/media/MediaThumb';
import ActiveBadge from '~/components/ui/ActiveBadge';
import Combobox from '~/components/ui/Combobox';
import { ImageOff } from 'lucide-solid';
import { ENTITY_TYPE_BUTTON_CLASSES } from '~/styles/colors';
import type { Product, Category } from '~/types';
import { confirmDialog, alertDialog } from '~/components/ui/ConfirmDialog';
import { i18nStore } from '~/i18n';

const PER_PAGE = 50;

async function fetchProducts(src: { page: number; sortKey: string; sortDir: 'asc' | 'desc'; search: string; category: string; active: string }) {
  const parts: string[] = [];
  const tf = tenantFilter();
  if (tf) parts.push(tf);
  const q = src.search.trim();
  if (q) parts.push(pb.filter('(name ?~ {:q} || slug ?~ {:q} || description ?~ {:q})', { q }));
  if (src.category) parts.push(pb.filter('category = {:category}', { category: src.category }));
  if (src.active === 'active') parts.push('active = true');
  if (src.active === 'inactive') parts.push('active = false');
  return await pb.collection('products').getList<Product>(src.page, PER_PAGE, {
    filter: parts.join(' && '),
    sort: toSortExpr(src.sortKey, src.sortDir, 'name'),
    expand: 'media',
  });
}

async function fetchCategories() {
  return await pb.collection('categories').getList<Category>(1, 200, { filter: tenantFilter(), sort: 'name' });
}

export default function ProductList() {
  const navigate = useNavigate();

  onMount(async () => {
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    if (authStore.isPBAdmin) {
      navigate('/', { replace: true });
      return;
    }
  });

  let searchInputRef: HTMLInputElement | undefined;
  onMount(() => searchInputRef?.focus());

  const [page, setPage] = createSignal(1);
  const [sortKey, setSortKey] = createSignal('sort_order');
  const [sortDir, setSortDir] = createSignal<'asc' | 'desc'>('asc');
  const [search, setSearch] = createSignal('');
  const [categoryFilter, setCategoryFilter] = createSignal('');
  const [activeFilter, setActiveFilter] = createSignal('');

  // Categories populate the filter dropdown; refetch them whenever the
  // active tenant changes so the options stay in sync with the product rows.
  const [categories] = createResource(() => tenantStore.version, fetchCategories);

  // tenantStore.version inside the source accessor ensures the table
  // refetches when the active tenant changes — without this, the
  // imperative getCurrentTenant() inside fetchProducts would read a
  // stale value and no refetch would ever fire after a tenant
  // switch.
  const [data, { refetch }] = createResource(
    () => ({ page: page(), sortKey: sortKey(), sortDir: sortDir(), search: search(), category: categoryFilter(), active: activeFilter(), tenantVersion: tenantStore.version }),
    fetchProducts
  );

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ message: i18nStore.t('products.deleteConfirm'), danger: true }))) return;
    try {
      await pb.collection('products').delete(id);
      sidebarStore.bump();
      refetch();
    } catch (e: any) {
      void alertDialog(i18nStore.t('common.failedToDelete', { msg: e.message }));
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await pb.collection('products').update(id, { active: !currentActive });
      sidebarStore.bump();
      refetch();
    } catch (e: any) {
      void alertDialog(i18nStore.t('common.failedToUpdate', { msg: e.message }));
    }
  };

  const columns = createMemo<Column[]>(() => [
    {
      key: 'media',
      label: i18nStore.t('products.thumb'),
      render: (_, row) => {
        const expanded = (row as any).expand?.media;
        const list: any[] = Array.isArray(expanded) ? expanded : (expanded ? [expanded] : []);
        if (list.length === 0) {
          return (
            <div class="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded flex items-center justify-center" title={i18nStore.t('products.noMedia')}>
              <ImageOff size={16} class="text-gray-600 dark:text-gray-500" />
            </div>
          );
        }
        const shown = list.slice(0, 3);
        const overflow = list.length - shown.length;
        return (
          <div class="flex -space-x-2">
            <For each={shown}>
              {(m) => (
                <div class="w-12 h-12 rounded overflow-hidden bg-gray-900 dark:bg-black ring-2 ring-gray-200 dark:ring-gray-800">
                  <MediaThumb media={m} thumb="100x100" class="w-12 h-12 object-cover" />
                </div>
              )}
            </For>
            {overflow > 0 && (
              <div class="w-12 h-12 rounded bg-gray-50 dark:bg-gray-700 ring-2 ring-gray-200 dark:ring-gray-800 flex items-center justify-center text-xs text-gray-800 dark:text-gray-200 font-medium">
                +{overflow}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'name',
      label: i18nStore.t('common.name'),
      sortable: true,
    },
    { key: 'slug', label: i18nStore.t('common.slug'), sortable: true },
    {
      key: 'category',
      label: i18nStore.t('common.category'),
      render: (v) => v || '-',
    },
    {
      key: 'price',
      label: i18nStore.t('common.price'),
      sortable: true,
      render: (v) => v != null ? `${v.toFixed(2)}` : '-',
    },
    {
      key: 'active',
      label: i18nStore.t('common.active'),
      sortable: true,
      render: (v, row) => (
        <ActiveBadge
          active={!!v}
          size="sm"
          onClick={() => handleToggleActive(row.id, v)}
        />
      ),
    },
    {
      key: 'sort_order',
      label: i18nStore.t('common.sortOrder'),
      sortable: true,
      render: (v) => v ?? '-',
    },
    {
      key: 'created',
      label: i18nStore.t('common.created'),
      sortable: true,
      render: (v) => v ? new Date(v).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      label: i18nStore.t('common.actions'),
      render: (_, row) => (
        <div class="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/products/${row.id}`); }}
            class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
          >
            {i18nStore.t('common.edit')}
          </button>
          <Show when={authStore.isEditorOrAbove()}>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
              class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
            >
              {i18nStore.t('common.delete')}
            </button>
          </Show>
        </div>
      ),
    },
  ]);

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{i18nStore.t('products.title')}</h1>
        <Show when={authStore.isEditorOrAbove()}>
          <A href="/products/new" class={`${ENTITY_TYPE_BUTTON_CLASSES.product} px-4 py-2 rounded font-medium transition-colors`}>
            {i18nStore.t('products.addProduct')}
          </A>
        </Show>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <label for="product-search" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('common.search')}</label>
          <input
            id="product-search"
            data-testid="product-search"
            ref={searchInputRef}
            type="text"
            value={search()}
            onInput={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
            placeholder={i18nStore.t('products.searchPlaceholder')}
            class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div class="w-64">
          <label for="product-category" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('common.category')}</label>
          <Combobox
            id="product-category"
            testId="product-category"
            value={categoryFilter()}
            onChange={(v) => { setCategoryFilter(v); setPage(1); }}
            options={(categories()?.items || []).map((c) => ({ value: c.id, label: c.name }))}
            placeholder={i18nStore.t('common.allCategories')}
            clearLabel={i18nStore.t('common.allCategories')}
            emptyMessage={i18nStore.t('products.noMatchingCategory')}
          />
        </div>
        <div class="w-56">
          <label for="product-status" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('common.status')}</label>
          <Combobox
            id="product-status"
            testId="product-status"
            value={activeFilter()}
            onChange={(v) => { setActiveFilter(v); setPage(1); }}
            options={[
              { value: 'active', label: i18nStore.t('common.active') },
              { value: 'inactive', label: i18nStore.t('common.inactive') },
            ]}
            placeholder={i18nStore.t('common.allStatuses')}
            clearLabel={i18nStore.t('common.allStatuses')}
          />
        </div>
      </div>

      <Show
        when={!data.loading}
        fallback={<div class="text-gray-500 dark:text-gray-400">{i18nStore.t('products.loading')}</div>}
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <Table
            columns={columns()}
            data={data()?.items || []}
            sortKey={sortKey()}
            sortDir={sortDir()}
            onSort={handleSort}
            onRowClick={(row) => navigate(`/products/${row.id}`)}
            emptyMessage={i18nStore.t('products.empty')}
          />
        </div>

        <Show when={data()?.totalPages && data()!.totalPages > 1}>
          <div class="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page() === 1}
              class="px-3 py-1 bg-gray-50 dark:bg-gray-700 rounded text-gray-900 dark:text-white disabled:opacity-50"
            >
              {i18nStore.t('common.previous')}
            </button>
            <span class="text-gray-500 dark:text-gray-400 py-1 px-3">
              {i18nStore.t('common.pageOf', { page: page(), total: data()?.totalPages || 1 })}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page() >= (data()?.totalPages || 1)}
              class="px-3 py-1 bg-gray-50 dark:bg-gray-700 rounded text-gray-900 dark:text-white disabled:opacity-50"
            >
              {i18nStore.t('common.next')}
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
}
