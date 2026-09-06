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
    const storageApi =
      typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local
        ? chrome.storage.local
        : browser.storage?.local;

    if (storageApi) {
      const data = await storageApi.get('polyglot_settings');
      if (data && data.polyglot_settings) {
        return { ...DEFAULT_SETTINGS, ...data.polyglot_settings };
      }
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
    const storageApi =
      typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local
        ? chrome.storage.local
        : browser.storage?.local;
    if (storageApi) {
      await storageApi.set({ polyglot_settings: updated });
    }
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
    const contextMenusApi =
      typeof chrome !== 'undefined' && chrome.contextMenus
        ? chrome.contextMenus
        : browser.contextMenus;

    if (!contextMenusApi) return;

    contextMenusApi.removeAll(() => {
      contextMenusApi.create({
        id: 'polyglot-translate-selection',
        title: 'Translate selection with PolyglotGrammar',
        contexts: ['selection']
      });
    });
  } catch {
    // Context menus may fail if permission is restricted or re-running
  }
}

// Context Menu Listener
if (typeof chrome !== 'undefined' && chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'polyglot-translate-selection' && info.selectionText && tab?.id) {
      try {
        chrome.tabs.sendMessage(tab.id, {
          type: 'OPEN_TRANSLATE_POPUP',
          selectedText: info.selectionText
        });
      } catch {}
    }
  });
} else if (typeof browser !== 'undefined' && browser.contextMenus?.onClicked) {
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'polyglot-translate-selection' && info.selectionText && tab?.id) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: 'OPEN_TRANSLATE_POPUP',
          selectedText: info.selectionText
        });
      } catch {}
    }
  });
}

// Core Message Handler
async function handleMessage(message: ExtensionMessage, sender: any): Promise<any> {
  if (!message || !message.type) return null;

  switch (message.type) {
    case 'CHECK_TEXT': {
      const text = message.text || '';
      if (!text.trim() || text.trim().length < 2) {
        return { corrections: [], detectedLanguage: 'en' } as CheckTextResponse;
      }

      const settings = await getStoredSettings();
      if (!settings.enabled || !settings.autoCheckGrammar) {
        return { corrections: [], detectedLanguage: 'en' } as CheckTextResponse;
      }

      // Dynamic language target:
      // When text is in English, cross-translating to 'es' triggers Google's query correction (dt=qc).
      // When text is non-English, cross-translating to 'en' triggers Google's query correction (dt=qc).
      // If language was explicitly passed, respect it, otherwise default to smart cross-language pair.
      const currentTarget = message.language || settings.preferredLanguage || 'en';
      const fallbackTarget = currentTarget === 'en' ? 'es' : 'en';
      const cacheKey = `${text.trim()}:${currentTarget}:${fallbackTarget}`;

      // Check LRU Cache first
      const cached = textCheckCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const result = await GoogleTranslateService.checkText(text, fallbackTarget);
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
          detectedLanguage: 'en',
          error: err?.message || 'Check failed'
        } as CheckTextResponse;
      }
    }

    case 'GET_SYNONYMS': {
      const word = (message.word || '').trim();
      if (!word) {
        return { word: '', synonyms: [], detectedLanguage: 'en' } as SynonymsResponse;
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
          detectedLanguage: 'en',
          error: err?.message || 'Lookup failed'
        } as SynonymsResponse;
      }
    }

    case 'TRANSLATE_TEXT': {
      const text = (message.text || '').trim();
      const targetLang = message.targetLang || 'es';
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

// Universal Message Listener (Chrome & Firefox compatible with async sendResponse)
const universalMessageListener = (
  message: ExtensionMessage,
  sender: any,
  sendResponse: (res?: any) => void
) => {
  handleMessage(message, sender)
    .then((result) => {
      try {
        sendResponse(result);
      } catch {}
    })
    .catch((err) => {
      try {
        sendResponse({ error: err?.message || 'Error processing request' });
      } catch {}
    });

  return true; // Keeps channel open in Chrome Service Worker!
};

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(universalMessageListener);
} else if (typeof browser !== 'undefined' && browser.runtime?.onMessage) {
  browser.runtime.onMessage.addListener(universalMessageListener);
}

// Lifecycle events
if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => setupContextMenus());
  chrome.runtime.onStartup?.addListener(() => setupContextMenus());
} else if (typeof browser !== 'undefined' && browser.runtime?.onInstalled) {
  browser.runtime.onInstalled.addListener(() => setupContextMenus());
  browser.runtime.onStartup?.addListener(() => setupContextMenus());
}

setupContextMenus();
