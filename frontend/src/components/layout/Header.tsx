import { Show } from 'solid-js';
import TenantSelector from './TenantSelector';
import UserMenu from './UserMenu';
import { authStore } from '~/stores/auth';
import { themeStore } from '~/stores/theme';
import { tenantTheme } from '~/stores/tenantTheme';
import { i18nStore } from '~/i18n';
import { getMediaFileUrl } from '~/utils/mediaUrl';

export default function Header() {
  // Per-tenant header background override; empty string = default styling.
  const bg = () => tenantTheme.headerBg(themeStore.effective);

  return (
    <header
      class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between"
      style={bg() ? { 'background-color': bg() } : undefined}
    >
      <Show
        when={tenantTheme.logoMedia}
        keyed
        fallback={<div class="text-xl font-bold text-gray-900 dark:text-white">STJÓRNA</div>}
      >
        {(media) => (
          <img
            src={getMediaFileUrl(media.id, media.file)}
            alt={i18nStore.t('header.tenantLogoAlt')}
            class="h-7 max-w-[200px] object-contain"
          />
        )}
      </Show>
      <div class="flex items-center gap-4">
        <Show when={!authStore.isPBAdmin}>
          <TenantSelector />
          <div class="border-l border-gray-200 dark:border-gray-700 h-6" />
        </Show>
        <UserMenu />
      </div>
    </header>
  );
}
