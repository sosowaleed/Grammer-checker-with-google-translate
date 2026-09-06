import { GrammarCorrection, SynonymGroup, TranslationResult } from '../shared/types';

const CLIENT_ENDPOINTS = [
  'https://clients5.google.com/translate_a/single?client=dict-chrome-ex',
  'https://translate.googleapis.com/translate_a/single?client=gtx'
];

function unescapeHtml(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function cleanWord(str: string): string {
  return str.trim().replace(/^['"“‘(]+|[)'"”’.,!?:;]+$/g, '');
}

/**
 * Align original text with HTML marked correction from Google Translate:
 * e.g. "This is <b><i>an</i></b> <b><i>example</i></b>"
 */
export function parseHtmlCorrections(
  originalText: string,
  htmlCorrected: string
): GrammarCorrection[] {
  const corrections: GrammarCorrection[] = [];
  if (!htmlCorrected || !htmlCorrected.includes('<b><i>')) {
    return corrections;
  }

  const unescapedHtml = unescapeHtml(htmlCorrected);

  // Split into alternating parts: outside <b><i> and inside <b><i>
  const tagRegex = /<b><i>([\s\S]*?)<\/i><\/b>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  interface Chunk {
    text: string;
    isCorrected: boolean;
  }

  const chunks: Chunk[] = [];

  while ((match = tagRegex.exec(unescapedHtml)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({
        text: unescapedHtml.substring(lastIndex, match.index),
        isCorrected: false
      });
    }
    chunks.push({
      text: match[1],
      isCorrected: true
    });
    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < unescapedHtml.length) {
    chunks.push({
      text: unescapedHtml.substring(lastIndex),
      isCorrected: false
    });
  }

  // Now align with originalText
  let originalPointer = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    if (!chunk.isCorrected) {
      // Find chunk in originalText starting from originalPointer
      const foundIndex = originalText.indexOf(chunk.text, originalPointer);
      if (foundIndex !== -1) {
        originalPointer = foundIndex + chunk.text.length;
      }
    } else {
      // This is a corrected segment.
      // Next uncorrected chunk acts as the end anchor
      const nextUncorrected = chunks.slice(i + 1).find((c) => !c.isCorrected);
      let endAnchorIndex = -1;

      if (nextUncorrected && nextUncorrected.text.length > 0) {
        endAnchorIndex = originalText.indexOf(nextUncorrected.text, originalPointer);
      } else {
        endAnchorIndex = originalText.length;
      }

      if (endAnchorIndex !== -1 && endAnchorIndex >= originalPointer) {
        const originalSnippet = originalText.substring(originalPointer, endAnchorIndex);
        const trimmedOriginal = originalSnippet.trim();
        const trimmedReplacement = chunk.text.trim();

        if (trimmedOriginal.length > 0 && trimmedOriginal !== trimmedReplacement) {
          const startOffset = originalText.indexOf(trimmedOriginal, originalPointer);
          const offset = startOffset !== -1 ? startOffset : originalPointer;

          corrections.push({
            original: trimmedOriginal,
            corrected: trimmedReplacement,
            offset: offset,
            length: trimmedOriginal.length,
            explanation: determineExplanation(trimmedOriginal, trimmedReplacement),
            type: determineType(trimmedOriginal, trimmedReplacement)
          });
        }

        originalPointer = endAnchorIndex;
      }
    }
  }

  return corrections;
}

function determineExplanation(original: string, corrected: string): string {
  const origLower = original.toLowerCase();
  const corrLower = corrected.toLowerCase();

  if ((origLower === 'a' && corrLower === 'an') || (origLower === 'an' && corrLower === 'a')) {
    return "Grammar: Use 'an' before words starting with a vowel sound, 'a' before consonants.";
  }
  if (origLower === corrLower && original !== corrected) {
    return 'Capitalization correction.';
  }
  if (original.length === corrected.length && Math.abs(original.length - corrected.length) <= 2) {
    return 'Spelling correction.';
  }
  return 'Suggested grammar / spelling improvement.';
}

function determineType(original: string, corrected: string): 'spelling' | 'grammar' | 'style' {
  const origLower = original.toLowerCase();
  const corrLower = corrected.toLowerCase();

  if (origLower === 'a' && corrLower === 'an') return 'grammar';
  if (origLower === corrLower) return 'style';
  return 'spelling';
}

/**
 * Primary Google Translate Integration Service
 */
export class GoogleTranslateService {
  private static async fetchFromEndpoint(url: string): Promise<any> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Translate API responded with status ${response.status}`);
    }

    return await response.json();
  }

  private static async requestWithFallback(queryUrlGenerator: (endpoint: string) => string): Promise<any> {
    let lastError: Error | null = null;
    for (const endpoint of CLIENT_ENDPOINTS) {
      try {
        const url = queryUrlGenerator(endpoint);
        const data = await this.fetchFromEndpoint(url);
        return data;
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError || new Error('All Google Translate endpoints failed');
  }

  /**
   * Grammar and spell checking
   */
  public static async checkText(
    text: string,
    targetLangFallback: string = 'es'
  ): Promise<{ corrections: GrammarCorrection[]; detectedLanguage: string }> {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) {
      return { corrections: [], detectedLanguage: 'auto' };
    }

    // Google Translate query correction works best when target language is different from source
    // By default sl=auto, and we request qc (query correction), t (translation), and bd (dictionary)
    const encoded = encodeURIComponent(text);

    try {
      const data = await this.requestWithFallback(
        (ep) => `${ep}&sl=auto&tl=${targetLangFallback}&dt=t&dt=qc&dt=bd&q=${encoded}`
      );

      const detectedLang = data && data[2] ? String(data[2]) : 'en';

      // If detected language happens to match targetLangFallback, do a second query with 'en' (or 'es')
      let qcData = data && data[7];
      if (!qcData && detectedLang === targetLangFallback) {
        const altTarget = targetLangFallback === 'en' ? 'es' : 'en';
        try {
          const retryData = await this.requestWithFallback(
            (ep) => `${ep}&sl=auto&tl=${altTarget}&dt=t&dt=qc&q=${encoded}`
          );
          if (retryData && retryData[7]) {
            qcData = retryData[7];
          }
        } catch {
          // ignore retry failure
        }
      }

      let corrections: GrammarCorrection[] = [];

      if (qcData && Array.isArray(qcData) && qcData.length > 0) {
        const htmlCorrected = qcData[0];
        if (typeof htmlCorrected === 'string') {
          corrections = parseHtmlCorrections(text, htmlCorrected);
        }
      }

      return {
        corrections,
        detectedLanguage: detectedLang
      };
    } catch (err) {
      // User rule: If an API request fails or is throttled, silently back off without blocking user typing
      return { corrections: [], detectedLanguage: 'auto' };
    }
  }

  /**
   * Synonym extraction with Part of Speech
   */
  public static async getSynonyms(
    word: string,
    preferredLang: string = 'en'
  ): Promise<{ word: string; synonyms: SynonymGroup[]; detectedLanguage: string }> {
    const clean = cleanWord(word);
    if (!clean) {
      return { word, synonyms: [], detectedLanguage: 'auto' };
    }

    const encoded = encodeURIComponent(clean);

    try {
      const data = await this.requestWithFallback(
        (ep) => `${ep}&sl=auto&tl=${preferredLang}&dt=t&dt=bd&dt=ss&dt=md&q=${encoded}`
      );

      const detectedLang = data && data[2] ? String(data[2]) : 'en';
      const groupsMap = new Map<string, Set<string>>();

      // 1. Check dt=ss (thesaurus synonyms) at index 11
      const ssData = data && data[11];
      if (Array.isArray(ssData)) {
        for (const item of ssData) {
          if (Array.isArray(item) && item.length >= 2) {
            const pos = String(item[0] || 'general').toLowerCase();
            const subGroups = item[1];

            if (!groupsMap.has(pos)) {
              groupsMap.set(pos, new Set<string>());
            }

            if (Array.isArray(subGroups)) {
              for (const group of subGroups) {
                if (Array.isArray(group) && Array.isArray(group[0])) {
                  for (const synonym of group[0]) {
                    if (typeof synonym === 'string' && synonym.toLowerCase() !== clean.toLowerCase()) {
                      groupsMap.get(pos)!.add(synonym);
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 2. Check dt=bd (bilingual dictionary) at index 1
      const bdData = data && data[1];
      if (Array.isArray(bdData)) {
        for (const item of bdData) {
          if (Array.isArray(item) && item.length >= 2) {
            const pos = String(item[0] || 'general').toLowerCase();
            const termsList = item[1];

            if (!groupsMap.has(pos)) {
              groupsMap.set(pos, new Set<string>());
            }

            if (Array.isArray(termsList)) {
              for (const term of termsList) {
                if (typeof term === 'string' && term.toLowerCase() !== clean.toLowerCase()) {
                  groupsMap.get(pos)!.add(term);
                }
              }
            }
          }
        }
      }

      const synonyms: SynonymGroup[] = [];
      for (const [pos, termsSet] of groupsMap.entries()) {
        const terms = Array.from(termsSet).slice(0, 12);
        if (terms.length > 0) {
          synonyms.push({
            word: clean,
            pos,
            terms
          });
        }
      }

      return {
        word: clean,
        synonyms,
        detectedLanguage: detectedLang
      };
    } catch (err) {
      return { word: clean, synonyms: [], detectedLanguage: 'auto' };
    }
  }

  /**
   * Sentence & full text translation
   */
  public static async translateText(
    text: string,
    targetLang: string = 'en',
    sourceLang: string = 'auto'
  ): Promise<TranslationResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        originalText: text,
        translatedText: '',
        detectedLanguage: sourceLang,
        targetLanguage: targetLang
      };
    }

    const encoded = encodeURIComponent(trimmed);

    try {
      const data = await this.requestWithFallback(
        (ep) => `${ep}&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encoded}`
      );

      let translatedText = '';
      if (data && Array.isArray(data[0])) {
        translatedText = data[0]
          .map((chunk: any) => (chunk && chunk[0] ? chunk[0] : ''))
          .join('');
      }

      const detectedLang = data && data[2] ? String(data[2]) : sourceLang;

      return {
        originalText: trimmed,
        translatedText: translatedText.trim() || trimmed,
        detectedLanguage: detectedLang,
        targetLanguage: targetLang
      };
    } catch (err) {
      return {
        originalText: trimmed,
        translatedText: trimmed,
        detectedLanguage: sourceLang,
        targetLanguage: targetLang
      };
    }
  }
}
