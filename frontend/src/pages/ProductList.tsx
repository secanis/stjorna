import { createSignal, createResource, Show, onMount } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { Package } from 'lucide-solid';
import Table, { Column } from '~/components/ui/Table';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import type { Product } from '~/types';

async function fetchProducts() {
  const tenant = getCurrentTenant();
  const filter = tenant ? `tenant = "${tenant}"` : '';
  return await pb.collection('products').getList<Product>(1, 50, {
    filter,
    sort: 'sort_order,name',
  });
}

export default function ProductList() {
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
  const [sortKey, setSortKey] = createSignal('sort_order');
  const [sortDir, setSortDir] = createSignal<'asc' | 'desc'>('asc');

  const [data, { refetch }] = createResource(
    () => ({ page: page(), sortKey: sortKey(), sortDir: sortDir() }),
    fetchProducts
  );

  const handleSort = (key: string, dir: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(dir);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await pb.collection('products').delete(id);
      sidebarStore.bump();
      refetch();
    } catch (e: any) {
      alert(`Failed to delete: ${e.message}`);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await pb.collection('products').update(id, { active: !currentActive });
      sidebarStore.bump();
      refetch();
    } catch (e: any) {
      alert(`Failed to update: ${e.message}`);
    }
  };

  const columns: Column[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
    },
    { key: 'slug', label: 'Slug', sortable: true },
    {
      key: 'category',
      label: 'Category',
      render: (v) => v || '-',
    },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      render: (v) => v != null ? `${v.toFixed(2)}` : '-',
    },
    {
      key: 'active',
      label: 'Active',
      sortable: true,
      render: (v, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleActive(row.id, v); }}
          class={`px-2 py-1 rounded text-xs font-medium ${
            v ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
          }`}
        >
          {v ? 'Yes' : 'No'}
        </button>
      ),
    },
    {
      key: 'sort_order',
      label: 'Sort Order',
      sortable: true,
      render: (v) => v ?? '-',
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
            onClick={(e) => { e.stopPropagation(); navigate(`/products/${row.id}`); }}
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
        <h1 class="text-2xl font-bold text-white">Products</h1>
        <Show when={authStore.isEditorOrAbove()}>
          <A href="/products/new" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors">
            + Add Product
          </A>
        </Show>
      </div>

      <Show
        when={!data.loading}
        fallback={<div class="text-gray-400">Loading products...</div>}
      >
        <div class="bg-gray-800 rounded-lg overflow-hidden">
          <Table
            columns={columns}
            data={data()?.items || []}
            sortKey={sortKey()}
            sortDir={sortDir()}
            onSort={handleSort}
            onRowClick={(row) => navigate(`/products/${row.id}`)}
            emptyMessage="No products yet"
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
