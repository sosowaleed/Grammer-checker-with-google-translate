export interface GrammarCorrection {
  original: string;
  corrected: string;
  offset: number;
  length: number;
  explanation?: string;
  type?: 'spelling' | 'grammar' | 'style';
}

export interface SynonymGroup {
  word: string;
  pos: string;
  terms: string[];
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  targetLanguage: string;
}

export interface UserSettings {
  enabled: boolean;
  preferredLanguage: string;
  autoCheckGrammar: boolean;
  ignoredDomains: string[];
  theme: 'dark' | 'light' | 'auto';
  debounceMs: number;
  stats: {
    wordsChecked: number;
    correctionsAccepted: number;
    translationsPerformed: number;
  };
}

export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  preferredLanguage: 'es',
  autoCheckGrammar: true,
  ignoredDomains: [],
  theme: 'dark',
  debounceMs: 450,
  stats: {
    wordsChecked: 0,
    correctionsAccepted: 0,
    translationsPerformed: 0
  }
};

// Message Actions
export type ExtensionMessage =
  | { type: 'CHECK_TEXT'; text: string; language?: string }
  | { type: 'GET_SYNONYMS'; word: string; language?: string }
  | { type: 'TRANSLATE_TEXT'; text: string; targetLang: string; sourceLang?: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<UserSettings> }
  | { type: 'RECORD_STAT'; stat: keyof UserSettings['stats']; count?: number }
  | { type: 'OPEN_TRANSLATE_POPUP'; selectedText: string };

export type CheckTextResponse = {
  corrections: GrammarCorrection[];
  detectedLanguage: string;
  error?: string;
};

export type SynonymsResponse = {
  word: string;
  synonyms: SynonymGroup[];
  detectedLanguage: string;
  error?: string;
};

export type TranslateResponse = {
  result: TranslationResult;
  error?: string;
};
