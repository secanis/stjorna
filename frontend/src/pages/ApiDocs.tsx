import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { authStore } from '~/stores/auth';
import { i18nStore } from '~/i18n';
import { pb } from '~/services/pocketbase';
// CSS is referenced by URL to avoid pulling the entire swagger-ui CSS
// into the main bundle. Vite returns the resolved asset URL.
import swaggerCss from 'swagger-ui-dist/swagger-ui.css?url';
import { getConfiguredPbUrl } from '~/services/config';
import { errorMessage } from '~/utils/errors';

type SwaggerUIBundleFn = (config: Record<string, unknown>) => { shutdown?: () => void };

// Builds the OpenAPI spec URL without triggering mixed-content in HTTPS
// deployments.
//
// `VITE_PB_URL` is empty by default — meaning the FE and PB share an origin
// via a reverse proxy (production nginx, helm ingress, or vite dev proxy) —
// and we use a relative URL. When the operator explicitly sets an absolute
// origin, we honour its protocol, but if it points at `http://` while the
// page is HTTPS, we fall back to the page's protocol to avoid the browser's
// "Mixed Content: The page was loaded over HTTPS, but requested an insecure
// resource" block. Operators who genuinely serve PB over HTTP behind an
// HTTPS proxy should leave `VITE_PB_URL` empty.
function buildSpecUrl(pbUrl: string): string {
  if (!pbUrl) return '/api/openapi.json';
  // Already matches the page protocol → use as-is.
  if (pbUrl.startsWith('//')) return `${pbUrl}/api/openapi.json`;
  if (typeof window !== 'undefined') {
    const pageIsHttps = window.location.protocol === 'https:';
    const originIsHttp = pbUrl.startsWith('http://');
    if (pageIsHttps && originIsHttp) {
      // Strip http://, use protocol-relative — browser inherits https:.
      return `${pbUrl.replace(/^http:/, '')}/api/openapi.json`;
    }
  }
  return `${pbUrl}/api/openapi.json`;
}

// swagger-ui 5.x renders its dark theme only when `html.dark-mode` is set, and
// its own lightbulb toggle only consults `prefers-color-scheme` once on mount —
// it never follows the app theme. Sync the class from the app's `.dark`
// (toggled by stores/theme.ts) so the reference matches the rest of the UI.
function syncSwaggerDark(): void {
  const dark = document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark-mode', dark);
}

export default function ApiDocs() {
  const navigate = useNavigate();
  let containerRef: HTMLDivElement | undefined;
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  let cleanup: (() => void) | null = null;
  let darkObserver: MutationObserver | null = null;

  onMount(async () => {
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    try {
      // Lazy-load the swagger-ui JS chunk — it's ~1MB so we don't want
      // it in the main bundle.
      const mod = await import('swagger-ui-dist/swagger-ui-bundle.js');
      const SwaggerUIBundle = (((mod as { SwaggerUIBundle?: unknown }).SwaggerUIBundle
        ?? (mod as { default?: unknown }).default
        ?? mod) as SwaggerUIBundleFn);

      // Inject the swagger CSS once (Vite returns the hashed asset URL).
      if (!document.querySelector(`link[data-swagger-css]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = swaggerCss;
        link.setAttribute('data-swagger-css', '');
        document.head.appendChild(link);
      }

      // The app theme drives dark mode, so hide swagger's redundant toggle.
      if (!document.querySelector(`style[data-swagger-dark]`)) {
        const style = document.createElement('style');
        style.textContent = '.swagger-ui .topbar .dark-mode-toggle { display: none; }';
        style.setAttribute('data-swagger-dark', '');
        document.head.appendChild(style);
      }

      // Apply the current theme before swagger renders to avoid a light flash.
      syncSwaggerDark();

      const pbUrl = getConfiguredPbUrl();
      const specUrl = buildSpecUrl(pbUrl);
      const ui = SwaggerUIBundle({
        url: specUrl,
        domNode: containerRef,
        deepLinking: true,
        docExpansion: 'list',
        filter: true,
        requestInterceptor: (req: { headers: Record<string, string> }) => {
          const token = pb.authStore.token;
          if (token) req.headers['Authorization'] = token;
          return req;
        },
        responseInterceptor: (res: unknown) => res,
      });

      cleanup = () => {
        try { ui?.shutdown?.(); } catch {}
      };

      // swagger's mount may add `dark-mode` from prefers-color-scheme; re-assert
      // so the app theme wins, then keep it in sync while this page is mounted.
      syncSwaggerDark();
      darkObserver = new MutationObserver(syncSwaggerDark);
      darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

      setLoading(false);
    } catch (e: unknown) {
      setError(errorMessage(e, i18nStore.t('apiDocs.failedToLoad')));
      setLoading(false);
    }
  });

  onCleanup(() => {
    darkObserver?.disconnect();
    darkObserver = null;
    cleanup?.();
    if (containerRef) containerRef.innerHTML = '';
  });

  return (
    <div class="space-y-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{i18nStore.t('apiDocs.title')}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {i18nStore.t('apiDocs.description')}{' '}
          <span class="text-gray-700 dark:text-gray-300">{i18nStore.t('apiDocs.publicTier')}</span>,{' '}
          {i18nStore.t('apiDocs.anyUserSees')}{' '}
          <span class="text-gray-700 dark:text-gray-300">{i18nStore.t('apiDocs.publicAndPrivate')}</span>,{' '}
          {i18nStore.t('apiDocs.onlySuperusersSee')}{' '}
          <span class="text-gray-700 dark:text-gray-300">{i18nStore.t('apiDocs.adminTier')}</span>{' '}
          {i18nStore.t('apiDocs.sectionHint')}
        </p>
      </div>

      <Show when={loading()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 text-gray-500 dark:text-gray-400">
          {i18nStore.t('apiDocs.loading')}
        </div>
      </Show>

      <Show when={error()}>
        <div class="bg-red-500/10 border border-red-500 rounded p-4 text-red-600 dark:text-red-400 text-sm">
          {error()}
        </div>
      </Show>

      <div
        ref={containerRef}
        data-testid="swagger-ui"
        class="bg-white dark:bg-gray-900 rounded-lg p-2 min-h-[600px]"
        style={{ display: loading() || !!error() ? 'none' : 'block' }}
      />
    </div>
  );
}
