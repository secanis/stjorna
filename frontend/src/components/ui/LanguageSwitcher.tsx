import { For } from 'solid-js';
import { i18nStore } from '~/i18n';

/**
 * Compact locale picker (en/de/fr). Reused in the UserMenu dropdown and on
 * the Login/SuperuserLogin pages so the language can be changed before auth.
 */
export default function LanguageSwitcher() {
  return (
    <div class="flex gap-1" role="group" aria-label={i18nStore.t('language.label')}>
      <For each={i18nStore.availableLocales}>
        {(l) => (
          <button
            type="button"
            onClick={() => i18nStore.setLocale(l.code)}
            aria-pressed={i18nStore.locale === l.code}
            data-testid={`locale-${l.code}`}
            classList={{
              'flex-1 px-2 py-1 rounded text-xs font-medium transition-colors': true,
              'bg-blue-600 text-white': i18nStore.locale === l.code,
              'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700': i18nStore.locale !== l.code,
            }}
          >
            {l.nativeLabel}
          </button>
        )}
      </For>
    </div>
  );
}
