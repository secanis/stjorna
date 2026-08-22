import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { authStore } from '~/stores/auth';
import { pb } from '~/services/pocketbase';
// CSS is referenced by URL to avoid pulling the entire swagger-ui CSS
// into the main bundle. Vite returns the resolved asset URL.
// @ts-ignore — swagger-ui-dist has no type declarations
import swaggerCss from 'swagger-ui-dist/swagger-ui.css?url';

export default function ApiDocs() {
  const navigate = useNavigate();
  let containerRef: HTMLDivElement | undefined;
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  let cleanup: (() => void) | null = null;

  onMount(async () => {
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    try {
      // Lazy-load the swagger-ui JS chunk — it's ~1MB so we don't want
      // it in the main bundle.
      const mod: any = await import('swagger-ui-dist/swagger-ui-bundle.js');
      const SwaggerUIBundle = mod.SwaggerUIBundle || mod.default || mod;

      // Inject the swagger CSS once (Vite returns the hashed asset URL).
      if (!document.querySelector(`link[data-swagger-css]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = swaggerCss;
        link.setAttribute('data-swagger-css', '');
        document.head.appendChild(link);
      }

      const pbUrl = (import.meta.env.VITE_PB_URL as string)?.replace(/\/+$/, '') || '';
      const ui = SwaggerUIBundle({
        url: `${pbUrl}/api/openapi.json`,
        domNode: containerRef,
        deepLinking: true,
        docExpansion: 'list',
        filter: true,
        requestInterceptor: (req: any) => {
          const token = pb.authStore.token;
          if (token) req.headers['Authorization'] = token;
          return req;
        },
        responseInterceptor: (res: any) => res,
      });

      cleanup = () => {
        try { ui?.shutdown?.(); } catch {}
      };

      setLoading(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to load API docs');
      setLoading(false);
    }
  });

  onCleanup(() => {
    cleanup?.();
    if (containerRef) containerRef.innerHTML = '';
  });

  return (
    <div class="space-y-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">API Documentation</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Auto-generated OpenAPI spec for the STJÓRN backend. The spec is
          filtered server-side based on the current token: anonymous
          visitors see <span class="text-gray-700 dark:text-gray-300">Public</span>, any
          authenticated user sees <span class="text-gray-700 dark:text-gray-300">Public + Private</span>,
          and only PB superusers see the
          <span class="text-gray-700 dark:text-gray-300">Admin</span> section. The
          "Try it out" feature uses the currently logged-in token to
          authorize calls.
        </p>
      </div>

      <Show when={loading()}>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 text-gray-500 dark:text-gray-400">
          Loading API docs…
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
