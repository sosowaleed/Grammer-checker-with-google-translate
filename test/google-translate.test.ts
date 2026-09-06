import { describe, it, expect } from 'vitest';
import { parseHtmlCorrections } from '../src/background/google-translate';

describe('parseHtmlCorrections', () => {
  it('correctly extracts multiple spelling mistakes and offsets', () => {
    const original = 'This is a exampel of speling eror';
    const htmlCorrected =
      'This is <b><i>an</i></b> <b><i>example</i></b> of <b><i>spelling</i></b> <b><i>error</i></b>';

    const corrections = parseHtmlCorrections(original, htmlCorrected);

    expect(corrections.length).toBe(4);

    expect(corrections[0].original).toBe('a');
    expect(corrections[0].corrected).toBe('an');
    expect(corrections[0].offset).toBe(8);
    expect(corrections[0].length).toBe(1);

    expect(corrections[1].original).toBe('exampel');
    expect(corrections[1].corrected).toBe('example');
    expect(corrections[1].offset).toBe(10);
    expect(corrections[1].length).toBe(7);

    expect(corrections[2].original).toBe('speling');
    expect(corrections[2].corrected).toBe('spelling');
    expect(corrections[2].offset).toBe(21);
    expect(corrections[2].length).toBe(7);

    expect(corrections[3].original).toBe('eror');
    expect(corrections[3].corrected).toBe('error');
    expect(corrections[3].offset).toBe(29);
    expect(corrections[3].length).toBe(4);
  });

  it('handles foreign language corrections (e.g. German & French)', () => {
    const originalGerman = 'Ich habe ein feler gemacht';
    const htmlGerman = 'Ich habe ein <b><i>fehler</i></b> gemacht';
    const germanCorrections = parseHtmlCorrections(originalGerman, htmlGerman);

    expect(germanCorrections.length).toBe(1);
    expect(germanCorrections[0].original).toBe('feler');
    expect(germanCorrections[0].corrected).toBe('fehler');
    expect(germanCorrections[0].offset).toBe(13);

    const originalFrench = 'Je mange une pome';
    const htmlFrench = 'Je mange une <b><i>pomme</i></b>';
    const frenchCorrections = parseHtmlCorrections(originalFrench, htmlFrench);

    expect(frenchCorrections.length).toBe(1);
    expect(frenchCorrections[0].original).toBe('pome');
    expect(frenchCorrections[0].corrected).toBe('pomme');
  });

  it('handles empty or clean sentences with no errors', () => {
    const clean = 'This is a clean sentence.';
    const corrections = parseHtmlCorrections(clean, clean);
    expect(corrections).toEqual([]);
  });

  it('handles HTML entity unescaping properly', () => {
    const original = 'Guten Tag wie gehts';
    const html = 'Guten Tag wie <b><i>geht&#39;s</i></b>';
    const corrections = parseHtmlCorrections(original, html);

    expect(corrections.length).toBe(1);
    expect(corrections[0].original).toBe('gehts');
    expect(corrections[0].corrected).toBe("geht's");
  });

  it('filters out ignored words from corrections', () => {
    const original = 'This is Forvel and a exampel';
    const html = 'This is <b><i>forvel</i></b> and <b><i>an</i></b> <b><i>example</i></b>';
    const corrections = parseHtmlCorrections(original, html);

    expect(corrections.length).toBe(3);

    const ignoredWords = ['forvel'];
    const ignoredSet = new Set(ignoredWords.map((w) => w.toLowerCase()));

    const filtered = corrections.filter(
      (c) => !ignoredSet.has(c.original.trim().toLowerCase())
    );

    expect(filtered.length).toBe(2);
    expect(filtered.some((c) => c.original.toLowerCase() === 'forvel')).toBe(false);
    expect(filtered.some((c) => c.original === 'a')).toBe(true);
    expect(filtered.some((c) => c.original === 'exampel')).toBe(true);
  });
});
