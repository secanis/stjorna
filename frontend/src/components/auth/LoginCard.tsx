import { createSignal, Show, For, onMount } from 'solid-js';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

function describeError(err: any): string {
  if (!err) return 'Login failed';
  if (err.status === 0 || err.isAbort) {
    return 'Cannot reach PocketBase server. Check that it is running and reachable.';
  }
  const status = err.status ?? err.response?.status;
  const msg = err.response?.message || err.originalError?.message || err.message;
  if (status && status >= 500) {
    return `Server error (${status}): ${msg || 'check PB logs for the underlying cause.'}`;
  }
  if (status === 404 && /Failed to authenticate/i.test(msg || '')) {
    return 'User not found or password incorrect.';
  }
  return msg || `Login failed (${status || 'unknown'})`;
}

interface AuthMethodProvider {
  name: string;
  displayName: string;
  authURL: string;
}

export interface LoginCardProps {
  mode: 'user' | 'admin';
  onSuccess: () => void;
  errorHint?: string | null;
}

export default function LoginCard(props: LoginCardProps) {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [localHint, setLocalHint] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [passwordEnabled, setPasswordEnabled] = createSignal(true);
  const [oidcProviders, setOidcProviders] = createSignal<AuthMethodProvider[]>([]);

  // MFA state for password + OTP login.
  const [mfaId, setMfaId] = createSignal<string | null>(null);
  const [otpId, setOtpId] = createSignal<string | null>(null);
  const [otpCode, setOtpCode] = createSignal('');
  const [otpSent, setOtpSent] = createSignal(false);

  const isAdmin = () => props.mode === 'admin';

  onMount(async () => {
    // Superuser login never uses OIDC or the users auth collection.
    if (isAdmin()) {
      setOidcProviders([]);
      return;
    }

    try {
      const methods = await pb.collection('users').listAuthMethods();
      const passwordAuth = methods.password || {};
      const passwordOn =
        passwordAuth.enabled ?? methods.emailPassword ?? methods.usernamePassword ?? true;
      setPasswordEnabled(!!passwordOn);

      const rawProviders = methods.oauth2?.providers || methods.authProviders || [];
      const providers = rawProviders.map((p: any) => ({
        name: String(p.name || ''),
        displayName: String(p.displayName || p.name || 'OIDC'),
        authURL: String(p.authURL || ''),
      }));
      setOidcProviders(providers);
    } catch (e: any) {
      console.warn('[LoginCard] failed to load auth methods:', e?.message);
    }
  });

  const handleMFAChallenge = async (id: string) => {
    setMfaId(id);
    try {
      const newOtpId = isAdmin()
        ? await authStore.requestAdminOTP(email())
        : await authStore.requestOTP(email());
      setOtpId(newOtpId);
      setOtpSent(true);
    } catch (otpErr: any) {
      setError(describeError(otpErr));
    }
  };

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setLocalHint(null);

    try {
      if (isAdmin()) {
        try {
          await authStore.loginAsAdmin(email(), password());
          props.onSuccess();
          return;
        } catch (err: any) {
          const id = err?.response?.mfaId || err?.data?.mfaId;
          if (id) {
            await handleMFAChallenge(id);
            return;
          }
          setError(describeError(err));
          if (err?.status >= 500) setLocalHint(props.errorHint || null);
        }
      } else {
        try {
          await authStore.login(email(), password());
          props.onSuccess();
          return;
        } catch (err: any) {
          const id = err?.response?.mfaId || err?.data?.mfaId;
          if (id) {
            await handleMFAChallenge(id);
            return;
          }
          setError(describeError(err));
          if (err?.status >= 500) setLocalHint(props.errorHint || null);
        }
      }
    } catch (err: any) {
      setError(describeError(err));
      if (err?.status >= 500) setLocalHint(props.errorHint || null);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: Event) => {
    e.preventDefault();
    if (!otpId() || !mfaId()) return;

    setLoading(true);
    setError('');
    try {
      if (isAdmin()) {
        await authStore.verifyAdminOTP(otpId()!, otpCode(), mfaId()!);
      } else {
        await authStore.verifyOTP(otpId()!, otpCode(), mfaId()!);
      }
      props.onSuccess();
    } catch (err: any) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOidc = (providerName: string) => {
    setLoading(true);
    setError('');
    setLocalHint(null);
    authStore
      .loginWithOAuth2(providerName)
      .then(() => props.onSuccess())
      .catch((err: any) => {
        setError(describeError(err));
      })
      .finally(() => setLoading(false));
  };

  return (
    <div class="space-y-4">
      <Show when={!isAdmin() && oidcProviders().length > 0}>
        <div class="space-y-3">
          <For each={oidcProviders()}>
            {(provider) => (
              <button
                type="button"
                disabled={loading()}
                onClick={() => handleOidc(provider.name)}
                class={`w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50`}
              >
                {provider.displayName}
              </button>
            )}
          </For>
        </div>

        <Show when={passwordEnabled()}>
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">or</span>
            </div>
          </div>
        </Show>
      </Show>

      <Show when={isAdmin() || passwordEnabled()}>
        <Show
          when={otpSent()}
          fallback={
            <form onSubmit={handleLogin} class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  autocomplete="email"
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  for="password"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  autocomplete="current-password"
                  class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading()}
                class={`w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50`}
              >
                {loading() ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          }
        >
          <form onSubmit={handleOtpSubmit} class="space-y-4">
            <div class="text-sm text-gray-600 dark:text-gray-300">
              Two-factor authentication is enabled. Enter the one-time password sent to your email.
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="otp">
                OTP code
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                value={otpCode()}
                onInput={(e) => setOtpCode(e.currentTarget.value)}
                autocomplete="one-time-code"
                class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading()}
              class={`w-full ${PRIMARY_BUTTON_CLASSES} text-gray-900 dark:text-white font-medium py-2 px-4 rounded disabled:opacity-50`}
            >
              {loading() ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              disabled={loading()}
              onClick={() => {
                setOtpSent(false);
                setOtpId(null);
                setMfaId(null);
                setOtpCode('');
              }}
              class="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
            >
              Back to password
            </button>
          </form>
        </Show>
      </Show>

      <Show when={!isAdmin() && !passwordEnabled() && oidcProviders().length === 0}>
        <div class="text-sm text-red-600 dark:text-red-400">
          No authentication method is enabled. Please contact an administrator.
        </div>
      </Show>

      <Show when={error()}>
        <div class="text-sm">
          <p class="text-red-600 dark:text-red-400">{error()}</p>
          <Show when={localHint()}>
            <p class="text-gray-500 dark:text-gray-400 mt-1">{localHint()}</p>
          </Show>
        </div>
      </Show>
    </div>
  );
}
