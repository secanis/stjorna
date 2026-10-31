import { ParentProps, Show, createEffect, createSignal, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { authStore } from '~/stores/auth';
import { i18nStore } from '~/i18n';

/**
 * Route guard for everything behind the app shell.
 *
 * Restores and verifies the session once (authStore.init() refreshes the
 * token and loads tenants), then renders children only while the user is
 * authenticated. Whenever the session disappears (logout, 401, expiry,
 * logout in another tab) the user is sent to /login.
 */
export default function RequireAuth(props: ParentProps) {
  const navigate = useNavigate();
  const [ready, setReady] = createSignal(false);

  onMount(async () => {
    try {
      await authStore.init();
    } finally {
      setReady(true);
    }
  });

  createEffect(() => {
    if (ready() && !authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
    }
  });

  return (
    <Show
      when={ready() && authStore.isAuthenticated()}
      fallback={
        <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center" role="status" aria-live="polite">
          <span class="text-gray-500 dark:text-gray-400">{i18nStore.t('common.loading')}</span>
        </div>
      }
    >
      {props.children}
    </Show>
  );
}
