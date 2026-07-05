import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate, useParams, useLocation } from '@solidjs/router';
import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';

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
  });
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);

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
        const category = await pb.collection('categories').getOne(params.id);
        setFormData({
          name: category.name || '',
          slug: category.slug || '',
          description: category.description || '',
          active: category.active ?? true,
          sort_order: category.sort_order ?? 0,
        });
      } catch (e: any) {
        setError(e.message || 'Failed to load category');
      }
    }
    setLoading(false);
  });

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
      };

      if (isNewCategory && tenant) {
        payload.tenant = tenant;
      }

      if (isNewCategory) {
        await pb.collection('categories').create(payload);
      } else {
        await pb.collection('categories').update(params.id!, payload);
      }
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
              onInput={(e) => setFormData(d => ({ ...d, name: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="cat-slug">Slug</label>
            <input
              id="cat-slug"
              type="text"
              placeholder="category-slug"
              value={formData().slug}
              onInput={(e) => setFormData(d => ({ ...d, slug: e.currentTarget.value.toLowerCase().replace(/\s+/g, '-') }))}
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