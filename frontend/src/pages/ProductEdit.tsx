import { createSignal, createResource, For, Show, onMount } from 'solid-js';
import { useNavigate, useParams, useLocation } from '@solidjs/router';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { slugify } from '~/utils/slug';
import MediaThumb from '~/components/media/MediaThumb';
import Combobox from '~/components/ui/Combobox';
import type { Product, Category, Media } from '~/types';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

async function fetchCategories() {
  const tenant = getCurrentTenant();
  const filter = tenant ? `tenant = "${tenant}"` : '';
  return await pb.collection('categories').getList<Category>(1, 200, { filter, sort: 'name' });
}

async function fetchMedia() {
  const tenant = getCurrentTenant();
  const filter = tenant ? `tenant = "${tenant}"` : '';
  return await pb.collection('media').getList<Media>(1, 200, { filter, sort: '-created' });
}

export default function ProductEdit() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  const isNew = () => params.id === 'new' || location.pathname.endsWith('/new');

  const [formData, setFormData] = createSignal({
    name: '',
    slug: '',
    category: '',
    price: 0,
    description: '',
    media: [] as string[],
    active: true,
    sort_order: 0,
    custom_fields: '',
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = createSignal(false);
  const [selectedMediaIds, setSelectedMediaIds] = createSignal<string[]>([]);
  const [selectedMediaRecords, setSelectedMediaRecords] = createSignal<Media[]>([]);
  const [mediaLoading, setMediaLoading] = createSignal(true);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);
  const [dragOverIndex, setDragOverIndex] = createSignal<number | null>(null);

  const [categories] = createResource(fetchCategories);
  const [media] = createResource(fetchMedia);

  let dragSourceIndex: number | null = null;

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
    if (!authStore.isEditorOrAbove()) {
      navigate('/', { replace: true });
      return;
    }

    const tenant = getCurrentTenant();
    if (!tenant) {
      setError('No tenant selected');
      setLoading(false);
      setMediaLoading(false);
      return;
    }

    if (params.id && !isNew()) {
      try {
        const product = await pb.collection('products').getOne<Product>(params.id);
        setFormData({
          name: product.name || '',
          slug: product.slug || '',
          category: product.category || '',
          price: product.price ?? 0,
          description: product.description || '',
          media: product.media || [],
          active: product.active ?? true,
          sort_order: product.sort_order ?? 0,
          custom_fields: product.custom_fields || '',
        });
        setSlugManuallyEdited(true);

        if (product.media && product.media.length > 0) {
          const records = await Promise.all(
            product.media.map((id: string) =>
              pb.collection('media').getOne<Media>(id).catch(() => null)
            )
          );
          const valid = records.filter((r): r is Media => r !== null);
          setSelectedMediaIds(valid.map(r => r.id));
          setSelectedMediaRecords(valid);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load product');
      }
    }
    setLoading(false);
    setMediaLoading(false);
  });

  const handleNameChange = (name: string) => {
    setFormData(d => ({
      ...d,
      name,
      slug: slugManuallyEdited() ? d.slug : slugify(name),
    }));
  };

  const handleSlugChange = (slug: string) => {
    setSlugManuallyEdited(true);
    setFormData(d => ({ ...d, slug: slugify(slug) }));
  };

  const handleToggleMedia = (m: Media) => {
    if (selectedMediaIds().includes(m.id)) {
      setSelectedMediaIds(prev => prev.filter(id => id !== m.id));
      setSelectedMediaRecords(prev => prev.filter(r => r.id !== m.id));
    } else {
      setSelectedMediaIds(prev => [...prev, m.id]);
      setSelectedMediaRecords(prev => [...prev, m]);
    }
  };

  const handleRemoveSelected = (id: string) => {
    setSelectedMediaIds(prev => prev.filter(i => i !== id));
    setSelectedMediaRecords(prev => prev.filter(r => r.id !== id));
  };

  const handleDragStart = (index: number) => (e: DragEvent) => {
    dragSourceIndex = index;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: DragEvent) => {
    e.preventDefault();
    setDragOverIndex(index);
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => setDragOverIndex(null);

  const handleDrop = (targetIndex: number) => (e: DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
    const source = dragSourceIndex;
    if (source === null || source === targetIndex) {
      dragSourceIndex = null;
      return;
    }
    setSelectedMediaIds(prev => {
      const next = [...prev];
      const [moved] = next.splice(source, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setSelectedMediaRecords(prev => {
      const next = [...prev];
      const [moved] = next.splice(source, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    dragSourceIndex = null;
  };

  const handleDragEnd = () => {
    dragSourceIndex = null;
    setDragOverIndex(null);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    const tenant = getCurrentTenant();
    if (!tenant) {
      setError('No tenant selected');
      setSaving(false);
      return;
    }

    try {
      const payload: any = {
        name: formData().name,
        slug: formData().slug,
        category: formData().category || null,
        price: formData().price,
        description: formData().description,
        media: selectedMediaIds(),
        active: formData().active,
        sort_order: formData().sort_order,
        custom_fields: formData().custom_fields,
      };

      if (isNew()) {
        payload.tenant = tenant;
        await pb.collection('products').create(payload);
      } else {
        await pb.collection('products').update(params.id!, payload);
      }
      sidebarStore.bump();
      setSuccess(true);
      setTimeout(() => navigate('/products'), 1500);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="space-y-6 max-w-2xl">
      <div class="flex items-center gap-4">
        <button
          onClick={() => navigate('/products')}
          class="text-gray-400 hover:text-white"
        >
          ← Back
        </button>
        <h1 class="text-2xl font-bold text-white">
          {isNew() ? 'New Product' : 'Edit Product'}
        </h1>
      </div>

      <Show when={loading()}>
        <div class="text-gray-400">Loading...</div>
      </Show>

      <Show when={error() && !loading()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <Show when={success()}>
        <div class="bg-green-500/10 border border-green-500 rounded p-4 text-green-400 text-sm">
          Product saved successfully!
        </div>
      </Show>

      <Show when={!loading() && !error()}>
        <form onSubmit={handleSubmit} class="bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="prod-name">Name</label>
            <input
              id="prod-name"
              type="text"
              placeholder="Product name"
              value={formData().name}
              onInput={(e) => handleNameChange(e.currentTarget.value)}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="prod-slug">
              Slug
              <Show when={!slugManuallyEdited()}>
                <span class="ml-2 text-xs text-gray-500">(auto-generated from name)</span>
              </Show>
            </label>
            <input
              id="prod-slug"
              type="text"
              placeholder="product-slug"
              value={formData().slug}
              onInput={(e) => handleSlugChange(e.currentTarget.value)}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="prod-category">Category</label>
            <Combobox
              id="prod-category"
              testId="prod-category"
              value={formData().category}
              onChange={(v) => setFormData(d => ({ ...d, category: v }))}
              options={(categories()?.items || []).map(c => ({ value: c.id, label: c.name }))}
              placeholder="Type to search categories…"
              emptyMessage="No matching category"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="prod-price">Price</label>
            <input
              id="prod-price"
              type="number"
              step="0.01"
              value={formData().price}
              onInput={(e) => setFormData(d => ({ ...d, price: parseFloat(e.currentTarget.value) || 0 }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="prod-desc">Description</label>
            <textarea
              id="prod-desc"
              placeholder="Product description"
              value={formData().description}
              onInput={(e) => setFormData(d => ({ ...d, description: e.currentTarget.value }))}
              rows="4"
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div class="flex items-center gap-4">
            <label class="block text-sm font-medium text-gray-300">Active</label>
            <button
              type="button"
              onClick={() => setFormData(d => ({ ...d, active: !d.active }))}
              class={`px-3 py-1 rounded text-sm font-medium ${
                formData().active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
              }`}
            >
              {formData().active ? 'Yes' : 'No'}
            </button>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="prod-sort">Sort Order</label>
            <input
              id="prod-sort"
              type="number"
              value={formData().sort_order}
              onInput={(e) => setFormData(d => ({ ...d, sort_order: parseInt(e.currentTarget.value) || 0 }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="prod-custom-fields">Custom Fields (JSON)</label>
            <textarea
              id="prod-custom-fields"
              placeholder='{"key": "value"}'
              value={formData().custom_fields}
              onInput={(e) => setFormData(d => ({ ...d, custom_fields: e.currentTarget.value }))}
              rows="3"
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-300">Media</label>
              <Show when={selectedMediaRecords().length > 0}>
                <span class="text-xs text-gray-500">
                  {selectedMediaRecords().length} selected · drag to reorder
                </span>
              </Show>
            </div>

            <Show when={mediaLoading()}>
              <div class="flex items-center gap-2 text-gray-400 text-sm py-4">
                <div class="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                Loading media records...
              </div>
            </Show>

            <Show when={!mediaLoading() && selectedMediaRecords().length > 0}>
              <div
                data-testid="prod-selected-media"
                class="grid grid-cols-4 gap-2 mb-4"
              >
                <For each={selectedMediaRecords()}>
                  {(m, i) => (
                    <div
                      data-testid={`prod-selected-media-${m.id}`}
                      draggable={true}
                      onDragStart={handleDragStart(i())}
                      onDragOver={handleDragOver(i())}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop(i())}
                      onDragEnd={handleDragEnd}
                      class={`relative group cursor-move bg-gray-700 rounded border-2 ${
                        dragOverIndex() === i() ? 'border-blue-500' : 'border-transparent'
                      }`}
                    >
                      <MediaThumb media={m} thumb="200x200" class="w-full h-20 object-cover rounded" />
                      <button
                        type="button"
                        onClick={() => handleRemoveSelected(m.id)}
                        class="absolute top-1 right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100"
                        title="Remove"
                      >
                        ×
                      </button>
                      <span class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center px-1 truncate">
                        {i() + 1}. {m.filename}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={!mediaLoading()}>
              <div>
                <p class="text-xs text-gray-500 mb-2">
                  Pick from media library:
                </p>
                <Show
                  when={media()?.items && media()!.items.length > 0}
                  fallback={
                    <div class="bg-gray-700/50 rounded p-4 text-center text-sm">
                      <p class="text-gray-400">
                        No media uploaded yet.
                      </p>
                      <a
                        href="/media/new"
                        class="text-blue-400 hover:text-blue-300 underline"
                      >
                        Upload some at /media/new
                      </a>
                      <p class="text-gray-400">
                        first.
                      </p>
                    </div>
                  }
                >
                  <div
                    data-testid="prod-media-picker"
                    class="border border-gray-700 rounded bg-gray-900/40 max-h-96 overflow-y-auto p-2"
                  >
                    <div class="grid grid-cols-6 gap-2">
                    <For each={media()?.items || []}>
                      {(m) => (
                        <Show when={m.file}>
                          <button
                            type="button"
                            onClick={() => handleToggleMedia(m)}
                            data-testid={`prod-media-pick-${m.id}`}
                            class={`relative border-2 rounded overflow-hidden ${
                              selectedMediaIds().includes(m.id) ? 'border-blue-500 opacity-50' : 'border-gray-600 hover:border-gray-400'
                            }`}
                            title={m.filename}
                          >
                            <MediaThumb media={m} thumb="100x100" class="w-full h-16 object-cover" />
                          </button>
                        </Show>
                      )}
                    </For>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving() || mediaLoading()}
              class={`${PRIMARY_BUTTON_CLASSES} text-white font-medium py-2 px-6 rounded disabled:opacity-50`}
            >
              {saving() ? 'Saving...' : 'Save Product'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/products')}
              class="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      </Show>
    </div>
  );
}
