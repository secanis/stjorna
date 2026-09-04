import { createSignal, Show, For, onMount } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
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

export default function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [errorHint, setErrorHint] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [isAdminLogin, setIsAdminLogin] = createSignal(searchParams.mode === 'admin');
  const [passwordEnabled, setPasswordEnabled] = createSignal(true);
  const [oidcProviders, setOidcProviders] = createSignal<AuthMethodProvider[]>([]);

  onMount(async () => {
    try {
      const methods = await pb.collection('users').listAuthMethods();
      // PocketBase v0.22.x returns the old shape by default; v0.23+ returns the new shape.
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
      // Network errors are handled on password submit; don't block OIDC UI.
      console.warn('[Login] failed to load auth methods:', e?.message);
    }
  });

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorHint(null);

    try {
      if (isAdminLogin()) {
        await authStore.loginAsAdmin(email(), password());
      } else {
        await authStore.login(email(), password());
      }
      navigate('/');
    } catch (err: any) {
      setError(describeError(err));
      if (err?.status >= 500) setErrorHint('If this is a fresh PocketBase, run First-time setup below.');
    } finally {
      setLoading(false);
    }
  };

  const handleOidc = (providerName: string) => {
    setLoading(true);
    setError('');
    setErrorHint(null);
    authStore.loginWithOAuth2(providerName)
      .then(() => navigate('/'))
      .catch((err: any) => {
        setError(describeError(err));
      })
      .finally(() => setLoading(false));
  };

  const switchMode = (admin: boolean) => {
    setIsAdminLogin(admin);
    setSearchParams({ mode: admin ? 'admin' : 'user' });
    setError('');
    setErrorHint(null);
  };

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">STJÓRNA</h1>
          <p class="text-gray-500 dark:text-gray-400">Sign in to your account</p>
        </div>

        <div class="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => switchMode(false)}
            class={`flex-1 py-2 px-4 rounded font-medium transition-colors ${
              !isAdminLogin()
                ? 'bg-blue-600 text-gray-900 dark:text-white'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            User Login
          </button>
          <button
            type="button"
            onClick={() => switchMode(true)}
            class={`flex-1 py-2 px-4 rounded font-medium transition-colors ${
              isAdminLogin()
                ? 'bg-blue-600 text-gray-900 dark:text-white'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Admin Login
          </button>
        </div>

        <Show when={!isAdminLogin() && oidcProviders().length > 0}>
          <div class="space-y-3 mb-6">
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
            <div class="relative mb-6">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">or</span>
              </div>
            </div>
          </Show>
        </Show>

        <Show when={isAdminLogin() || passwordEnabled()}>
          <form onSubmit={handleLogin} class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="email">Email</label>
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
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="password">Password</label>
              <input
                id="password"
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                autocomplete={isAdminLogin() ? 'current-password' : 'current-password'}
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
        </Show>

        <Show when={!isAdminLogin() && !passwordEnabled() && oidcProviders().length === 0}>
          <div class="text-sm text-red-600 dark:text-red-400">
            No authentication method is enabled. Please contact an administrator.
          </div>
        </Show>

        <Show when={error()}>
          <div class="mt-4 text-sm">
            <p class="text-red-600 dark:text-red-400">{error()}</p>
            <Show when={errorHint()}>
              <p class="text-gray-500 dark:text-gray-400 mt-1">{errorHint()}</p>
            </Show>
          </div>
        </Show>

        <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => navigate('/setup?mode=admin')}
            class="w-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
          >
            First-time setup?
          </button>
        </div>
      </div>
    </div>
  );
}
