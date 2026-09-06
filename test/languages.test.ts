import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, POPULAR_LANGUAGES, getLanguageName } from '../src/shared/languages';

describe('languages registry', () => {
  it('contains over 100 supported Google Translate languages', () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThan(100);
  });

  it('correctly maps language codes to names', () => {
    expect(getLanguageName('en')).toBe('English');
    expect(getLanguageName('es')).toBe('Spanish');
    expect(getLanguageName('fr')).toBe('French');
    expect(getLanguageName('de')).toBe('German');
    expect(getLanguageName('ja')).toBe('Japanese');
    expect(getLanguageName('ar')).toBe('Arabic');
    expect(getLanguageName('auto')).toBe('Auto-detect');
  });

  it('popular languages list are all valid supported languages', () => {
    for (const code of POPULAR_LANGUAGES) {
      const found = SUPPORTED_LANGUAGES.some((l) => l.code === code);
      expect(found).toBe(true);
    }
  });
});
