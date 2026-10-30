import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { FileText, Video } from 'lucide-solid';
import Table, { Column } from '~/components/ui/Table';
import { pb, tenantFilter, toSortExpr } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { tenantStore } from '~/stores/tenant';
import { getMediaFileUrl, isAwaitingFileToken } from '~/utils/mediaUrl';
import { ENTITY_TYPE_BUTTON_CLASSES } from '~/styles/colors';
import type { Media } from '~/types';
import { confirmDialog, alertDialog } from '~/components/ui/ConfirmDialog';

const PER_PAGE = 50;

async function fetchMedia(src: { page: number; sortKey: string; sortDir: 'asc' | 'desc'; filterType: string; search: string }) {
  const parts: string[] = [];
  const tf = tenantFilter();
  if (tf) parts.push(tf);
  if (src.filterType === 'image') parts.push(`mime_type ?~ "image/"`);
  if (src.filterType === 'video') parts.push(`mime_type ?~ "video/"`);
  const q = src.search.trim();
  if (q) parts.push(pb.filter('(filename ?~ {:q} || original_name ?~ {:q})', { q }));
  return await pb.collection('media').getList<Media>(src.page, PER_PAGE, {
    filter: parts.join(' && '),
    sort: toSortExpr(src.sortKey, src.sortDir, 'id'),
  });
}

export default function MediaList() {
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
  const [sortKey, setSortKey] = createSignal('created');
  const [sortDir, setSortDir] = createSignal<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = createSignal('');
  const [search, setSearch] = createSignal('');

  // tenantStore.version inside the source accessor makes the resource
  // re-fire whenever the active tenant changes — without this, the
  // imperative getCurrentTenant() call inside fetchMedia wouldn't
  // trigger a refetch and the page would still show the previous
  // tenant's records after the user switched tenant via the header.
  const [data, { refetch }] = createResource(
    () => ({ page: page(), sortKey: sortKey(), sortDir: sortDir(), filterType: filterType(), search: search(), tenantVersion: tenantStore.version }),
    fetchMedia
  );

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
    setPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ message: 'Delete this media item?', danger: true }))) return;
    try {
      await pb.collection('media').delete(id);
      sidebarStore.bump();
      refetch();
    } catch (e: any) {
      void alertDialog(`Failed to delete: ${e.message}`);
    }
  };

  const columns: Column[] = [
    {
      key: 'file',
      label: 'Preview',
      render: (v, row) => (
        <div class="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded flex items-center justify-center overflow-hidden bg-gray-900 dark:bg-black">
          <Show when={row.mime_type?.startsWith('image/') && v}>
            <img
              src={getMediaFileUrl(row.id, v, { thumb: '100x100' })}
              alt={row.filename || ''}
              class="w-full h-full object-cover"
              onError={(e) => { const el = e.currentTarget as HTMLImageElement; if (!isAwaitingFileToken(el.src)) el.style.display = 'none'; }}
            />
          </Show>
          <Show when={row.mime_type?.startsWith('video/') && v && !row.mime_type?.startsWith('image/')}>
            <div class="relative w-full h-full flex items-center justify-center">
              <video
                src={getMediaFileUrl(row.id, v)}
                class="w-full h-full object-cover"
                muted
                playsinline
                preload="metadata"
                onError={(e) => { const el = e.currentTarget as HTMLVideoElement; if (!isAwaitingFileToken(el.src)) el.style.display = 'none'; }}
              />
              <Video size={20} class="absolute text-gray-900 dark:text-white drop-shadow pointer-events-none" />
            </div>
          </Show>
          <Show when={!v || (!row.mime_type?.startsWith('image/') && !row.mime_type?.startsWith('video/'))}>
            <FileText size={16} class="text-gray-500 dark:text-gray-400" />
          </Show>
        </div>
      ),
    },
    { key: 'filename', label: 'Filename', sortable: true },
    { key: 'mime_type', label: 'Type' },
    {
      key: 'size',
      label: 'Size',
      sortable: true,
      render: (v) => v ? `${(v / 1024).toFixed(1)} KB` : '-',
    },
    {
      key: 'created',
      label: 'Created',
      sortable: true,
      render: (v) => v ? new Date(v).toLocaleDateString() : '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div class="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/media/${row.id}`); }}
            class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
          >
            Edit
          </button>
          <Show when={authStore.isEditorOrAbove()}>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
              class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
            >
              Delete
            </button>
          </Show>
        </div>
      ),
    },
  ];

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Media</h1>
        <Show when={authStore.isEditorOrAbove()}>
          <A href="/media/new" class={`${ENTITY_TYPE_BUTTON_CLASSES.media} px-4 py-2 rounded font-medium transition-colors`}>
            + Add Media
          </A>
        </Show>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <label for="media-search" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
          <input
            id="media-search"
            data-testid="media-search"
            ref={searchInputRef}
            type="text"
            value={search()}
            onInput={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
            placeholder="Search filename…"
            class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label for="media-type" class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select
            id="media-type"
            data-testid="media-type"
            value={filterType()}
            onChange={(e) => { setFilterType(e.currentTarget.value); setPage(1); }}
            class="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm"
          >
            <option value="">All types</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
          </select>
        </div>
      </div>

      <Show
        when={!data.loading}
        fallback={<div class="text-gray-500 dark:text-gray-400">Loading media...</div>}
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <Table
            columns={columns}
            data={data()?.items || []}
            sortKey={sortKey()}
            sortDir={sortDir()}
            onSort={handleSort}
            onRowClick={(row) => navigate(`/media/${row.id}`)}
            emptyMessage="No media items yet"
          />
        </div>

        <Show when={data()?.totalPages && data()!.totalPages > 1}>
          <div class="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page() === 1}
              class="px-3 py-1 bg-gray-50 dark:bg-gray-700 rounded text-gray-900 dark:text-white disabled:opacity-50"
            >
              Previous
            </button>
            <span class="text-gray-500 dark:text-gray-400 py-1 px-3">
              Page {page()} of {data()?.totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page() >= (data()?.totalPages || 1)}
              class="px-3 py-1 bg-gray-50 dark:bg-gray-700 rounded text-gray-900 dark:text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
}