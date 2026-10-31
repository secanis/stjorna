import { For } from 'solid-js';
import { i18nStore } from '~/i18n';

/**
 * Minimal language indicator pinned to the top-right edge, for public pages
 * (login / superuser login / setup / 404) where there is no app header to
 * host the switcher. Shows compact locale codes (EN/DE/FR).
 */
export default function CornerLanguageSwitcher() {
  return (
    <div
      class="fixed top-3 right-3 z-50 flex items-center gap-1"
      role="group"
      aria-label={i18nStore.t('language.label')}
    >
      <For each={i18nStore.availableLocales}>
        {(l) => (
          <button
            type="button"
            onClick={() => i18nStore.setLocale(l.code)}
            aria-pressed={i18nStore.locale === l.code}
            title={l.nativeLabel}
            data-testid={`locale-${l.code}`}
            classList={{
              'px-1.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wide transition-colors border': true,
              'bg-blue-600 text-white border-blue-600': i18nStore.locale === l.code,
              'bg-white/70 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:text-gray-900 dark:hover:text-white': i18nStore.locale !== l.code,
            }}
          >
            {l.code.toUpperCase()}
          </button>
        )}
      </For>
    </div>
  );
}
