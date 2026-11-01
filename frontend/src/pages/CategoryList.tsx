import { createSignal, createResource, createMemo, Show, onMount } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import Table, { Column } from '~/components/ui/Table';
import { pb, tenantFilter, toSortExpr } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { tenantStore } from '~/stores/tenant';
import MediaThumb from '~/components/media/MediaThumb';
import ActiveBadge from '~/components/ui/ActiveBadge';
import { ImageOff } from 'lucide-solid';
import { ENTITY_TYPE_BUTTON_CLASSES } from '~/styles/colors';
import Combobox from '~/components/ui/Combobox';
import { confirmDialog, alertDialog } from '~/components/ui/ConfirmDialog';
import { i18nStore } from '~/i18n';
import { errorMessage } from '~/utils/errors';
import type { Media } from '~/types';

const PER_PAGE = 50;

async function fetchCategories(src: { page: number; sortKey: string; sortDir: 'asc' | 'desc'; search: string; active: string }) {
  const parts: string[] = [];
  const tf = tenantFilter();
  if (tf) parts.push(tf);
  const q = src.search.trim();
  if (q) parts.push(pb.filter('(name ?~ {:q} || slug ?~ {:q} || description ?~ {:q})', { q }));
  if (src.active === 'active') parts.push('active = true');
  if (src.active === 'inactive') parts.push('active = false');
  return await pb.collection('categories').getList(src.page, PER_PAGE, {
    filter: parts.join(' && '),
    sort: toSortExpr(src.sortKey, src.sortDir, 'name'),
    expand: 'media',
  });
}

export default function CategoryList() {
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
  const [activeFilter, setActiveFilter] = createSignal('');

  // tenantStore.version inside the source accessor ensures data
  // refetches when the active tenant changes — the imperative
  // getCurrentTenant() inside fetchCategories would otherwise
  // read a stale value for a refetch that never fires.
  const [data, { refetch }] = createResource(
    () => ({ page: page(), sortKey: sortKey(), sortDir: sortDir(), search: search(), active: activeFilter(), tenantVersion: tenantStore.version }),
    fetchCategories
  );

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ message: i18nStore.t('categories.deleteConfirm'), danger: true }))) return;
    try {
      await pb.collection('categories').delete(id);
      sidebarStore.bump();
      refetch();
    } catch (e: unknown) {
      void alertDialog(i18nStore.t('common.failedToDelete', { msg: errorMessage(e) }));
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await pb.collection('categories').update(id, { active: !currentActive });
      sidebarStore.bump();
      refetch();
    } catch (e: unknown) {
      void alertDialog(i18nStore.t('common.failedToUpdate', { msg: errorMessage(e) }));
    }
  };

  const columns = createMemo<Column[]>(() => [
    {
      key: 'media',
      label: i18nStore.t('categories.thumb'),
      render: (_, row) => {
        const expand = row.expand as Record<string, unknown> | undefined;
        const m = expand?.media as Media | undefined;
        return (
          <Show
            when={m?.file}
            fallback={
              <div class="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded flex items-center justify-center" title={i18nStore.t('categories.noMedia')}>
                <ImageOff size={16} class="text-gray-600 dark:text-gray-500" />
              </div>
            }
          >
            <div class="w-12 h-12 rounded overflow-hidden bg-gray-900 dark:bg-black">
              <MediaThumb media={m!} thumb="100x100" class="w-12 h-12 object-cover" />
            </div>
          </Show>
        );
      },
    },
    { key: 'name', label: i18nStore.t('common.name'), sortable: true },
    { key: 'slug', label: i18nStore.t('common.slug'), sortable: true },
    { key: 'description', label: i18nStore.t('common.description') },
    {
      key: 'active',
      label: i18nStore.t('common.active'),
      sortable: true,
      render: (v, row) => (
        <ActiveBadge
          active={!!v}
          size="sm"
          onClick={() => handleToggleActive(String(row.id), !!v)}
        />
      ),
    },
    {
      key: 'sort_order',
      label: i18nStore.t('common.sortOrder'),
      sortable: true,
      render: (v) => (v as number | null | undefined) ?? '-',
    },
    {
      key: 'created',
      label: i18nStore.t('common.created'),
      sortable: true,
      render: (v) => v ? new Date(v as string | number).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      label: i18nStore.t('common.actions'),
      render: (_, row) => (
        <div class="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/categories/${row.id}`); }}
            class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
          >
            {i18nStore.t('common.edit')}
          </button>
          <Show when={authStore.isEditorOrAbove()}>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(String(row.id)); }}
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{i18nStore.t('categories.title')}</h1>
        <Show when={authStore.isEditorOrAbove()}>
          <A href="/categories/new" class={`${ENTITY_TYPE_BUTTON_CLASSES.category} px-4 py-2 rounded font-medium transition-colors`}>
            {i18nStore.t('categories.addCategory')}
          </A>
        </Show>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <label for="category-search" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('common.search')}</label>
          <input
            id="category-search"
            data-testid="category-search"
            ref={searchInputRef}
            type="text"
            value={search()}
            onInput={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
            placeholder={i18nStore.t('categories.searchPlaceholder')}
            class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div class="w-56">
          <label for="category-status" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('common.status')}</label>
          <Combobox
            id="category-status"
            testId="category-status"
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
        fallback={<div class="text-gray-500 dark:text-gray-400">{i18nStore.t('categories.loading')}</div>}
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <Table
            columns={columns()}
            data={(data()?.items || []) as unknown as Record<string, unknown>[]}
            sortKey={sortKey()}
            sortDir={sortDir()}
            onSort={handleSort}
            onRowClick={(row) => navigate(`/categories/${row.id}`)}
            emptyMessage={i18nStore.t('categories.empty')}
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