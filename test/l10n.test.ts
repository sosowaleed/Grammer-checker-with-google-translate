import { describe, it, expect } from 'vitest';
import {
  AVAILABLE_UI_LANGUAGES,
  TRANSLATIONS,
  t,
  getAvailableUiLanguages,
  applyTranslations,
  TranslationKey
} from '../src/shared/l10n';

describe('l10n localization engine', () => {
  it('supports the top 10 languages', () => {
    const langs = getAvailableUiLanguages();
    expect(langs.length).toBe(10);
    const codes = langs.map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('es');
    expect(codes).toContain('fr');
    expect(codes).toContain('de');
    expect(codes).toContain('it');
    expect(codes).toContain('pt');
    expect(codes).toContain('ru');
    expect(codes).toContain('ja');
    expect(codes).toContain('zh');
    expect(codes).toContain('ar');
  });

  it('correctly sets Arabic as RTL and others as LTR', () => {
    const ar = AVAILABLE_UI_LANGUAGES.find((l) => l.code === 'ar');
    const en = AVAILABLE_UI_LANGUAGES.find((l) => l.code === 'en');
    expect(ar?.dir).toBe('rtl');
    expect(en?.dir).toBe('ltr');
  });

  it('translates keys with fallback to English', () => {
    expect(t('status_active', 'en')).toBe('Active');
    expect(t('status_active', 'es')).toBe('Activo');
    expect(t('status_active', 'fr')).toBe('Actif');
    expect(t('status_active', 'de')).toBe('Aktiv');
    expect(t('status_active', 'ar')).toBe('مفعل');
    // Fallback for unknown language
    expect(t('status_active', 'xx' as any)).toBe('Active');
  });

  it('every language has complete translation keys without missing entries', () => {
    const enKeys = Object.keys(TRANSLATIONS.en) as TranslationKey[];
    expect(enKeys.length).toBeGreaterThan(30);

    for (const lang of AVAILABLE_UI_LANGUAGES) {
      const dict = TRANSLATIONS[lang.code];
      expect(dict, `Dictionary for ${lang.code} should exist`).toBeDefined();
      for (const key of enKeys) {
        expect(dict[key], `Language "${lang.code}" is missing key "${key}"`).toBeDefined();
        expect(dict[key].trim().length, `Language "${lang.code}" key "${key}" should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it('applyTranslations updates DOM elements with data-i18n attributes', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <h1 data-i18n="app_name">Original</h1>
      <input data-i18n-placeholder="playground_placeholder" placeholder="Original" />
      <span data-i18n-title="btn_add" title="Original"></span>
    `;

    applyTranslations('es', container);
    expect(container.querySelector('h1')?.textContent).toBe('PolyglotGrammar');
    expect(container.querySelector('input')?.placeholder).toBe(
      'Escribe aquí para probar PolyglotGrammar en vivo...'
    );
    expect(container.querySelector('span')?.title).toBe('Añadir');

    // Test Arabic RTL setting
    applyTranslations('ar', container);
    expect(container.dir).toBe('rtl');
  });
});
