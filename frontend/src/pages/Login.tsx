import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { authStore, checkHasAdmins, checkSetupDone } from '~/stores/auth';
import { recreatePb } from '~/services/pocketbase';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [pbUrlInput, setPbUrlInput] = createSignal(localStorage.getItem('stjorna_pb_url') || 'http://localhost:8090');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [isAdminLogin, setIsAdminLogin] = createSignal(searchParams.mode === 'admin');

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const url = pbUrlInput();
    recreatePb(url);

    try {
      if (isAdminLogin()) {
        await authStore.loginAsAdmin(email(), password());
      } else {
        await authStore.login(email(), password());
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSetup = async () => {
    setLoading(true);
    setError('');
    try {
      recreatePb(pbUrlInput());
      const hasAdmins = await checkHasAdmins();
      if (!hasAdmins) {
        navigate('/setup');
      }
    } catch (e: any) {
      setError('Cannot connect to PocketBase');
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    recreatePb(pbUrlInput());
    // No auto-redirect to /setup. The "First-time setup?" button below
    // is the explicit way to enter the setup wizard. After a logout the
    // user must land back on /login, not be re-pushed into the setup
    // flow when the instance happens to have setup_done === false.
  });

  return (
    <div class="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div class="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-white mb-2">STJÓRNA</h1>
          <p class="text-gray-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1" for="pb-url">PocketBase URL</label>
            <input
              id="pb-url"
              type="url"
              value={pbUrlInput()}
              onInput={(e) => setPbUrlInput(e.currentTarget.value)}
              class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

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
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
          >
            {loading() ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <Show when={error()}>
          <p class="text-red-400 text-sm mt-4">{error()}</p>
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