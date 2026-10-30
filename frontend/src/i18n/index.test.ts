import { describe, it, expect, beforeEach } from 'vitest';
import { i18nStore } from './index';

describe('i18nStore', () => {
  beforeEach(() => {
    i18nStore.setLocale('en');
  });

  it('defaults to English when nothing is stored', () => {
    expect(i18nStore.locale).toBe('en');
  });

  it('translates across all three locales', () => {
    expect(i18nStore.t('nav.dashboard')).toBe('Dashboard');

    i18nStore.setLocale('de');
    expect(i18nStore.locale).toBe('de');
    expect(i18nStore.t('nav.dashboard')).toBe('Übersicht');

    i18nStore.setLocale('fr');
    expect(i18nStore.t('nav.dashboard')).toBe('Tableau de bord');
  });

  it('resolves templates', () => {
    i18nStore.setLocale('en');
    expect(i18nStore.t('tenantSelector.currentTenant', { name: 'Acme' })).toBe(
      'Current tenant: Acme. Switch tenant'
    );
  });

  it('falls back to the key path for unknown keys', () => {
    expect(i18nStore.t('does.not.exist')).toBe('does.not.exist');
  });
});
