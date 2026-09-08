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

  it('correctly targets ONLY the misspelled word when sentence has multiple spaces', () => {
    // User scenario: "lanterns  hats does givea" with double space between lanterns and hats
    const original = 'lanterns  hats does givea';
    const html = 'lanterns hats does <b><i>giva</i></b>';

    const corrections = parseHtmlCorrections(original, html);

    expect(corrections.length).toBe(1);
    expect(corrections[0].original).toBe('givea');
    expect(corrections[0].corrected).toBe('giva');
    expect(corrections[0].offset).toBe(20);
    expect(corrections[0].length).toBe(5);
    // Crucial: Must NEVER capture the entire sentence!
    expect(corrections[0].original).not.toContain('lanterns');
    expect(corrections[0].original).not.toContain('hats');
    expect(corrections[0].original).not.toContain('does');
  });

  it('handles multi-space and tab variations with preceding and trailing text', () => {
    const original = 'lanterns \t hats   does   givea   quickly and easily';
    const html = 'lanterns hats does <b><i>giva</i></b> quickly and easily';

    const corrections = parseHtmlCorrections(original, html);

    expect(corrections.length).toBe(1);
    expect(corrections[0].original).toBe('givea');
    expect(corrections[0].corrected).toBe('giva');
    expect(corrections[0].original).not.toContain('lanterns');
    expect(corrections[0].original).not.toContain('quickly');
  });

  it('multi-word guard narrows down to single typo word even in catastrophic anchor failures', () => {
    const original = 'first second third givea';
    // Artificial case where Google returned completely mismatched prefix text
    const html = 'different words entirely <b><i>giva</i></b>';

    const corrections = parseHtmlCorrections(original, html);

    expect(corrections.length).toBe(1);
    // Levenshtein closest to "giva" among [first, second, third, givea] is "givea"
    expect(corrections[0].original).toBe('givea');
    expect(corrections[0].length).toBe(5);
  });

  it('correctly extracts MULTIPLE consecutive and adjacent typos in sentences', () => {
    // User scenario: "lanterns  hatss givea a fu" with multiple typos and double spaces
    const original = 'lanterns  hatss givea a fu';
    const html = 'lanterns <b><i>hats</i></b> <b><i>give</i></b> a fu';

    const corrections = parseHtmlCorrections(original, html);

    expect(corrections.length).toBe(2);

    expect(corrections[0].original).toBe('hatss');
    expect(corrections[0].corrected).toBe('hats');
    expect(corrections[0].offset).toBe(10);
    expect(corrections[0].length).toBe(5);

    expect(corrections[1].original).toBe('givea');
    expect(corrections[1].corrected).toBe('give');
    expect(corrections[1].offset).toBe(16);
    expect(corrections[1].length).toBe(5);
  });

  it('correctly corrects "sandwitch" to "sandwich" for "Whole sandwitch"', () => {
    const original = 'Whole sandwitch';
    const html = 'Whole <b><i>sandwich</i></b>';

    const corrections = parseHtmlCorrections(original, html);

    expect(corrections.length).toBe(1);
    expect(corrections[0].original).toBe('sandwitch');
    expect(corrections[0].corrected).toBe('sandwich');
    expect(corrections[0].offset).toBe(6);
    expect(corrections[0].length).toBe(9);
  });

  it('correctly corrects standalone "sandwitch" to "sandwich"', () => {
    const original = 'sandwitch';
    const html = '<b><i>sandwich</i></b>';

    const corrections = parseHtmlCorrections(original, html);

    expect(corrections.length).toBe(1);
    expect(corrections[0].original).toBe('sandwitch');
    expect(corrections[0].corrected).toBe('sandwich');
    expect(corrections[0].offset).toBe(0);
    expect(corrections[0].length).toBe(9);
  });
});

