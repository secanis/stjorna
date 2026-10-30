import { createSignal, Show, For, onMount } from 'solid-js';
import { ClientResponseError } from 'pocketbase';
import { pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { i18nStore } from '~/i18n';
import { PRIMARY_BUTTON_CLASSES } from '~/styles/colors';

function describeError(err: unknown): string {
  if (!err) return i18nStore.t('auth.loginFailed');
  if (err instanceof ClientResponseError) {
    if (err.status === 0 || err.isAbort) {
      return i18nStore.t('auth.cannotReachServer');
    }
    const status = err.status;
    const msg = err.response?.message || err.originalError?.message || err.message;
    if (status && status >= 500) {
      return i18nStore.t('auth.serverError', { status, msg: msg || i18nStore.t('auth.checkPbLogs') });
    }
    if (status === 404 && /Failed to authenticate/i.test(msg || '')) {
      return i18nStore.t('auth.userNotFound');
    }
    return msg || i18nStore.t('auth.loginFailedStatus', { status: status || 'unknown' });
  }
  if (err instanceof Error) {
    return err.message || i18nStore.t('auth.loginFailed');
  }
  return String(err);
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
      // PB JS SDK 0.28 shape: { password: { enabled, identityFields },
      // oauth2: { enabled, providers }, otp, mfa }.
      setPasswordEnabled(methods.password?.enabled ?? true);

      const rawProviders = methods.oauth2?.enabled ? methods.oauth2.providers ?? [] : [];
      const providers = rawProviders.map((p) => ({
        name: String(p.name || ''),
        displayName: String(p.displayName || p.name || 'OIDC'),
        authURL: String(p.authURL || ''),
      }));
      setOidcProviders(providers);
    } catch (e: unknown) {
      console.warn('[LoginCard] failed to load auth methods:', e instanceof Error ? e.message : String(e));
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
    } catch (otpErr: unknown) {
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
        } catch (err: unknown) {
          const id = err instanceof ClientResponseError ? (err.response?.mfaId || err.data?.mfaId) : undefined;
          if (id) {
            await handleMFAChallenge(id);
            return;
          }
          setError(describeError(err));
          if (err instanceof ClientResponseError && err.status >= 500) setLocalHint(props.errorHint || null);
        }
      } else {
        try {
          await authStore.login(email(), password());
          props.onSuccess();
          return;
        } catch (err: unknown) {
          const id = err instanceof ClientResponseError ? (err.response?.mfaId || err.data?.mfaId) : undefined;
          if (id) {
            await handleMFAChallenge(id);
            return;
          }
          setError(describeError(err));
          if (err instanceof ClientResponseError && err.status >= 500) setLocalHint(props.errorHint || null);
        }
      }
    } catch (err: unknown) {
      setError(describeError(err));
      if (err instanceof ClientResponseError && err.status >= 500) setLocalHint(props.errorHint || null);
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
    } catch (err: unknown) {
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
      .catch((err: unknown) => {
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
              <span class="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">{i18nStore.t('auth.or')}</span>
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
                  {i18nStore.t('auth.email')}
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
                  {i18nStore.t('auth.password')}
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
                {loading() ? i18nStore.t('auth.signingIn') : i18nStore.t('auth.signIn')}
              </button>
            </form>
          }
        >
          <form onSubmit={handleOtpSubmit} class="space-y-4">
            <div class="text-sm text-gray-600 dark:text-gray-300">
              {i18nStore.t('auth.otpPrompt')}
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" for="otp">
                {i18nStore.t('auth.otpCode')}
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
              {loading() ? i18nStore.t('auth.verifying') : i18nStore.t('auth.verify')}
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
              {i18nStore.t('auth.backToPassword')}
            </button>
          </form>
        </Show>
      </Show>

      <Show when={!isAdmin() && !passwordEnabled() && oidcProviders().length === 0}>
        <div class="text-sm text-red-600 dark:text-red-400">
          {i18nStore.t('auth.noAuthMethod')}
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
