import { createSignal, Show, onMount } from 'solid-js';
import { pb } from '~/services/pocketbase';
import { Save, Shield } from 'lucide-solid';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

interface AuthCollection {
  id: string;
  name: string;
  passwordAuth?: { enabled: boolean };
  otp?: { enabled: boolean; duration: number; length: number; emailTemplate?: any };
  mfa?: { enabled: boolean; duration: number; rule: string };
  oauth2?: { enabled: boolean };
}

function describeError(err: any): string {
  if (!err) return 'Operation failed';
  return err.response?.message || err.message || 'Operation failed';
}

function Section(props: { title: string; children: any }) {
  return (
    <div class="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
      <h3 class="text-md font-semibold text-gray-900 dark:text-white mb-4">{props.title}</h3>
      {props.children}
    </div>
  );
}

export default function SecuritySettings() {
  const [superusers, setSuperusers] = createSignal<AuthCollection | null>(null);
  const [users, setUsers] = createSignal<AuthCollection | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal('');

  onMount(async () => {
    try {
      const su = await pb.collections.getOne('_superusers');
      setSuperusers(su as any);
    } catch (e: any) {
      console.warn('[SecuritySettings] failed to load _superusers:', e.message);
    }
    try {
      const u = await pb.collections.getOne('users');
      setUsers(u as any);
    } catch (e: any) {
      console.warn('[SecuritySettings] failed to load users:', e.message);
    }
    setLoading(false);
  });

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const saveCollection = async (col: AuthCollection) => {
    const payload: any = {
      otp: {
        enabled: !!col.otp?.enabled,
        duration: col.otp?.duration ?? 180,
        length: col.otp?.length ?? 8,
      },
      mfa: {
        enabled: !!col.mfa?.enabled,
        duration: col.mfa?.duration ?? 1800,
        rule: col.mfa?.rule ?? '',
      },
    };
    if (col.otp?.emailTemplate) {
      payload.otp.emailTemplate = col.otp.emailTemplate;
    }
    await pb.collections.update(col.id, payload);
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (superusers()) await saveCollection(superusers()!);
      if (users()) await saveCollection(users()!);
      showSuccess('Security settings saved.');
    } catch (err: any) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleOtp = (col: AuthCollection, enabled: boolean) => {
    const next = { ...col, otp: { ...(col.otp || { duration: 180, length: 8 }), enabled } };
    if (col.name === '_superusers') setSuperusers(next);
    else setUsers(next);
  };

  const toggleMfa = (col: AuthCollection, enabled: boolean) => {
    const next = { ...col, mfa: { ...(col.mfa || { duration: 1800, rule: '' }), enabled } };
    if (col.name === '_superusers') setSuperusers(next);
    else setUsers(next);
  };

  const renderCollectionToggles = (col: AuthCollection | null, label: string, note: string) => {
    if (!col) return null;
    const otpEnabled = !!col.otp?.enabled;
    const mfaEnabled = !!col.mfa?.enabled;
    const hasPassword = !!col.passwordAuth?.enabled;
    const hasOauth2 = !!col.oauth2?.enabled;
    const canEnableMfa = hasPassword && (otpEnabled || hasOauth2);

    return (
      <Section title={label}>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{note}</p>

        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <input
              id={`${col.name}-otp`}
              type="checkbox"
              checked={otpEnabled}
              onChange={(e) => toggleOtp(col, e.currentTarget.checked)}
              class="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <label for={`${col.name}-otp`} class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable email OTP
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Allows login with a one-time code sent by email. Requires SMTP to be configured.
              </p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <input
              id={`${col.name}-mfa`}
              type="checkbox"
              checked={mfaEnabled}
              disabled={!canEnableMfa}
              onChange={(e) => toggleMfa(col, e.currentTarget.checked)}
              class="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <div>
              <label for={`${col.name}-mfa`} class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enforce multi-factor authentication
              </label>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Requires two different login methods (e.g. password + OTP).{' '}
                {!canEnableMfa && (
                  <span class="text-amber-600 dark:text-amber-400">
                    Enable password + OTP (or OIDC) first.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </Section>
    );
  };

  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2 mb-4">
        <Shield size={18} class="text-gray-500 dark:text-gray-400" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Security</h2>
      </div>

      <Show when={loading()}>
        <div class="text-gray-500 dark:text-gray-400">Loading...</div>
      </Show>

      <Show when={error()}>
        <div class="bg-red-50 dark:bg-red-500/10 border border-red-500/30 dark:border-red-500/50 rounded p-3 text-sm text-red-700 dark:text-red-300 mb-4">
          {error()}
        </div>
      </Show>

      <Show when={success()}>
        <div class="bg-green-50 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/50 rounded p-3 text-sm text-green-700 dark:text-green-300 mb-4">
          {success()}
        </div>
      </Show>

      <Show when={!loading()}>
        <form onSubmit={handleSave} class="space-y-2">
          {renderCollectionToggles(
            superusers(),
            'Superuser authentication',
            'These settings apply to all PocketBase superusers.'
          )}
          {renderCollectionToggles(
            users(),
            'User authentication',
            'These settings apply to all non-SSO users. OIDC users follow the OIDC provider rules.'
          )}

          <div class="pt-4">
            <button
              type="submit"
              disabled={saving()}
              class={`${PRIMARY_BUTTON_CLASSES} text-white font-medium py-2 px-6 rounded disabled:opacity-50 flex items-center gap-2`}
            >
              <Save size={16} />
              {saving() ? 'Saving...' : 'Save Security Settings'}
            </button>
          </div>
        </form>
      </Show>
    </div>
  );
}
