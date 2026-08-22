import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { User, Lock, Sun, Moon, Monitor } from 'lucide-solid';
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

      {/* ── Appearance ────────────────────────────────────────────────── */}
      <section class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-2 mb-4">
          <Sun size={18} class="text-gray-500 dark:text-gray-400" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
        </div>

        <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
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
                class={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  isActive()
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${m === 'light' ? 'border-r' : ''} ${m === 'dark' ? 'border-r' : ''} border-gray-300 dark:border-gray-600`}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Currently: <span data-testid="theme-effective">{effectiveLabel()}</span>
        </p>
      </section>
    </div>
  );
}