/*
 * STJÓRNA i18n — @solid-primitives/i18n wiring.
 * ============================================
 * Static dictionaries (en/de/fr) are bundled and switched reactively with a
 * memo. `i18nStore.t(key)` is reactive when called inside JSX/render scope
 * (it reads the `dict` memo) and snapshots the current language when called
 * from event handlers / async code. Locale is persisted to localStorage and
 * falls back to the browser language on first visit.
 *
 * Usage:
 *   import { i18nStore } from '~/i18n';
 *   <h1>{i18nStore.t('dashboard.title')}</h1>
 *   i18nStore.setLocale('de');
 */

import { createSignal, createMemo } from 'solid-js';
import * as i18n from '@solid-primitives/i18n';
import { dict as enDict, type RawDictionary } from './en';
import { dict as deDict } from './de';
import { dict as frDict } from './fr';

export type Locale = 'en' | 'de' | 'fr';
export type Dictionary = i18n.Flatten<RawDictionary>;

export interface LocaleOption {
  code: Locale;
  /** Label shown in the switcher, in that locale's own language. */
  nativeLabel: string;
  /** English label (stable regardless of active locale). */
  englishLabel: string;
}

export const LOCALES: LocaleOption[] = [
  { code: 'en', nativeLabel: 'English', englishLabel: 'English' },
  { code: 'de', nativeLabel: 'Deutsch', englishLabel: 'German' },
  { code: 'fr', nativeLabel: 'Français', englishLabel: 'French' },
];

const dictionaries: Record<Locale, RawDictionary> = {
  en: enDict,
  de: deDict,
  fr: frDict,
};

const STORAGE_KEY = 'stjorna_locale';

function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const lang = (window.navigator.language || 'en').toLowerCase();
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('fr')) return 'fr';
  return 'en';
}

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'en' || v === 'de' || v === 'fr') return v;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through.
  }
  return detectBrowserLocale();
}

const [locale, setLocaleSignal] = createSignal<Locale>(readStoredLocale());

const dict = createMemo<Dictionary>(() => i18n.flatten(dictionaries[locale()]));

// The lib's Translator type keys off the full (nested + flat) dictionary
// shape, which is over-constrained for our loose `t(path: string)` wrapper.
// We cast to a plain signature; runtime behaviour is unchanged.
// eslint-disable-next-line solid/reactivity -- `dict` is passed as an accessor; the lib calls it on every translation.
const translator = i18n.translator(dict, i18n.resolveTemplate) as unknown as (
  path: string,
  options?: Record<string, unknown>,
) => string | undefined;

/**
 * Translate `path` in the current locale. Falls back to the raw path when a
 * key is missing so a translation gap is visible in dev instead of rendering
 * `undefined`.
 */
function t(path: string, options?: Record<string, unknown>): string {
  return translator(path, options) ?? path;
}

function applyLocale(next: Locale): void {
  setLocaleSignal(next);
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore — persistence is best-effort.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}

// Set the initial <html lang> before mount (SSR-safe guard).
// eslint-disable-next-line solid/reactivity -- one-time module-scope init; intentionally not a tracked read.
if (typeof document !== 'undefined') document.documentElement.lang = locale();

export const i18nStore = {
  get locale(): Locale {
    return locale();
  },
  get availableLocales(): LocaleOption[] {
    return LOCALES;
  },
  setLocale: applyLocale,
  t,
};

// Debug handle for local development only; never exposed in production.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __i18nStore?: typeof i18nStore }).__i18nStore = i18nStore;
}
