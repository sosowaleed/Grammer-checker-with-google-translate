import { GrammarCorrection, SynonymGroup, TranslationResult, WordDefinition } from '../shared/types';

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

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

/**
 * Resiliently find an anchor in originalText starting from startFrom,
 * handling whitespace variations (multiple spaces, tabs, newlines).
 */
export function findAnchor(
  text: string,
  anchor: string,
  startFrom: number
): { start: number; end: number } | null {
  if (!anchor) return { start: startFrom, end: startFrom };

  // 1. Exact match
  const exactIndex = text.indexOf(anchor, startFrom);
  if (exactIndex !== -1) {
    let end = exactIndex + anchor.length;
    if (/\s$/.test(anchor)) {
      while (end < text.length && /\s/.test(text[end])) end++;
    }
    return { start: exactIndex, end };
  }

  // 2. Whitespace-tolerant match
  const trimmedAnchor = anchor.trim();
  if (!trimmedAnchor) {
    const wsMatch = /^\s+/.exec(text.substring(startFrom));
    if (wsMatch) {
      return { start: startFrom, end: startFrom + wsMatch[0].length };
    }
    return { start: startFrom, end: startFrom };
  }

  const tokens = trimmedAnchor.split(/\s+/);
  const escapedTokens = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(escapedTokens.join('\\s+'), 'i');
  const match = pattern.exec(text.substring(startFrom));

  if (match) {
    const matchStart = startFrom + match.index;
    let matchEnd = matchStart + match[0].length;
    if (/\s$/.test(anchor)) {
      while (matchEnd < text.length && /\s/.test(text[matchEnd])) matchEnd++;
    }
    return { start: matchStart, end: matchEnd };
  }

  // 3. Fallback: match boundary tokens
  if (tokens.length > 1) {
    const lastToken = escapedTokens[escapedTokens.length - 1];
    const lastMatch = new RegExp('\\b' + lastToken + '\\b', 'i').exec(text.substring(startFrom));
    if (lastMatch) {
      const lastStart = startFrom + lastMatch.index;
      let lastEnd = lastStart + lastMatch[0].length;
      if (/\s$/.test(anchor)) {
        while (lastEnd < text.length && /\s/.test(text[lastEnd])) lastEnd++;
      }
      return { start: lastStart, end: lastEnd };
    }
  }

  return null;
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

  // Now align with originalText by processing groups of corrections bounded by non-whitespace anchors
  let originalPointer = 0;
  let i = 0;

  while (i < chunks.length) {
    const chunk = chunks[i];

    if (!chunk.isCorrected) {
      if (chunk.text.trim().length > 0) {
        const anchorMatch = findAnchor(originalText, chunk.text, originalPointer);
        if (anchorMatch) {
          originalPointer = anchorMatch.end;
        }
      }
      i++;
    } else {
      // Gather all consecutive corrected chunks (along with any whitespace-only uncorrected chunks between them)
      const correctionGroup: string[] = [];
      let j = i;
      while (j < chunks.length) {
        if (chunks[j].isCorrected) {
          const txt = chunks[j].text.trim();
          if (txt.length > 0) {
            correctionGroup.push(txt);
          }
          j++;
        } else if (chunks[j].text.trim().length === 0) {
          // Pure whitespace chunk between adjacent corrections
          j++;
        } else {
          // Found the next real anchor with non-whitespace text
          break;
        }
      }

      // Find where the next real anchor starts in originalText
      let endAnchorIndex = originalText.length;
      if (j < chunks.length && chunks[j].text.trim().length > 0) {
        const nextAnchorMatch = findAnchor(originalText, chunks[j].text, originalPointer);
        if (nextAnchorMatch) {
          endAnchorIndex = nextAnchorMatch.start;
        }
      }

      // Slice matching originalText span between previous and next real anchors
      const rawSpan = originalText.substring(originalPointer, endAnchorIndex);
      const origWords: { word: string; offset: number; length: number }[] = [];
      const wordRegex = /\S+/g;
      let wm: RegExpExecArray | null;
      while ((wm = wordRegex.exec(rawSpan)) !== null) {
        origWords.push({
          word: wm[0],
          offset: originalPointer + wm.index,
          length: wm[0].length
        });
      }

      if (correctionGroup.length === origWords.length) {
        // 1-to-1 match between original words and corrected words
        for (let k = 0; k < origWords.length; k++) {
          const orig = origWords[k];
          const rep = correctionGroup[k];
          if (orig.word !== rep) {
            corrections.push({
              original: orig.word,
              corrected: rep,
              offset: orig.offset,
              length: orig.length,
              explanation: determineExplanation(orig.word, rep),
              type: determineType(orig.word, rep)
            });
          }
        }
      } else if (correctionGroup.length === 1 && origWords.length > 1) {
        // 1 replacement word for multiple words: pick closest word by Levenshtein distance
        let bestWord = origWords[origWords.length - 1];
        let minD = Infinity;
        for (const w of origWords) {
          const dist = levenshtein(cleanWord(w.word), correctionGroup[0]);
          if (dist < minD) {
            minD = dist;
            bestWord = w;
          }
        }
        if (bestWord.word !== correctionGroup[0]) {
          corrections.push({
            original: bestWord.word,
            corrected: correctionGroup[0],
            offset: bestWord.offset,
            length: bestWord.length,
            explanation: determineExplanation(bestWord.word, correctionGroup[0]),
            type: determineType(bestWord.word, correctionGroup[0])
          });
        }
      } else if (correctionGroup.length > 1 && origWords.length === 1) {
        // Multiple replacement words for 1 original word (e.g. alot -> a lot)
        const combined = correctionGroup.join(' ');
        corrections.push({
          original: origWords[0].word,
          corrected: combined,
          offset: origWords[0].offset,
          length: origWords[0].length,
          explanation: determineExplanation(origWords[0].word, combined),
          type: determineType(origWords[0].word, combined)
        });
      } else {
        // General alignment using greedy/Levenshtein matching
        const used = new Set<number>();
        for (const rep of correctionGroup) {
          let bestIdx = -1;
          let minD = Infinity;
          for (let k = 0; k < origWords.length; k++) {
            if (used.has(k)) continue;
            const dist = levenshtein(cleanWord(origWords[k].word), rep);
            if (dist < minD) {
              minD = dist;
              bestIdx = k;
            }
          }
          if (bestIdx !== -1 && minD <= 4) {
            used.add(bestIdx);
            const orig = origWords[bestIdx];
            corrections.push({
              original: orig.word,
              corrected: rep,
              offset: orig.offset,
              length: orig.length,
              explanation: determineExplanation(orig.word, rep),
              type: determineType(orig.word, rep)
            });
          }
        }
      }

      originalPointer = endAnchorIndex;
      i = j;
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

  private static dictWordCache = new Map<string, boolean>();
  private static standaloneQcCache = new Map<string, string | null>();

  /**
   * Check whether a word exists in dictionary definitions (dt=bd)
   */
  public static async isDictionaryWord(word: string, lang: string = 'en'): Promise<boolean> {
    const clean = cleanWord(word).toLowerCase();
    if (!clean || clean.length < 2) return false;
    const cacheKey = `${lang}:${clean}`;
    if (this.dictWordCache.has(cacheKey)) {
      return this.dictWordCache.get(cacheKey)!;
    }

    try {
      const data = await this.requestWithFallback(
        (ep) => `${ep}&sl=${lang}&tl=es&dt=t&dt=bd&q=${encodeURIComponent(clean)}`
      );
      const hasDict = !!(data && data[1]);
      this.dictWordCache.set(cacheKey, hasDict);
      return hasDict;
    } catch {
      return false;
    }
  }

  /**
   * Fast language detection for context / text
   */
  public static async detectLanguage(text: string): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) return 'en';
    const encoded = encodeURIComponent(trimmed.slice(0, 300));
    try {
      const data = await this.requestWithFallback(
        (ep) => `${ep}&sl=auto&tl=en&dt=t&q=${encoded}`
      );
      if (data && data[2]) {
        return String(data[2]);
      }
    } catch {
      // Fallback
    }
    return 'en';
  }

  /**
   * Get query correction for a single word in isolation
   */
  public static async getStandaloneCorrection(word: string, lang: string = 'en'): Promise<string | null> {
    const clean = cleanWord(word);
    if (!clean || clean.length < 2) return null;
    const cacheKey = `${lang}:${clean.toLowerCase()}`;
    if (this.standaloneQcCache.has(cacheKey)) {
      return this.standaloneQcCache.get(cacheKey)!;
    }

    const altTarget = lang === 'en' ? 'es' : 'en';
    try {
      const data = await this.requestWithFallback(
        (ep) => `${ep}&sl=${lang}&tl=${altTarget}&dt=t&dt=qc&dt=bd&q=${encodeURIComponent(clean)}`
      );
      const qc = data && data[7];
      if (qc && Array.isArray(qc) && typeof qc[0] === 'string') {
        const match = /<b><i>([\s\S]*?)<\/i><\/b>/.exec(qc[0]);
        if (match) {
          const sugg = unescapeHtml(match[1]).trim();
          this.standaloneQcCache.set(cacheKey, sugg);
          return sugg;
        }
      }
      this.standaloneQcCache.set(cacheKey, null);
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Refine single-word suggestions if the suggested word is not a recognized dictionary word
   * (e.g. 'giva' for 'givea' -> refined to 'give')
   */
  public static async refineCorrections(
    corrections: GrammarCorrection[],
    detectedLang: string
  ): Promise<GrammarCorrection[]> {
    for (const c of corrections) {
      if (!c.original.includes(' ') && !c.corrected.includes(' ')) {
        try {
          const isCorrectedInDict = await this.isDictionaryWord(c.corrected, detectedLang);
          if (!isCorrectedInDict) {
            const standaloneSugg = await this.getStandaloneCorrection(c.original, detectedLang);
            if (
              standaloneSugg &&
              standaloneSugg.toLowerCase() !== c.original.toLowerCase() &&
              !standaloneSugg.includes(' ')
            ) {
              const isStandaloneInDict = await this.isDictionaryWord(standaloneSugg, detectedLang);
              if (isStandaloneInDict) {
                c.corrected = standaloneSugg;
                c.explanation = determineExplanation(c.original, c.corrected);
                c.type = determineType(c.original, c.corrected);
              }
            }
          }
        } catch {
          // Keep c as is
        }
      }
    }
    return corrections;
  }

  /**
   * Grammar and spell checking with intended/source language support
   */
  public static async checkText(
    text: string,
    targetLangFallback: string = 'es',
    sourceLang?: string
  ): Promise<{ corrections: GrammarCorrection[]; detectedLanguage: string }> {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 2) {
      return { corrections: [], detectedLanguage: sourceLang || 'auto' };
    }

    // Google Translate query correction works best when target language is different from source
    // When sourceLang is specified (e.g. 'en'), use sl=en to prevent false language detection
    const srcLang = sourceLang && sourceLang !== 'auto' ? sourceLang : 'auto';
    let targetLang = targetLangFallback;
    if (srcLang !== 'auto' && targetLang === srcLang) {
      targetLang = srcLang === 'en' ? 'es' : 'en';
    }
    const encoded = encodeURIComponent(text);

    try {
      const data = await this.requestWithFallback(
        (ep) => `${ep}&sl=${srcLang}&tl=${targetLang}&dt=t&dt=qc&dt=bd&q=${encoded}`
      );

      const detectedLang = srcLang !== 'auto' ? srcLang : (data && data[2] ? String(data[2]) : 'en');

      // If detected language happens to match targetLang, do a second query with 'en' (or 'es')
      let qcData = data && data[7];
      if (!qcData && detectedLang === targetLang) {
        const altTarget = targetLang === 'en' ? 'es' : 'en';
        try {
          const retryData = await this.requestWithFallback(
            (ep) => `${ep}&sl=${srcLang}&tl=${altTarget}&dt=t&dt=qc&q=${encoded}`
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
          if (corrections.length > 0) {
            corrections = await this.refineCorrections(corrections, detectedLang);
          }
        }
      }

      return {
        corrections,
        detectedLanguage: detectedLang
      };
    } catch (err) {
      // User rule: If an API request fails or is throttled, silently back off without blocking user typing
      return { corrections: [], detectedLanguage: sourceLang || 'auto' };
    }
  }

  /**
   * Synonym and definition extraction with Part of Speech
   */
  public static async getSynonyms(
    word: string,
    preferredLang: string = 'en'
  ): Promise<{ word: string; synonyms: SynonymGroup[]; definitions: WordDefinition[]; detectedLanguage: string }> {
    const clean = cleanWord(word);
    if (!clean) {
      return { word, synonyms: [], definitions: [], detectedLanguage: 'auto' };
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

      // 3. Check dt=md (definitions) at index 12
      const definitions: WordDefinition[] = [];
      const mdData = data && data[12];
      if (Array.isArray(mdData)) {
        for (const item of mdData) {
          if (Array.isArray(item) && item.length >= 2) {
            const pos = String(item[0] || 'general').toLowerCase();
            const defEntries = item[1];
            if (Array.isArray(defEntries)) {
              for (const entry of defEntries) {
                if (Array.isArray(entry) && typeof entry[0] === 'string') {
                  const gloss = entry[0].trim();
                  const example = typeof entry[2] === 'string' ? entry[2].trim() : undefined;
                  if (gloss) {
                    definitions.push({
                      pos,
                      gloss,
                      example
                    });
                  }
                }
              }
            }
          }
        }
      }

      return {
        word: clean,
        synonyms,
        definitions: definitions.slice(0, 6),
        detectedLanguage: detectedLang
      };
    } catch (err) {
      return { word: clean, synonyms: [], definitions: [], detectedLanguage: 'auto' };
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
