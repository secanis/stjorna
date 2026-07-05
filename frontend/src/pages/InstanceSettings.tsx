import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { Settings, Save } from 'lucide-solid';

interface InstanceSettings {
  id?: string;
  instance_name: string;
  instance_url: string;
  instance_logo_url: string;
  instance_tagline: string;
}

export default function InstanceSettings() {
  const navigate = useNavigate();

  const [formData, setFormData] = createSignal<InstanceSettings>({
    instance_name: 'STJÓRNA',
    instance_url: localStorage.getItem('stjorna_pb_url') || 'http://localhost:8090',
    instance_logo_url: '',
    instance_tagline: '',
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
    if (!authStore.isPBAdmin) {
      navigate('/', { replace: true });
      return;
    }

    try {
      const records = await pb.collection('instance_settings').getList(1, 1);
      if (records.items.length > 0) {
        const s = records.items[0];
        setFormData({
          instance_name: s.instance_name || 'STJÓRNA',
          instance_url: s.instance_url || '',
          instance_logo_url: s.instance_logo_url || '',
          instance_tagline: s.instance_tagline || '',
        });
      }
    } catch (e: any) {
      console.warn('Failed to load instance settings:', e.message);
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
      const records = await pb.collection('instance_settings').getList(1, 1);
      if (records.items.length > 0) {
        await pb.collection('instance_settings').update(records.items[0].id, formData());
      } else {
        await pb.collection('instance_settings').create(formData());
      }
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
      <h1 class="text-2xl font-bold text-white">Instance Settings</h1>

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
          Instance settings saved successfully!
        </div>
      </Show>

      <Show when={!loading()}>
        <form onSubmit={handleSubmit} class="bg-gray-800 rounded-lg p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Instance Name</label>
            <input
              type="text"
              value={formData().instance_name}
              onInput={(e) => setFormData(d => ({ ...d, instance_name: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Instance URL</label>
            <input
              type="url"
              value={formData().instance_url}
              onInput={(e) => setFormData(d => ({ ...d, instance_url: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="http://localhost:8090"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Logo URL</label>
            <input
              type="url"
              value={formData().instance_logo_url}
              onInput={(e) => setFormData(d => ({ ...d, instance_logo_url: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="https://..."
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Tagline</label>
            <input
              type="text"
              value={formData().instance_tagline}
              onInput={(e) => setFormData(d => ({ ...d, instance_tagline: e.currentTarget.value }))}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="Product management made simple"
            />
          </div>

          <button
            type="submit"
            disabled={saving()}
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded disabled:opacity-50 flex items-center gap-2"
          >
            <Save size={16} />
            {saving() ? 'Saving...' : 'Save Instance Settings'}
          </button>
        </form>
      </Show>
    </div>
  );
}