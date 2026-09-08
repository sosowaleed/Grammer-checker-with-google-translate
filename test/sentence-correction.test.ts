import { describe, it, expect } from 'vitest';
import { buildCorrectedSentence } from '../src/content/selection-popup';
import { GrammarCorrection } from '../src/shared/types';

describe('buildCorrectedSentence (Google Translate style)', () => {
  it('corrects a single typo in a full sentence with highlight styling', () => {
    const originalText = 'Review the memory archeticture and see if it needs any improvement';
    const corrections: GrammarCorrection[] = [
      {
        original: 'archeticture',
        corrected: 'architecture',
        offset: 18,
        length: 12,
        explanation: 'Spelling correction',
        type: 'spelling'
      }
    ];

    const result = buildCorrectedSentence(originalText, corrections);

    expect(result.correctedText).toBe(
      'Review the memory architecture and see if it needs any improvement'
    );
    expect(result.htmlHighlighted).toBe(
      'Review the memory <span class="polyglot-diff-highlight">architecture</span> and see if it needs any improvement'
    );
  });

  it('corrects multiple typos in a sentence preserving order and offsets', () => {
    const originalText = 'This is a exampel of speling eror';
    const corrections: GrammarCorrection[] = [
      {
        original: 'a',
        corrected: 'an',
        offset: 8,
        length: 1,
        explanation: 'Use an before vowel sounds',
        type: 'grammar'
      },
      {
        original: 'exampel',
        corrected: 'example',
        offset: 10,
        length: 7,
        explanation: 'Spelling correction',
        type: 'spelling'
      },
      {
        original: 'speling',
        corrected: 'spelling',
        offset: 21,
        length: 7,
        explanation: 'Spelling correction',
        type: 'spelling'
      },
      {
        original: 'eror',
        corrected: 'error',
        offset: 29,
        length: 4,
        explanation: 'Spelling correction',
        type: 'spelling'
      }
    ];

    const result = buildCorrectedSentence(originalText, corrections);

    expect(result.correctedText).toBe('This is an example of spelling error');
    expect(result.htmlHighlighted).toContain(
      '<span class="polyglot-diff-highlight">an</span>'
    );
    expect(result.htmlHighlighted).toContain(
      '<span class="polyglot-diff-highlight">example</span>'
    );
    expect(result.htmlHighlighted).toContain(
      '<span class="polyglot-diff-highlight">spelling</span>'
    );
    expect(result.htmlHighlighted).toContain(
      '<span class="polyglot-diff-highlight">error</span>'
    );
  });

  it('safely escapes HTML characters in original and corrected text', () => {
    const originalText = 'Checking <script>alert("xss")</script> & typo archeticture';
    const corrections: GrammarCorrection[] = [
      {
        original: 'archeticture',
        corrected: 'architecture',
        offset: 46,
        length: 12,
        explanation: 'Spelling correction',
        type: 'spelling'
      }
    ];

    const result = buildCorrectedSentence(originalText, corrections);
    expect(result.htmlHighlighted).not.toContain('<script>');
    expect(result.htmlHighlighted).toContain('&lt;script&gt;');
    expect(result.htmlHighlighted).toContain('&amp;');
    expect(result.htmlHighlighted).toContain(
      '<span class="polyglot-diff-highlight">architecture</span>'
    );
  });

  it('returns original text unchanged when corrections list is empty', () => {
    const originalText = 'Everything is perfectly spelled here.';
    const result = buildCorrectedSentence(originalText, []);
    expect(result.correctedText).toBe(originalText);
    expect(result.htmlHighlighted).toBe(originalText);
  });
});
