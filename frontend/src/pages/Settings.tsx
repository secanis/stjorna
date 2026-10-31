import { createSignal, Show, onMount, createEffect, on } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { tenantStore } from '~/stores/tenant';
import { tenantTheme } from '~/stores/tenantTheme';
import { i18nStore } from '~/i18n';
import type { Tenant, TenantThemeConfig } from '~/types';
import { parseThemeConfig, buildThemeConfig, asTrimmedString } from '~/utils/themeConfig';
import ThemeConfigFields, { type ThemeFields } from '~/components/tenants/ThemeConfigFields';
import BackupSection from '~/components/backup/BackupSection';
import Combobox from '~/components/ui/Combobox';
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
    if (!tenantId) {
      setError(i18nStore.t('settings.noTenantSelected'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

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
      setError(e.message || i18nStore.t('settings.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }

    if (authStore.isPBAdmin) {
      navigate('/settings/general', { replace: true });
      return;
    }

    void loadTenantSettings();
  });

  // Re-load settings whenever the active tenant changes (switchTenant
  // bumps tenantStore.version), so the form never shows a previous
  // tenant's stale data.
  createEffect(on(() => tenantStore.version, () => { void loadTenantSettings(); }, { defer: true }));

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
      setError(e.message || i18nStore.t('settings.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="space-y-8 max-w-3xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{i18nStore.t('settings.title')}</h1>

      <Show when={loading()}>
        <div class="text-gray-500 dark:text-gray-400">{i18nStore.t('common.loading')}</div>
      </Show>

      <Show when={error() && !loading()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
          {error()}
        </div>
        <Show when={!authStore.isPBAdmin && !authStore.currentTenant}>
          <p class="text-gray-500 dark:text-gray-400 text-sm">
            {i18nStore.t('settings.useTenantSelector')}
          </p>
        </Show>
      </Show>

      <Show when={success()}>
        <div class="bg-green-500/10 border border-green-500 rounded p-4 text-green-600 dark:text-green-400 text-sm">
          {i18nStore.t('settings.savedSuccessfully')}
        </div>
      </Show>

      <Show when={!loading() && !error() && authStore.currentTenant}>
        <section>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{i18nStore.t('settings.tenantSettings')}</h2>
          <form onSubmit={handleSubmit} class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('settings.companyName')}</label>
            <input
              type="text"
              value={formData().name}
              onInput={(e) => setFormData(d => ({ ...d, name: e.currentTarget.value }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('settings.slug')}</label>
            <input
              type="text"
              value={formData().slug}
              onInput={(e) => setFormData(d => ({ ...d, slug: e.currentTarget.value.toLowerCase().replace(/\s+/g, '-') }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('settings.plan')}</label>
            <Combobox
              value={formData().plan}
              onChange={(v) => setFormData(d => ({ ...d, plan: v }))}
              options={[
                { value: 'free', label: i18nStore.t('settings.planFree') },
                { value: 'starter', label: i18nStore.t('settings.planStarter') },
                { value: 'professional', label: i18nStore.t('settings.planProfessional') },
                { value: 'enterprise', label: i18nStore.t('settings.planEnterprise') },
              ]}
              placeholder={i18nStore.t('settings.selectPlan')}
              allowClear={false}
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('settings.customDomain')}</label>
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
            {saving() ? i18nStore.t('settings.saving') : i18nStore.t('settings.saveSettings')}
          </button>
        </form>
        </section>

        <Show when={authStore.isAdminOrAbove()}>
          <BackupSection tenantId={authStore.currentTenant!} />
        </Show>
      </Show>
    </div>
  );
}