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

export interface WordDefinition {
  pos: string;
  gloss: string;
  example?: string;
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
  uiLanguage: string;
  autoCheckGrammar: boolean;
  autoPopupOnHighlight: boolean;
  autoPopupOnHover: boolean;
  ignoredDomains: string[];
  ignoredWords: string[];
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
  preferredLanguage: 'en',
  uiLanguage: 'en',
  autoCheckGrammar: true,
  autoPopupOnHighlight: false,
  autoPopupOnHover: true,
  ignoredDomains: [],
  ignoredWords: [],
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
  | {
      type: 'CHECK_TEXT';
      text: string;
      language?: string;
      intendedLanguage?: string;
      contextBefore?: string;
    }
  | { type: 'DETECT_LANGUAGE'; text: string }
  | { type: 'GET_SYNONYMS'; word: string; language?: string }
  | { type: 'TRANSLATE_TEXT'; text: string; targetLang: string; sourceLang?: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<UserSettings> }
  | { type: 'IGNORE_WORD'; word: string }
  | { type: 'UNIGNORE_WORD'; word: string }
  | { type: 'RECORD_STAT'; stat: keyof UserSettings['stats']; count?: number }
  | { type: 'OPEN_TRANSLATE_POPUP'; selectedText: string }
  | { type: 'PING' };

export type CheckTextResponse = {
  corrections: GrammarCorrection[];
  detectedLanguage: string;
  intendedLanguage?: string;
  inferredFromContext?: boolean;
  error?: string;
};

export type SynonymsResponse = {
  word: string;
  synonyms: SynonymGroup[];
  definitions?: WordDefinition[];
  detectedLanguage: string;
  error?: string;
};

export type TranslateResponse = {
  result: TranslationResult;
  error?: string;
};
