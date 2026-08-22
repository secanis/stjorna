import { createSignal, createResource, Show, For, onMount } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { FileText, Video } from 'lucide-solid';
import Table, { Column } from '~/components/ui/Table';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { getMediaFileUrl } from '~/utils/mediaUrl';
import { ENTITY_TYPE_BUTTON_CLASSES } from '~/styles/colors';
import type { Media } from '~/types';

async function fetchMedia(filterType: string) {
  const tenant = getCurrentTenant();
  const parts: string[] = [];
  if (tenant) parts.push(`tenant = "${tenant}"`);
  if (filterType === 'image') parts.push(`mime_type ?~ "image/"`);
  if (filterType === 'video') parts.push(`mime_type ?~ "video/"`);
  const filter = parts.length ? parts.join(' && ') : '';
  return await pb.collection('media').getList<Media>(1, 50, {
    filter,
    sort: '-created',
  });
}

export default function MediaList() {
  const navigate = useNavigate();

  onMount(async () => {
    await authStore.init();
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    if (authStore.isPBAdmin) {
      navigate('/', { replace: true });
      return;
    }
  });

  const [page, setPage] = createSignal(1);
  const [sortKey, setSortKey] = createSignal('created');
  const [sortDir, setSortDir] = createSignal<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = createSignal('');

  const [data, { refetch }] = createResource(
    () => ({ filterType: filterType() }),
    ({ filterType }) => fetchMedia(filterType)
  );

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this media item?')) return;
    try {
      await pb.collection('media').delete(id);
      sidebarStore.bump();
      refetch();
    } catch (e: any) {
      alert(`Failed to delete: ${e.message}`);
    }
  };

  const columns: Column[] = [
    {
      key: 'file',
      label: 'Preview',
      render: (v, row) => (
        <div class="w-12 h-12 bg-gray-700 rounded flex items-center justify-center overflow-hidden bg-black">
          <Show when={row.mime_type?.startsWith('image/') && v}>
            <img
              src={getMediaFileUrl(row.id, v, { thumb: '100x100' })}
              alt={row.filename || ''}
              class="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
                onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
              />
              <Video size={20} class="absolute text-white drop-shadow pointer-events-none" />
            </div>
          </Show>
          <Show when={!v || (!row.mime_type?.startsWith('image/') && !row.mime_type?.startsWith('video/'))}>
            <FileText size={16} class="text-gray-400" />
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
      key: 'usage_count',
      label: 'Usage',
      sortable: true,
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
            class="text-blue-400 hover:text-blue-300 text-sm"
          >
            Edit
          </button>
          <Show when={authStore.isEditorOrAbove()}>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
              class="text-red-400 hover:text-red-300 text-sm"
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
        <h1 class="text-2xl font-bold text-white">Media</h1>
        <Show when={authStore.isEditorOrAbove()}>
          <A href="/media/new" class={`${ENTITY_TYPE_BUTTON_CLASSES.media} text-white px-4 py-2 rounded font-medium transition-colors`}>
            + Add Media
          </A>
        </Show>
      </div>

      <div class="flex gap-4 items-center">
        <select
          value={filterType()}
          onChange={(e) => setFilterType(e.currentTarget.value)}
          class="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
        >
          <option value="">All types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
      </div>

      <Show
        when={!data.loading}
        fallback={<div class="text-gray-400">Loading media...</div>}
      >
        <div class="bg-gray-800 rounded-lg overflow-hidden">
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
              class="px-3 py-1 bg-gray-700 rounded text-white disabled:opacity-50"
            >
              Previous
            </button>
            <span class="text-gray-400 py-1 px-3">
              Page {page()} of {data()?.totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page() >= (data()?.totalPages || 1)}
              class="px-3 py-1 bg-gray-700 rounded text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
}