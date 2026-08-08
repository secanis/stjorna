import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import type { Tenant } from '~/types';

export default function Settings() {
  const navigate = useNavigate();

  const [formData, setFormData] = createSignal({
    name: '',
    slug: '',
    plan: 'starter',
    custom_domain: '',
    theme_config: '',
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

    const tenantId = authStore.currentTenant;

    if (!tenantId) {
      if (authStore.isPBAdmin) {
        navigate('/tenants', { replace: true });
        return;
      }
      setError('No tenant selected. Please use the tenant selector in the header.');
      setLoading(false);
      return;
    }

    try {
      const tenant = await pb.collection('tenants').getOne<Tenant>(tenantId);
      setFormData({
        name: tenant.name || '',
        slug: tenant.slug || '',
        plan: tenant.plan || 'starter',
        custom_domain: tenant.custom_domain || '',
        theme_config: tenant.theme_config || '{}',
      });
    } catch (e: any) {
      setError(e.message || 'Failed to load tenant settings');
    } finally {
      setLoading(false);
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const tenantId = authStore.currentTenant;
    if (!tenantId) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const themeConfig = JSON.parse(formData().theme_config || '{}');
      await pb.collection('tenants').update(tenantId, {
        name: formData().name,
        slug: formData().slug,
        plan: formData().plan,
        custom_domain: formData().custom_domain,
        theme_config: JSON.stringify(themeConfig),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="space-y-6 max-w-2xl">
      <h1 class="text-2xl font-bold text-white">Tenant Settings</h1>

      <Show when={loading()}>
        <div class="text-gray-400">Loading...</div>
      </Show>

      <Show when={error() && !loading()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-400 text-sm">
          {error()}
        </div>
        <Show when={!authStore.isPBAdmin && !authStore.currentTenant}>
          <p class="text-gray-400 text-sm">
            Use the tenant selector in the header to select a tenant.
          </p>
        </Show>
      </Show>

      <Show when={success()}>
        <div class="bg-green-500/10 border border-green-500 rounded p-4 text-green-400 text-sm">
          Settings saved successfully!
        </div>
      </Show>

      <Show when={!loading() && !error()}>
        <form onSubmit={handleSubmit} class="bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Company Name</label>
            <input
              type="text"
              value={formData().name}
              onInput={(e) => setFormData(d => ({ ...d, name: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Slug</label>
            <input
              type="text"
              value={formData().slug}
              onInput={(e) => setFormData(d => ({ ...d, slug: e.currentTarget.value.toLowerCase().replace(/\s+/g, '-') }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Plan</label>
            <select
              value={formData().plan}
              onChange={(e) => setFormData(d => ({ ...d, plan: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Custom Domain</label>
            <input
              type="text"
              value={formData().custom_domain}
              onInput={(e) => setFormData(d => ({ ...d, custom_domain: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="media.example.com"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Theme Config (JSON)</label>
            <textarea
              value={formData().theme_config}
              onInput={(e) => setFormData(d => ({ ...d, theme_config: e.currentTarget.value }))}
              rows={4}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
              placeholder='{"primaryColor": "#000000"}'
            />
          </div>

          <button
            type="submit"
            disabled={saving()}
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded disabled:opacity-50"
          >
            {saving() ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </Show>
    </div>
  );
}