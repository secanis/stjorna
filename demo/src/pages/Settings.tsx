import { createSignal, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb, recreatePb, saveToken, clearToken, getTokenRaw, pbUrl, toggleTheme, getTheme } from '~/lib/pb';
export default function Settings() {
  const navigate = useNavigate();
  const [url, setUrl] = createSignal(pbUrl());
  const [token, setToken] = createSignal(getTokenRaw());
  const [testing, setTesting] = createSignal(false);
  const [testResult, setTestResult] = createSignal<{ ok: boolean; msg: string } | null>(null);

  onMount(() => setUrl(pbUrl()));

  function save(e: Event) {
    e.preventDefault();
    recreatePb(url());
    saveToken(token());
    navigate('/');
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    recreatePb(url());
    try {
      // API: GET /api/health
      await pb.health.check();
      setTestResult({ ok: true, msg: 'OK — STJÓRNA reachable.' });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.message || 'failed' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div class="min-h-screen flex items-start justify-center p-6">
      <div class="w-full max-w-xl space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-semibold">STJÓRNA Demo — Settings</h1>
          <button
            onClick={toggleTheme}
            class="text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Toggle theme"
          >
            {getTheme() === 'dark' ? '☀︎ light' : '☾ dark'}
          </button>
        </div>

        <form onSubmit={save} class="space-y-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <div>
            <label class="block text-sm font-medium mb-1">PocketBase / STJÓRNA URL</label>
            <input
              type="url"
              required
              placeholder="http://localhost:8090"
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
              class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Persistence: <code>localStorage.demo_pb_url</code>. Proxies <code>/api/*</code> via Vite when same-origin.
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Auth token / API key (optional)</label>
            <textarea
              rows="3"
              placeholder={'paste STJÓRNA user JWT, PB admin JWT, or STJÓRNA API key (stjorna_…)…'}
              value={token()}
              onInput={(e) => setToken(e.currentTarget.value)}
              class="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm font-mono"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Stored as <code>localStorage.demo_pb_token</code>, applied via <code>pb.authStore.save(token, null)</code>.
              Required only to unlock media thumbnails. STJÓRNA API keys (<code>stjorna_…</code>) work alongside
              regular user JWTs.
            </p>
            <Show when={getTokenRaw()}>
              <button
                type="button"
                onClick={() => { clearToken(); setToken(''); }}
                class="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Clear saved token
              </button>
            </Show>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="submit"
              class="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              Save & open catalog
            </button>
            <button
              type="button"
              onClick={testConnection}
              disabled={testing()}
              class="px-4 py-2 rounded border border-gray-300 dark:border-gray-700 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {testing() ? 'Testing…' : 'Test connection'}
            </button>
          </div>

          <Show when={testResult()}>
            <div
              class={`text-sm px-3 py-2 rounded ${
                testResult()!.ok
                  ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
              }`}
            >
              <code>GET /api/health</code> — {testResult()!.msg}
            </div>
          </Show>
        </form>

        <p class="text-xs text-gray-500 dark:text-gray-400">
          Hint: Set the URL first, save, the app routes to <code>/</code>.
          Open the API log at the bottom of every page to watch STJÓRNA traffic live.
        </p>
      </div>
    </div>
  );
}
