import { createSignal, Show } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
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

export default function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [errorHint, setErrorHint] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [isAdminLogin, setIsAdminLogin] = createSignal(searchParams.mode === 'admin');

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

  // No onMount needed: pb is configured at module load via VITE_PB_URL,
  // and the "First-time setup?" link below handles setup redirection.

  return (
    <div class="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div class="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-white mb-2">STJÓRNA</h1>
          <p class="text-gray-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} class="space-y-4">
          <div class="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => { setIsAdminLogin(false); setSearchParams({ mode: 'user' }); }}
              class={`flex-1 py-2 px-4 rounded font-medium transition-colors ${
                !isAdminLogin()
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              User Login
            </button>
            <button
              type="button"
              onClick={() => { setIsAdminLogin(true); setSearchParams({ mode: 'admin' }); }}
              class={`flex-1 py-2 px-4 rounded font-medium transition-colors ${
                isAdminLogin()
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Admin Login
            </button>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="email">Email</label>
            <input
              id="email"
              type="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              autocomplete="email"
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="password">Password</label>
            <input
              id="password"
              type="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              autocomplete="current-password"
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading()}
            class="w-full ${PRIMARY_BUTTON_CLASSES} text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading() ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <Show when={error()}>
          <div class="mt-4 text-sm">
            <p class="text-red-400">{error()}</p>
            <Show when={errorHint()}>
              <p class="text-gray-400 mt-1">{errorHint()}</p>
            </Show>
          </div>
        </Show>

        <div class="mt-6 pt-6 border-t border-gray-700">
          <button
            onClick={() => navigate('/setup?mode=admin')}
            class="w-full text-gray-400 hover:text-gray-300 text-sm"
          >
            First-time setup?
          </button>
        </div>
      </div>
    </div>
  );
}
