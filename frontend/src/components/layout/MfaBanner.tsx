import { Show, createResource } from 'solid-js';
import { A } from '@solidjs/router';
import { pbInstance as pb } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';
import { i18nStore } from '~/i18n';

// T-14: superuser MFA is only enabled automatically when setup finishes
// with SMTP configured (OTP codes go out by email). Until it is on, every
// superuser sees this persistent banner.
export default function MfaBanner() {
  const [mfaEnabled] = createResource(
    () => (authStore.isPBAdmin ? true : null),
    async () => {
      try {
        const su = await pb.collections.getOne('_superusers');
        return !!(su as any).mfa?.enabled;
      } catch {
        // Unknown state (network/permission) — don't nag.
        return true;
      }
    }
  );

  return (
    <Show when={authStore.isPBAdmin && mfaEnabled() === false}>
      <div
        role="alert"
        data-testid="mfa-disabled-banner"
        class="px-6 py-2 text-sm bg-amber-100 text-amber-900 border-b border-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700"
      >
        {i18nStore.t('mfaBanner.prefix')}<A href="/settings/smtp" class="underline font-medium">{i18nStore.t('mfaBanner.configureSmtp')}</A>{i18nStore.t('mfaBanner.middle')}<A href="/settings/security" class="underline font-medium">{i18nStore.t('mfaBanner.security')}</A>{i18nStore.t('mfaBanner.suffix')}
      </div>
    </Show>
  );
}
