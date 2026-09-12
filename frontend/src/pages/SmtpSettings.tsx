import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { Save, Send, Mail } from 'lucide-solid';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';
import DescriptionBlock from '~/components/settings/DescriptionBlock';

interface SmtpForm {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  authMethod: string;
  localName: string;
  senderName: string;
  senderAddress: string;
}

function describeError(err: any): string {
  if (!err) return 'Operation failed';
  return err.response?.message || err.message || 'Operation failed';
}

export default function SmtpSettings() {
  const navigate = useNavigate();

  const [form, setForm] = createSignal<SmtpForm>({
    enabled: false,
    host: '',
    port: 587,
    username: '',
    password: '',
    tls: false,
    authMethod: '',
    localName: '',
    senderName: '',
    senderAddress: '',
  });
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');
  const [testError, setTestError] = createSignal('');
  const [testSuccess, setTestSuccess] = createSignal('');

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
      const settings = await pb.settings.getAll();
      const smtp = settings.smtp || {};
      const meta = settings.meta || {};
      setForm({
        enabled: !!smtp.enabled,
        host: smtp.host || '',
        port: smtp.port || 587,
        username: smtp.username || '',
        password: '',
        tls: !!smtp.tls,
        authMethod: smtp.authMethod || '',
        localName: smtp.localName || '',
        senderName: meta.senderName || '',
        senderAddress: meta.senderAddress || '',
      });
    } catch (e: any) {
      setError(describeError(e));
    } finally {
      setLoading(false);
    }
  });

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const smtp: any = {
        enabled: form().enabled,
        host: form().host,
        port: Number(form().port),
        username: form().username,
        tls: form().tls,
        authMethod: form().authMethod,
        localName: form().localName,
      };
      if (form().password) {
        smtp.password = form().password;
      }

      await pb.settings.update({
        smtp,
        meta: {
          senderName: form().senderName,
          senderAddress: form().senderAddress,
        },
      });
      showSuccess('SMTP settings saved successfully.');
      setForm((f) => ({ ...f, password: '' }));
    } catch (e: any) {
      setError(describeError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestError('');
    setTestSuccess('');
    try {
      const email = authStore.user?.email;
      if (!email) throw new Error('No email address for the current user.');
      await pb.send('/api/settings/test/email', {
        method: 'POST',
        body: {
          email,
          template: 'verification',
          collection: authStore.isPBAdmin ? '_superusers' : 'users',
        },
      });
      setTestSuccess(`Test email sent to ${email}.`);
      setTimeout(() => setTestSuccess(''), 5000);
    } catch (e: any) {
      setTestError(describeError(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div class="space-y-6 max-w-3xl">
      <div class="flex items-center gap-3">
        <Mail size={24} class="text-gray-500 dark:text-gray-400" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">SMTP Settings</h1>
      </div>

      <DescriptionBlock>
        <p>Configure the outgoing mail server used by PocketBase.</p>
        <p>
          SMTP is required for email OTP codes, verification emails and other system notifications.
          Without it, OTP login and MFA will fail unless STJORNA_LOG_OTP is enabled for local testing.
        </p>
      </DescriptionBlock>

      <Show when={loading()}>
        <div class="text-gray-500 dark:text-gray-400">Loading...</div>
      </Show>

      <Show when={error()}>
        <div class="bg-red-50 dark:bg-red-500/10 border border-red-500/30 dark:border-red-500/50 rounded p-4 text-sm text-red-700 dark:text-red-300">
          {error()}
        </div>
      </Show>

      <Show when={success()}>
        <div class="bg-green-50 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/50 rounded p-4 text-sm text-green-700 dark:text-green-300">
          {success()}
        </div>
      </Show>

      <Show when={!loading()}>
        <form onSubmit={handleSave} class="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-6 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <input
              id="smtp-enabled"
              type="checkbox"
              checked={form().enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.currentTarget.checked }))}
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label for="smtp-enabled" class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable SMTP
            </label>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host</label>
              <input
                type="text"
                value={form().host}
                onInput={(e) => setForm((f) => ({ ...f, host: e.currentTarget.value }))}
                class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
              <input
                type="number"
                value={form().port}
                onInput={(e) => setForm((f) => ({ ...f, port: Number(e.currentTarget.value) }))}
                class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
              <input
                type="text"
                value={form().username}
                onInput={(e) => setForm((f) => ({ ...f, username: e.currentTarget.value }))}
                class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
                <span class="text-xs text-gray-500 dark:text-gray-400 font-normal ml-1">(leave blank to keep current)</span>
              </label>
              <input
                type="password"
                value={form().password}
                onInput={(e) => setForm((f) => ({ ...f, password: e.currentTarget.value }))}
                autocomplete="new-password"
                class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auth method</label>
              <input
                type="text"
                value={form().authMethod}
                onInput={(e) => setForm((f) => ({ ...f, authMethod: e.currentTarget.value }))}
                class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                placeholder="PLAIN, LOGIN, ..."
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Local name (HELO)</label>
              <input
                type="text"
                value={form().localName}
                onInput={(e) => setForm((f) => ({ ...f, localName: e.currentTarget.value }))}
                class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div class="flex items-center gap-3">
            <input
              id="smtp-tls"
              type="checkbox"
              checked={form().tls}
              onChange={(e) => setForm((f) => ({ ...f, tls: e.currentTarget.checked }))}
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label for="smtp-tls" class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Use TLS
            </label>
          </div>

          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 class="text-md font-semibold text-gray-900 dark:text-white mb-4">Sender</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sender name</label>
                <input
                  type="text"
                  value={form().senderName}
                  onInput={(e) => setForm((f) => ({ ...f, senderName: e.currentTarget.value }))}
                  class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sender address</label>
                <input
                  type="email"
                  value={form().senderAddress}
                  onInput={(e) => setForm((f) => ({ ...f, senderAddress: e.currentTarget.value }))}
                  class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving()}
              class={`${PRIMARY_BUTTON_CLASSES} text-white font-medium py-2 px-6 rounded disabled:opacity-50 flex items-center gap-2`}
            >
              <Save size={16} />
              {saving() ? 'Saving...' : 'Save SMTP Settings'}
            </button>

            <button
              type="button"
              onClick={handleTest}
              disabled={testing() || !form().enabled}
              class="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50 flex items-center gap-2"
            >
              <Send size={16} />
              {testing() ? 'Sending...' : 'Send Test Email'}
            </button>
          </div>

          <Show when={testError()}>
            <div class="bg-red-50 dark:bg-red-500/10 border border-red-500/30 dark:border-red-500/50 rounded p-3 text-sm text-red-700 dark:text-red-300">
              {testError()}
            </div>
          </Show>
          <Show when={testSuccess()}>
            <div class="bg-green-50 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/50 rounded p-3 text-sm text-green-700 dark:text-green-300">
              {testSuccess()}
            </div>
          </Show>
        </form>
      </Show>
    </div>
  );
}
