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

// In-memory cache for settings to prevent storage quota exhaustion
let cachedSettings: UserSettings | null = null;
let pendingStatSaveTimer: ReturnType<typeof setTimeout> | null = null;

// Helpers for Settings
async function getStoredSettings(): Promise<UserSettings> {
  if (cachedSettings) {
    return cachedSettings;
  }
  try {
    const storageApi =
      typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local
        ? chrome.storage.local
        : browser.storage?.local;

    if (storageApi) {
      const data = await storageApi.get('polyglot_settings');
      if (data && data.polyglot_settings) {
        const loaded: UserSettings = {
          ...DEFAULT_SETTINGS,
          ...data.polyglot_settings,
          ignoredWords: Array.isArray(data.polyglot_settings.ignoredWords)
            ? data.polyglot_settings.ignoredWords
            : []
        };
        cachedSettings = loaded;
        return loaded;
      }
    }
  } catch {
    // fallback to defaults
  }
  const fallback: UserSettings = { ...DEFAULT_SETTINGS };
  cachedSettings = fallback;
  return fallback;
}

async function updateStoredSettings(newSettings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getStoredSettings();
  const updated: UserSettings = {
    ...current,
    ...newSettings,
    ignoredWords: Array.isArray(newSettings.ignoredWords)
      ? newSettings.ignoredWords
      : current.ignoredWords || [],
    stats: {
      ...current.stats,
      ...(newSettings.stats || {})
    }
  };
  cachedSettings = updated;
  try {
    const storageApi =
      typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local
        ? chrome.storage.local
        : browser.storage?.local;
    if (storageApi) {
      await storageApi.set({ polyglot_settings: updated });
    }
    // Broadcast updated settings to all tabs
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings: updated }).catch(() => {});
          }
        }
      });
    }
  } catch {
    // ignore storage errors
  }
  return updated;
}

// Debounce stats persistence to prevent hitting browser storage write limits while typing
async function recordStat(stat: keyof UserSettings['stats'], count: number = 1): Promise<void> {
  const current = await getStoredSettings();
  current.stats = {
    ...current.stats,
    [stat]: (current.stats[stat] || 0) + count
  };
  cachedSettings = current;

  if (pendingStatSaveTimer) {
    clearTimeout(pendingStatSaveTimer);
  }
  pendingStatSaveTimer = setTimeout(async () => {
    try {
      const storageApi =
        typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local
          ? chrome.storage.local
          : browser.storage?.local;
      if (storageApi && cachedSettings) {
        await storageApi.set({ polyglot_settings: cachedSettings });
      }
    } catch {}
  }, 4000);
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
        title: 'Check spelling & translate with PolyglotGrammar',
        contexts: ['selection']
      });
    });
  } catch {
    // Context menus may fail if permission is restricted or re-running
  }
}

// Dynamic Service Worker Keep-Alive Port Manager
const activeKeepAlivePorts = new Set<any>();

const setupKeepAlivePortListener = (port: any) => {
  if (port && port.name === 'polyglot-keepalive') {
    activeKeepAlivePorts.add(port);
    port.onDisconnect?.addListener(() => {
      activeKeepAlivePorts.delete(port);
    });
    port.onMessage?.addListener((msg: any) => {
      if (msg && msg.type === 'PING') {
        try {
          port.postMessage({ type: 'PONG', timestamp: Date.now() });
        } catch {}
      }
    });
  }
};

if (typeof chrome !== 'undefined' && chrome.runtime?.onConnect) {
  chrome.runtime.onConnect.addListener(setupKeepAlivePortListener);
} else if (typeof browser !== 'undefined' && browser.runtime?.onConnect) {
  browser.runtime.onConnect.addListener(setupKeepAlivePortListener);
}

// Safe Context Menu Message Sender with dynamic injection fallback
async function sendTranslateCommandToTab(tabId: number, selectedText: string): Promise<void> {
  const payload = {
    type: 'OPEN_TRANSLATE_POPUP',
    selectedText
  };

  if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
    try {
      await chrome.tabs.sendMessage(tabId, payload).catch(async () => {
        // Content script might not be injected yet (e.g. extension reloaded). Inject dynamically.
        if (chrome.scripting && tabId) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content.js']
            });
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, payload).catch(() => {});
            }, 120);
          } catch {}
        }
      });
    } catch {}
    return;
  }

  if (typeof browser !== 'undefined' && browser.tabs?.sendMessage) {
    try {
      await browser.tabs.sendMessage(tabId, payload).catch(() => {});
    } catch {}
  }
}

// Context Menu Listener
if (typeof chrome !== 'undefined' && chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'polyglot-translate-selection' && info.selectionText && tab?.id) {
      sendTranslateCommandToTab(tab.id, info.selectionText);
    }
  });
} else if (typeof browser !== 'undefined' && browser.contextMenus?.onClicked) {
  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'polyglot-translate-selection' && info.selectionText && tab?.id) {
      sendTranslateCommandToTab(tab.id, info.selectionText);
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

      // Determine intended language:
      // 1. Explicitly selected intendedLanguage
      // 2. Infer from previous words (contextBefore)
      // 3. Default to user's preferred language (default 'en')
      let intendedLang = message.intendedLanguage;
      let inferredFromContext = false;

      if (!intendedLang || intendedLang === 'auto') {
        const context = (message.contextBefore || '').trim();
        if (context.length >= 2) {
          try {
            const detectedContextLang = await GoogleTranslateService.detectLanguage(context);
            if (detectedContextLang && detectedContextLang !== 'auto') {
              intendedLang = detectedContextLang;
              inferredFromContext = true;
            }
          } catch {}
        }
      }

      if (!intendedLang || intendedLang === 'auto') {
        intendedLang = settings.preferredLanguage || 'en';
      }

      const fallbackTarget = intendedLang === 'en' ? 'es' : 'en';
      const ignoredSet = new Set((settings.ignoredWords || []).map((w) => w.trim().toLowerCase()));
      const cacheKey = `${text.trim()}:${intendedLang}:${fallbackTarget}:${settings.ignoredWords?.join(',')}`;

      // Check LRU Cache first
      const cached = textCheckCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        let result = await GoogleTranslateService.checkText(text, fallbackTarget, intendedLang);

        // Fallback retry with opposite language if 0 corrections found
        if (result.corrections.length === 0) {
          const altTarget = fallbackTarget === 'en' ? 'es' : 'en';
          try {
            const altResult = await GoogleTranslateService.checkText(text, altTarget, intendedLang);
            if (altResult.corrections.length > 0) {
              result = altResult;
            }
          } catch {}
        }

        // Filter out ignored words
        const filteredCorrections = result.corrections.filter(
          (c) => !ignoredSet.has(c.original.trim().toLowerCase())
        );

        const response: CheckTextResponse = {
          corrections: filteredCorrections,
          detectedLanguage: result.detectedLanguage,
          intendedLanguage: intendedLang,
          inferredFromContext
        };
        textCheckCache.set(cacheKey, response);

        // Record checked words
        const wordCount = text.trim().split(/\s+/).length;
        recordStat('wordsChecked', wordCount);

        return response;
      } catch (err: any) {
        return {
          corrections: [],
          detectedLanguage: intendedLang || 'en',
          intendedLanguage: intendedLang,
          error: err?.message || 'Check failed'
        } as CheckTextResponse;
      }
    }

    case 'DETECT_LANGUAGE': {
      const detected = await GoogleTranslateService.detectLanguage(message.text || '');
      return { detectedLanguage: detected };
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
          synonyms: result.synonyms || [],
          definitions: result.definitions || [],
          detectedLanguage: result.detectedLanguage || 'en'
        };
        synonymsCache.set(cacheKey, response);
        return response;
      } catch (err: any) {
        return {
          word,
          synonyms: [],
          definitions: [],
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
      textCheckCache.clear();
      return await updateStoredSettings(message.settings);
    }

    case 'IGNORE_WORD': {
      const word = (message.word || '').trim().toLowerCase();
      if (!word) return { success: false };
      const current = await getStoredSettings();
      const list = current.ignoredWords || [];
      if (!list.map((w) => w.toLowerCase()).includes(word)) {
        const updated = await updateStoredSettings({
          ignoredWords: [...list, word]
        });
        textCheckCache.clear();
        return { success: true, ignoredWords: updated.ignoredWords };
      }
      return { success: true, ignoredWords: list };
    }

    case 'UNIGNORE_WORD': {
      const word = (message.word || '').trim().toLowerCase();
      const current = await getStoredSettings();
      const list = (current.ignoredWords || []).filter((w) => w.toLowerCase() !== word);
      const updated = await updateStoredSettings({ ignoredWords: list });
      textCheckCache.clear();
      return { success: true, ignoredWords: updated.ignoredWords };
    }

    case 'RECORD_STAT': {
      await recordStat(message.stat, message.count || 1);
      return { success: true };
    }

    case 'PING': {
      return { pong: true, timestamp: Date.now(), activePorts: activeKeepAlivePorts.size };
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
): true => {
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
