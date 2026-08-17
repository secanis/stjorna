import { createSignal, createResource, For, Show, onMount } from 'solid-js';
import { useNavigate, useParams, useLocation } from '@solidjs/router';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { sidebarStore } from '~/stores/sidebar';
import { slugify } from '~/utils/slug';
import { getMediaFileUrl } from '~/utils/mediaUrl';
import type { Media } from '~/types';

async function fetchMedia() {
  const tenant = getCurrentTenant();
  const filter = tenant ? `tenant = "${tenant}"` : '';
  return await pb.collection('media').getList<Media>(1, 200, { filter, sort: '-created' });
}

export default function CategoryEdit() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  const [formData, setFormData] = createSignal({
    name: '',
    slug: '',
    description: '',
    active: true,
    sort_order: 0,
    media: '',
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);

  const [media] = createResource(fetchMedia);

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
    if (!tenant && !authStore.isPBAdmin) {
      setError('No tenant selected');
      setLoading(false);
      return;
    }

    const isNewCategory = params.id === 'new' || location.pathname.endsWith('/new');
    if (params.id && !isNewCategory) {
      try {
        const category = await pb.collection('categories').getOne(params.id, { expand: 'media' });
        setFormData({
          name: category.name || '',
          slug: category.slug || '',
          description: category.description || '',
          active: category.active ?? true,
          sort_order: category.sort_order ?? 0,
          media: category.media || '',
        });
        setSlugManuallyEdited(true);
      } catch (e: any) {
        setError(e.message || 'Failed to load category');
      }
    }
    setLoading(false);
  });

  const selectedMedia = (): Media | null => {
    const id = formData().media;
    if (!id) return null;
    return media()?.items?.find((m) => m.id === id) || null;
  };

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

  const handleSelectMedia = (m: Media) => {
    setFormData(d => ({ ...d, media: m.id }));
  };

  const handleClearMedia = () => {
    setFormData(d => ({ ...d, media: '' }));
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    let tenant = getCurrentTenant();
    if (!tenant && authStore.isPBAdmin) {
      try {
        const tenants = await pb.collection('tenants').getList(1, 1);
        if (tenants.items.length > 0) {
          tenant = tenants.items[0].id;
        }
      } catch {}
    }

    const isNewCategory = params.id === 'new' || location.pathname.endsWith('/new');

    try {
      const payload: any = {
        name: formData().name,
        slug: formData().slug,
        description: formData().description,
        active: formData().active,
        sort_order: formData().sort_order,
        media: formData().media || '',
      };

      if (isNewCategory && tenant) {
        payload.tenant = tenant;
      }

      if (isNewCategory) {
        await pb.collection('categories').create(payload);
      } else {
        await pb.collection('categories').update(params.id!, payload);
      }
      sidebarStore.bump();
      setSuccess(true);
      setTimeout(() => navigate('/categories'), 1500);
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
          onClick={() => navigate('/categories')}
          class="text-gray-400 hover:text-white"
        >
          ← Back
        </button>
        <h1 class="text-2xl font-bold text-white">
          {location.pathname.endsWith('/new') ? 'New Category' : 'Edit Category'}
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
          Category saved successfully!
        </div>
      </Show>

      <Show when={!loading() && !error()}>
        <form onSubmit={handleSubmit} class="bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="cat-name">Name</label>
            <input
              id="cat-name"
              type="text"
              placeholder="Category name"
              value={formData().name}
              onInput={(e) => handleNameChange(e.currentTarget.value)}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="cat-slug">
              Slug
              <Show when={!slugManuallyEdited()}>
                <span class="ml-2 text-xs text-gray-500">(auto-generated from name)</span>
              </Show>
            </label>
            <input
              id="cat-slug"
              type="text"
              placeholder="category-slug"
              value={formData().slug}
              onInput={(e) => handleSlugChange(e.currentTarget.value)}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="cat-desc">Description</label>
            <input
              id="cat-desc"
              type="text"
              placeholder="Optional description"
              value={formData().description}
              onInput={(e) => setFormData(d => ({ ...d, description: e.currentTarget.value }))}
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
            <label class="block text-sm font-medium text-gray-300 mb-1">Sort Order</label>
            <input
              type="number"
              value={formData().sort_order}
              onInput={(e) => setFormData(d => ({ ...d, sort_order: parseInt(e.currentTarget.value) || 0 }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-300">Media</label>
              <Show when={selectedMedia()}>
                <button
                  type="button"
                  onClick={handleClearMedia}
                  class="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </Show>
            </div>

            <Show when={selectedMedia()}>
              <div
                data-testid="cat-selected-media"
                data-loaded={selectedMedia()!.mime_type?.startsWith('image/') ? 'pending' : 'no'}
                class="bg-gray-700 rounded p-3 mb-3 flex items-center gap-3 min-h-24"
              >
                <Show
                  when={selectedMedia()!.mime_type?.startsWith('image/')}
                  fallback={
                    <div
                      data-testid="cat-selected-media-fallback"
                      class="w-24 h-24 bg-gray-600 rounded flex items-center justify-center text-xs text-gray-300 p-2 text-center"
                    >
                      {selectedMedia()!.filename}
                    </div>
                  }
                >
                  <img
                    src={getMediaFileUrl(selectedMedia()!.id, selectedMedia()!.file || '', { thumb: '200x200' })}
                    alt={selectedMedia()!.filename || ''}
                    class="w-24 h-24 object-cover rounded"
                    onLoad={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).dataset.loaded = 'yes';
                    }}
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      const parent = img.parentElement as HTMLElement;
                      if (!parent) return;
                      parent.dataset.loaded = 'error';
                      const placeholder = document.createElement('div');
                      placeholder.setAttribute('data-testid', 'cat-selected-media-fallback');
                      placeholder.className = 'w-24 h-24 bg-gray-600 rounded flex items-center justify-center text-xs text-gray-300 p-2 text-center';
                      placeholder.textContent = selectedMedia()!.filename || '';
                      img.replaceWith(placeholder);
                    }}
                  />
                </Show>
                <div class="flex-1 min-w-0">
                  <div class="text-white text-sm truncate">{selectedMedia()!.filename}</div>
                  <div class="text-gray-400 text-xs">{selectedMedia()!.mime_type}</div>
                </div>
              </div>
            </Show>

            <Show when={media.loading}>
              <div class="flex items-center gap-2 text-gray-400 text-sm py-4">
                <div class="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
                Loading media library...
              </div>
            </Show>

            <Show when={!media.loading && (media()?.items?.length || 0) > 0}>
              <p class="text-xs text-gray-500 mb-2">Pick one (replaces current):</p>
              <div
                data-testid="cat-media-picker"
                class="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1"
              >
                <For each={media()?.items || []}>
                  {(m) => (
                    <Show when={m.file}>
                      <button
                        type="button"
                        onClick={() => handleSelectMedia(m)}
                        data-testid={`cat-media-pick-${m.id}`}
                        class={`relative border-2 rounded overflow-hidden ${
                          formData().media === m.id
                            ? 'border-blue-500 opacity-50'
                            : 'border-gray-600 hover:border-gray-400'
                        }`}
                        title={m.filename}
                      >
                        <Show when={m.mime_type?.startsWith('image/')}>
                          <img
                            src={getMediaFileUrl(m.id, m.file!, { thumb: '100x100' })}
                            alt={m.filename || ''}
                            class="w-full h-16 object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </Show>
                        <Show when={!m.mime_type?.startsWith('image/')}>
                          <div class="w-full h-16 bg-gray-700 flex items-center justify-center text-xs text-gray-400 p-1 truncate">
                            {m.filename}
                          </div>
                        </Show>
                      </button>
                    </Show>
                  )}
                </For>
              </div>
            </Show>

            <Show when={!media.loading && (media()?.items?.length || 0) === 0}>
              <p class="text-gray-400 text-sm">
                No media uploaded yet. <a href="/media/new" class="text-blue-400 hover:underline">Upload some at /media/new</a> first.
              </p>
            </Show>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving()}
              class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded disabled:opacity-50"
            >
              {saving() ? 'Saving...' : 'Save Category'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/categories')}
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
