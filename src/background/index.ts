import browser from 'webextension-polyfill';
import { GoogleTranslateService } from './google-translate';
import { LRUCache } from './lru-cache';
import {
  ExtensionMessage,
  DEFAULT_SETTINGS,
  UserSettings,
  CheckTextResponse,
  SynonymsResponse,
  TranslateResponse
} from '../shared/types';

// Caches
const textCheckCache = new LRUCache<CheckTextResponse>(250, 'polyglot_text_checks');
const synonymsCache = new LRUCache<SynonymsResponse>(300, 'polyglot_synonyms');
const translationCache = new LRUCache<TranslateResponse>(300, 'polyglot_translations');

// Helpers for Settings
async function getStoredSettings(): Promise<UserSettings> {
  try {
    const data = await browser.storage.local.get('polyglot_settings');
    if (data && data.polyglot_settings) {
      return { ...DEFAULT_SETTINGS, ...data.polyglot_settings };
    }
  } catch {
    // fallback to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

async function updateStoredSettings(newSettings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getStoredSettings();
  const updated: UserSettings = {
    ...current,
    ...newSettings,
    stats: {
      ...current.stats,
      ...(newSettings.stats || {})
    }
  };
  try {
    await browser.storage.local.set({ polyglot_settings: updated });
  } catch {
    // ignore storage errors
  }
  return updated;
}

async function recordStat(stat: keyof UserSettings['stats'], count: number = 1): Promise<void> {
  try {
    const current = await getStoredSettings();
    const updatedStats = {
      ...current.stats,
      [stat]: (current.stats[stat] || 0) + count
    };
    await updateStoredSettings({ stats: updatedStats });
  } catch {
    // ignore
  }
}

// Setup Context Menus
function setupContextMenus(): void {
  try {
    browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({
        id: 'polyglot-translate-selection',
        title: 'Translate selection with PolyglotGrammar',
        contexts: ['selection']
      });
    }).catch(() => {});
  } catch {
    // Context menus may fail if permission is restricted or re-running
  }
}

// Context Menu Listener
if (typeof browser !== 'undefined' && browser.contextMenus) {
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'polyglot-translate-selection' && info.selectionText && tab && tab.id) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: 'OPEN_TRANSLATE_POPUP',
          selectedText: info.selectionText
        });
      } catch {
        // Tab may not have content script loaded
      }
    }
  });
}

// Runtime Message Listener
browser.runtime.onMessage.addListener((message: ExtensionMessage, sender): Promise<any> => {
  return handleMessage(message, sender);
});

async function handleMessage(message: ExtensionMessage, sender: any): Promise<any> {
  if (!message || !message.type) return null;

  switch (message.type) {
    case 'CHECK_TEXT': {
      const text = message.text || '';
      if (!text.trim() || text.trim().length < 2) {
        return { corrections: [], detectedLanguage: 'auto' } as CheckTextResponse;
      }

      const settings = await getStoredSettings();
      if (!settings.enabled || !settings.autoCheckGrammar) {
        return { corrections: [], detectedLanguage: 'auto' } as CheckTextResponse;
      }

      const fallbackLang = message.language || settings.preferredLanguage || 'es';
      const cacheKey = `${text.trim()}:${fallbackLang}`;

      // Check LRU Cache first
      const cached = textCheckCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const result = await GoogleTranslateService.checkText(text, fallbackLang);
        const response: CheckTextResponse = {
          corrections: result.corrections,
          detectedLanguage: result.detectedLanguage
        };
        textCheckCache.set(cacheKey, response);

        // Record checked words
        const wordCount = text.trim().split(/\s+/).length;
        recordStat('wordsChecked', wordCount);

        return response;
      } catch (err: any) {
        return {
          corrections: [],
          detectedLanguage: 'auto',
          error: err?.message || 'Check failed'
        } as CheckTextResponse;
      }
    }

    case 'GET_SYNONYMS': {
      const word = (message.word || '').trim();
      if (!word) {
        return { word: '', synonyms: [], detectedLanguage: 'auto' } as SynonymsResponse;
      }

      const settings = await getStoredSettings();
      const targetLang = message.language || settings.preferredLanguage || 'en';
      const cacheKey = `${word.toLowerCase()}:${targetLang}`;

      // Check LRU Cache
      const cached = synonymsCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const result = await GoogleTranslateService.getSynonyms(word, targetLang);
        const response: SynonymsResponse = {
          word: result.word,
          synonyms: result.synonyms,
          detectedLanguage: result.detectedLanguage
        };
        synonymsCache.set(cacheKey, response);
        return response;
      } catch (err: any) {
        return {
          word,
          synonyms: [],
          detectedLanguage: 'auto',
          error: err?.message || 'Lookup failed'
        } as SynonymsResponse;
      }
    }

    case 'TRANSLATE_TEXT': {
      const text = (message.text || '').trim();
      const targetLang = message.targetLang || 'en';
      const sourceLang = message.sourceLang || 'auto';

      if (!text) {
        return {
          result: {
            originalText: '',
            translatedText: '',
            detectedLanguage: sourceLang,
            targetLanguage: targetLang
          }
        } as TranslateResponse;
      }

      const cacheKey = `${text}:${sourceLang}:${targetLang}`;
      const cached = translationCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const result = await GoogleTranslateService.translateText(text, targetLang, sourceLang);
        const response: TranslateResponse = { result };
        translationCache.set(cacheKey, response);
        recordStat('translationsPerformed', 1);
        return response;
      } catch (err: any) {
        return {
          result: {
            originalText: text,
            translatedText: text,
            detectedLanguage: sourceLang,
            targetLanguage: targetLang
          },
          error: err?.message || 'Translation failed'
        } as TranslateResponse;
      }
    }

    case 'GET_SETTINGS': {
      return await getStoredSettings();
    }

    case 'UPDATE_SETTINGS': {
      return await updateStoredSettings(message.settings);
    }

    case 'RECORD_STAT': {
      await recordStat(message.stat, message.count || 1);
      return { success: true };
    }

    default:
      return null;
  }
}

// Lifecycle events
browser.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

browser.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

setupContextMenus();
