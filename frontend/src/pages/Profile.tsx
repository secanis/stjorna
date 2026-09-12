import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { User, Lock, Sun, Moon, Monitor, Shield, Mail, KeyRound } from 'lucide-solid';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { themeStore, type ThemeMode } from '~/stores/theme';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

function describeApiError(err: any): string {
  if (!err) return 'Operation failed';
  if (err.status === 0 || err.isAbort) {
    return 'Cannot reach PocketBase server.';
  }
  const status = err.status ?? err.response?.status;
  const msg = err.response?.message || err.message || 'Operation failed';
  if (err.response?.data) {
    const fields = Object.keys(err.response.data).join(', ');
    if (fields) return `${msg} (${fields})`;
  }
  return status ? `${msg} (HTTP ${status})` : msg;
}

function getRoleLabel(): string {
  if (authStore.isPBAdmin) return 'PB Admin';
  const role = authStore.role;
  if (!role) return 'No role';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function Profile() {
  const navigate = useNavigate();

  // ── User info ─────────────────────────────────────────────────────────
  const email = () => authStore.user?.email || '';
  const roleLabel = () => getRoleLabel();
  const tenantLabel = () => {
    if (authStore.isPBAdmin) return null;
    const tenant = authStore.tenants.find((t) => t.tenant === authStore.currentTenant);
    return tenant?.tenantName || null;
  };
  const created = () => authStore.user?.created;
  const verified = () => authStore.user?.verified;

  // ── Password change ──────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = createSignal('');
  const [newPw, setNewPw] = createSignal('');
  const [confirmPw, setConfirmPw] = createSignal('');
  const [pwSaving, setPwSaving] = createSignal(false);
  const [pwError, setPwError] = createSignal('');
  const [pwSuccess, setPwSuccess] = createSignal('');

  // ── Security / MFA ───────────────────────────────────────────────────
  const [authMethods, setAuthMethods] = createSignal<any>(null);
  const [collectionConfig, setCollectionConfig] = createSignal<any>(null);
  const [secLoading, setSecLoading] = createSignal(true);
  const [secSaving, setSecSaving] = createSignal(false);
  const [secError, setSecError] = createSignal('');
  const [secSuccess, setSecSuccess] = createSignal('');

  const collectionName = () => (authStore.isPBAdmin ? '_superusers' : 'users');

  const loadSecurity = async () => {
    setSecLoading(true);
    try {
      const colName = collectionName();
      const methods = await pb.collection(colName).listAuthMethods();
      const config = await pb.collections.getOne(colName);
      setAuthMethods(methods);
      setCollectionConfig(config);
    } catch (e: any) {
      console.warn('[Profile] failed to load security settings:', e.message);
    } finally {
      setSecLoading(false);
    }
  };

  const handleSecuritySave = async (e: Event) => {
    e.preventDefault();
    if (!authStore.isPBAdmin) return;
    setSecSaving(true);
    setSecError('');
    setSecSuccess('');
    try {
      const col = collectionConfig();
      await pb.collections.update(col.id, {
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
      });
      setSecSuccess('Security settings saved.');
      setTimeout(() => setSecSuccess(''), 3000);
      await loadSecurity();
    } catch (e: any) {
      setSecError(describeApiError(e));
    } finally {
      setSecSaving(false);
    }
  };

  const handleChangePassword = async (e: Event) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!currentPw() || !newPw() || !confirmPw()) {
      setPwError('All password fields are required.');
      return;
    }
    if (newPw().length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPw() !== confirmPw()) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    if (newPw() === currentPw()) {
      setPwError('New password must be different from the current one.');
      return;
    }

    setPwSaving(true);
    try {
      const userId = authStore.user?.id;
      if (!userId) throw new Error('No active session');
      await pb.collection('users').update(userId, {
        oldPassword: currentPw(),
        password: newPw(),
        passwordConfirm: confirmPw(),
      });
      // PB keeps the existing JWT valid through a password change in v0.22.
      // To make sure subsequent API calls use the new credential we
      // re-authenticate silently. If that fails (e.g. PB invalidated the
      // token in a future version), the user keeps working with the
      // existing session until their next login.
      try {
        await pb.collection('users').authWithPassword(email(), newPw());
      } catch {
        // best-effort
      }
      setPwSuccess('Password updated. You remain signed in.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e: any) {
      setPwError(describeApiError(e));
    } finally {
      setPwSaving(false);
    }
  };

  // ── Appearance / theme ───────────────────────────────────────────────
  const [effectiveLabel, setEffectiveLabel] = createSignal('');
  const updateEffectiveLabel = () => {
    const m = themeStore.mode;
    const eff = themeStore.effective;
    if (m === 'system') setEffectiveLabel(`System (currently ${eff})`);
    else setEffectiveLabel(eff);
  };
  onMount(() => {
    updateEffectiveLabel();
    loadSecurity();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (themeStore.mode === 'system') updateEffectiveLabel();
    };
    mq.addEventListener('change', onChange);
  });

  const setTheme = (m: ThemeMode) => {
    themeStore.setMode(m);
    updateEffectiveLabel();
  };

  return (
    <div class="space-y-6 max-w-2xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>

      <Show when={!authStore.isAuthenticated()}>
        {(() => {
          navigate('/login', { replace: true });
          return null;
        })()}
      </Show>

      {/* ── User info ─────────────────────────────────────────────────── */}
      <section class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-2 mb-4">
          <User size={18} class="text-gray-500 dark:text-gray-400" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Account</h2>
        </div>
        <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Email</dt>
            <dd class="text-gray-900 dark:text-white font-medium break-all">{email() || '—'}</dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-gray-400">Role</dt>
            <dd class="text-gray-900 dark:text-white font-medium">{roleLabel()}</dd>
          </div>
          <Show when={tenantLabel()}>
            <div>
              <dt class="text-gray-500 dark:text-gray-400">Current tenant</dt>
              <dd class="text-gray-900 dark:text-white font-medium">{tenantLabel()}</dd>
            </div>
          </Show>
          <Show when={created()}>
            <div>
              <dt class="text-gray-500 dark:text-gray-400">Created</dt>
              <dd class="text-gray-900 dark:text-white font-medium">
                {new Date(created()!).toLocaleDateString()}
              </dd>
            </div>
          </Show>
          <Show when={verified !== undefined}>
            <div>
              <dt class="text-gray-500 dark:text-gray-400">Email verified</dt>
              <dd class="text-gray-900 dark:text-white font-medium">{verified() ? 'Yes' : 'No'}</dd>
            </div>
          </Show>
        </dl>
      </section>

      {/* ── Password change ────────────────────────────────────────────── */}
      <section class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-2 mb-4">
          <Lock size={18} class="text-gray-500 dark:text-gray-400" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Change password</h2>
        </div>

        <form onSubmit={handleChangePassword} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="pw-current">
              Current password
            </label>
            <input
              id="pw-current"
              type="password"
              value={currentPw()}
              onInput={(e) => setCurrentPw(e.currentTarget.value)}
              autocomplete="current-password"
              class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="pw-new">
                New password
              </label>
              <input
                id="pw-new"
                type="password"
                value={newPw()}
                onInput={(e) => setNewPw(e.currentTarget.value)}
                autocomplete="new-password"
                class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="pw-confirm">
                Confirm new password
              </label>
              <input
                id="pw-confirm"
                type="password"
                value={confirmPw()}
                onInput={(e) => setConfirmPw(e.currentTarget.value)}
                autocomplete="new-password"
                class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <Show when={pwError()}>
            <div class="bg-red-50 dark:bg-red-500/10 border border-red-500/30 dark:border-red-500/50 rounded p-3 text-sm text-red-700 dark:text-red-300">
              {pwError()}
            </div>
          </Show>
          <Show when={pwSuccess()}>
            <div class="bg-green-50 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/50 rounded p-3 text-sm text-green-700 dark:text-green-300">
              {pwSuccess()}
            </div>
          </Show>

          <div>
            <button
              type="submit"
              disabled={pwSaving()}
              class={`${PRIMARY_BUTTON_CLASSES} text-white font-medium py-2 px-6 rounded disabled:opacity-50 flex items-center gap-2`}
            >
              {pwSaving() ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Security / MFA ─────────────────────────────────────────────── */}
      <section class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-2 mb-4">
          <Shield size={18} class="text-gray-500 dark:text-gray-400" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Security</h2>
        </div>

        <Show when={secLoading()}>
          <div class="text-gray-500 dark:text-gray-400">Loading...</div>
        </Show>

        <Show when={!secLoading() && authMethods()}>
          <div class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Show when={authMethods().password?.enabled}>
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  <Lock size={12} /> Password
                </span>
              </Show>
              <Show when={authMethods().otp?.enabled}>
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  <Mail size={12} /> Email OTP
                </span>
              </Show>
              <Show when={authMethods().oauth2?.enabled}>
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  <KeyRound size={12} /> SSO / OIDC
                </span>
              </Show>
              <Show when={authMethods().mfa?.enabled}>
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  <Shield size={12} /> MFA enforced
                </span>
              </Show>
            </div>

            <Show when={!authMethods().password?.enabled && !authMethods().oauth2?.enabled}>
              <p class="text-sm text-red-600 dark:text-red-400">
                No login method is enabled for this account type. Contact an administrator.
              </p>
            </Show>

            <Show when={authStore.isPBAdmin}>
              <form onSubmit={handleSecuritySave} class="space-y-4 pt-2">
                <Show when={secError()}>
                  <div class="bg-red-50 dark:bg-red-500/10 border border-red-500/30 dark:border-red-500/50 rounded p-3 text-sm text-red-700 dark:text-red-300">
                    {secError()}
                  </div>
                </Show>
                <Show when={secSuccess()}>
                  <div class="bg-green-50 dark:bg-green-500/10 border border-green-500/30 dark:border-green-500/50 rounded p-3 text-sm text-green-700 dark:text-green-300">
                    {secSuccess()}
                  </div>
                </Show>

                <div class="flex items-start gap-3">
                  <input
                    id="profile-otp"
                    type="checkbox"
                    checked={!!collectionConfig()?.otp?.enabled}
                    onChange={(e) =>
                      setCollectionConfig((c: any) => ({
                        ...c,
                        otp: { ...(c.otp || { duration: 180, length: 8 }), enabled: e.currentTarget.checked },
                      }))
                    }
                    class="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <label for="profile-otp" class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable email OTP
                    </label>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      Applies to all superusers. Requires SMTP.
                    </p>
                  </div>
                </div>

                <div class="flex items-start gap-3">
                  <input
                    id="profile-mfa"
                    type="checkbox"
                    checked={!!collectionConfig()?.mfa?.enabled}
                    disabled={!collectionConfig()?.passwordAuth?.enabled || !collectionConfig()?.otp?.enabled}
                    onChange={(e) =>
                      setCollectionConfig((c: any) => ({
                        ...c,
                        mfa: { ...(c.mfa || { duration: 1800, rule: '' }), enabled: e.currentTarget.checked },
                      }))
                    }
                    class="h-4 w-4 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <div>
                    <label for="profile-mfa" class="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enforce MFA
                    </label>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      Requires password + OTP to be enabled. Applies to all superusers.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={secSaving()}
                  class={`${PRIMARY_BUTTON_CLASSES} text-white font-medium py-2 px-6 rounded disabled:opacity-50 flex items-center gap-2`}
                >
                  {secSaving() ? 'Saving...' : 'Save Security Settings'}
                </button>
              </form>
            </Show>

            <Show when={!authStore.isPBAdmin}>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Multi-factor authentication is managed by your administrator.
              </p>
            </Show>
          </div>
        </Show>
      </section>

      {/* ── Appearance ────────────────────────────────────────────────── */}
      <section class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-2 mb-4">
          <Sun size={18} class="text-gray-500 dark:text-gray-400" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
        </div>

        <p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Choose how the app should look. <strong>System</strong> follows your operating system
          preference and reacts to changes live.
        </p>

        <div role="radiogroup" aria-label="Theme" class="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => {
            const isActive = () => themeStore.mode === m;
            const label = m.charAt(0).toUpperCase() + m.slice(1);
            const Icon = m === 'light' ? Sun : m === 'dark' ? Moon : Monitor;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={isActive()}
                data-testid={`theme-${m}`}
                onClick={() => setTheme(m)}
                classList={{
                  'flex items-center gap-2 px-4 py-2 text-sm transition-colors': true,
                  'bg-blue-600 text-white': isActive(),
                  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700': !isActive(),
                  'border-r': m !== 'system',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        <p class="text-xs text-gray-600 dark:text-gray-400 mt-3">
          Currently: <span data-testid="theme-effective">{effectiveLabel()}</span>
        </p>
      </section>
    </div>
  );
}