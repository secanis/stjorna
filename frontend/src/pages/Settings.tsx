import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { tenantTheme } from '~/stores/tenantTheme';
import type { Tenant, TenantThemeConfig } from '~/types';
import { parseThemeConfig, buildThemeConfig, asTrimmedString } from '~/utils/themeConfig';
import ThemeConfigFields, { type ThemeFields } from '~/components/tenants/ThemeConfigFields';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

export default function Settings() {
  const navigate = useNavigate();

  const [formData, setFormData] = createSignal({
    name: '',
    slug: '',
    plan: 'starter',
    custom_domain: '',
  });
  const [theme, setTheme] = createSignal<ThemeFields>({ logoMediaId: '', headerBgLight: '', headerBgDark: '' });
  // Unknown theme_config keys, merged back verbatim on save.
  const [themeExtra, setThemeExtra] = createSignal<TenantThemeConfig>({});
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);

  const loadTenantSettings = async () => {
    const tenantId = authStore.currentTenant;
    if (!tenantId) return;

    try {
      const tenant = await pb.collection('tenants').getOne<Tenant>(tenantId);
      setFormData({
        name: tenant.name || '',
        slug: tenant.slug || '',
        plan: tenant.plan || 'starter',
        custom_domain: tenant.custom_domain || '',
      });
      const cfg = parseThemeConfig(tenant.theme_config);
      setTheme({
        logoMediaId: asTrimmedString(cfg.logoMediaId),
        headerBgLight: asTrimmedString(cfg.headerBgLight),
        headerBgDark: asTrimmedString(cfg.headerBgDark),
      });
      setThemeExtra(cfg);
    } catch (e: any) {
      setError(e.message || 'Failed to load tenant settings');
    }
  };

  onMount(async () => {
    await authStore.init();
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }

    if (authStore.isPBAdmin) {
      navigate('/settings/general', { replace: true });
      return;
    }

    const tenantId = authStore.currentTenant;

    if (!tenantId) {
      setError('No tenant selected. Please use the tenant selector in the header.');
      setLoading(false);
      return;
    }

    if (tenantId) {
      await loadTenantSettings();
    }
    setLoading(false);
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const tenantId = authStore.currentTenant;
    if (!tenantId) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      await pb.collection('tenants').update(tenantId, {
        name: formData().name,
        slug: formData().slug,
        plan: formData().plan,
        custom_domain: formData().custom_domain,
        theme_config: buildThemeConfig(themeExtra(), theme()),
      });
      // Apply the new theme to the header without a reload.
      void tenantTheme.refresh(tenantId);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="space-y-8 max-w-3xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>

      <Show when={loading()}>
        <div class="text-gray-500 dark:text-gray-400">Loading...</div>
      </Show>

      <Show when={error() && !loading()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
          {error()}
        </div>
        <Show when={!authStore.isPBAdmin && !authStore.currentTenant}>
          <p class="text-gray-500 dark:text-gray-400 text-sm">
            Use the tenant selector in the header to select a tenant.
          </p>
        </Show>
      </Show>

      <Show when={success()}>
        <div class="bg-green-500/10 border border-green-500 rounded p-4 text-green-600 dark:text-green-400 text-sm">
          Settings saved successfully!
        </div>
      </Show>

      <Show when={!loading() && !error() && authStore.currentTenant}>
        <section>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tenant Settings</h2>
          <form onSubmit={handleSubmit} class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
            <input
              type="text"
              value={formData().name}
              onInput={(e) => setFormData(d => ({ ...d, name: e.currentTarget.value }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
            <input
              type="text"
              value={formData().slug}
              onInput={(e) => setFormData(d => ({ ...d, slug: e.currentTarget.value.toLowerCase().replace(/\s+/g, '-') }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan</label>
            <select
              value={formData().plan}
              onChange={(e) => setFormData(d => ({ ...d, plan: e.currentTarget.value }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white"
            >
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custom Domain</label>
            <input
              type="text"
              value={formData().custom_domain}
              onInput={(e) => setFormData(d => ({ ...d, custom_domain: e.currentTarget.value }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              placeholder="media.example.com"
            />
          </div>

          <ThemeConfigFields value={theme()} onChange={setTheme} />

          <button
            type="submit"
            disabled={saving()}
            class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-6 rounded disabled:opacity-50`}
          >
            {saving() ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
        </section>
      </Show>
    </div>
  );
}