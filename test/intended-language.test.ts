import { describe, it, expect } from 'vitest';
import { t, getAvailableUiLanguages } from '../src/shared/l10n';
import { SUPPORTED_LANGUAGES, POPULAR_LANGUAGES, getLanguageName } from '../src/shared/languages';

describe('Intended Language & L10n', () => {
  it('provides intended_language, inferred_from_context, and checking_in_language translations in all 10 languages', () => {
    const available = getAvailableUiLanguages();
    expect(available.length).toBe(10);

    for (const lang of available) {
      const label = t('intended_language', lang.code);
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(1);

      const inferred = t('inferred_from_context', lang.code);
      expect(inferred).toBeTruthy();
      expect(inferred.length).toBeGreaterThan(1);

      const checking = t('checking_in_language', lang.code);
      expect(checking).toBeTruthy();
      expect(checking.length).toBeGreaterThan(1);
    }
  });

  it('correctly maps language codes to names for UI display', () => {
    expect(getLanguageName('en')).toBe('English');
    expect(getLanguageName('ht')).toBe('Haitian Creole');
    expect(getLanguageName('es')).toBe('Spanish');
    expect(getLanguageName('de')).toBe('German');
    expect(getLanguageName('fr')).toBe('French');
  });

  it('contains popular languages in the supported list', () => {
    for (const code of POPULAR_LANGUAGES) {
      expect(SUPPORTED_LANGUAGES.some((l) => l.code === code)).toBe(true);
    }
  });
});
