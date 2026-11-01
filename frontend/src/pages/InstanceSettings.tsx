import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { i18nStore } from '~/i18n';
import { Save } from 'lucide-solid';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';
import DescriptionBlock from '~/components/settings/DescriptionBlock';
import { errorMessage } from '~/utils/errors';

interface InstanceSettings {
  id?: string;
  instance_name: string;
}

export default function InstanceSettings() {
  const navigate = useNavigate();

  const [formData, setFormData] = createSignal<InstanceSettings>({
    instance_name: 'STJÓRNA',
  });
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);
  const [superuserIPs, setSuperuserIPs] = createSignal('');

  onMount(async () => {
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    if (!authStore.isPBAdmin) {
      navigate('/', { replace: true });
      return;
    }

    try {
      // T-22: PocketBase's meta.appName is the single source of truth for
      // the instance name (instance_settings.instance_name was dropped).
      const settings = await pb.settings.getAll();
      setFormData({ instance_name: settings.meta?.appName || 'STJÓRNA' });
      const ips = Array.isArray(settings.superuserIPs) ? settings.superuserIPs : [];
      setSuperuserIPs(ips.join('\n'));
    } catch (e: unknown) {
      console.warn('Failed to load instance settings:', errorMessage(e));
    } finally {
      setLoading(false);
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      // The instance name is PocketBase's app name (used in system emails).
      const settings = await pb.settings.getAll();
      const ips = superuserIPs()
        .split(/[\s,]+/)
        .map((ip) => ip.trim())
        .filter(Boolean);
      await pb.settings.update({
        meta: {
          ...settings.meta,
          appName: formData().instance_name,
        },
        superuserIPs: ips,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError(errorMessage(e, i18nStore.t('common.failedToSave')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="space-y-6 max-w-3xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{i18nStore.t('instanceSettings.title')}</h1>

      <DescriptionBlock>
        <p>{i18nStore.t('instanceSettings.description')}</p>
      </DescriptionBlock>

      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{i18nStore.t('instanceSettings.backup')}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {i18nStore.t('instanceSettings.backupHint')}
          </p>
        </div>
      </div>

      <Show when={loading()}>
        <div class="text-gray-500 dark:text-gray-400">{i18nStore.t('common.loading')}</div>
      </Show>

      <Show when={error() && !loading()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <Show when={success()}>
        <div class="bg-green-500/10 border border-green-500 rounded p-4 text-green-600 dark:text-green-400 text-sm">
          {i18nStore.t('instanceSettings.saved')}
        </div>
      </Show>

      <Show when={!loading()}>
        <form onSubmit={handleSubmit} class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{i18nStore.t('instanceSettings.instanceName')}</label>
            <input
              type="text"
              value={formData().instance_name}
              onInput={(e) => setFormData(d => ({ ...d, instance_name: e.currentTarget.value }))}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {i18nStore.t('instanceSettings.superuserIps')}
              <span class="text-xs text-gray-500 dark:text-gray-400 font-normal ml-1">({i18nStore.t('common.optional')})</span>
            </label>
            <textarea
              value={superuserIPs()}
              onInput={(e) => setSuperuserIPs(e.currentTarget.value)}
              rows={4}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              placeholder="127.0.0.1&#10;10.0.0.0/8"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {i18nStore.t('instanceSettings.superuserIpsHint')}
            </p>
          </div>

          <button
            type="submit"
            disabled={saving()}
            class={`${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-6 rounded disabled:opacity-50 flex items-center gap-2`}
          >
            <Save size={16} />
            {saving() ? i18nStore.t('settings.saving') : i18nStore.t('instanceSettings.saveInstanceSettings')}
          </button>
        </form>
      </Show>
    </div>
  );
}