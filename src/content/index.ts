import { ShadowRootHost } from './shadow-root';
import { isEditableElement, isElementIgnored } from './tag-filter';
import { OverlayManager } from './overlay-manager';
import { SelectionPopup } from './selection-popup';
import { CorrectionPopup } from './correction-popup';
import { UserSettings, CheckTextResponse, DEFAULT_SETTINGS, ExtensionMessage } from '../shared/types';

import { sendRuntimeMessage, KeepAliveManager } from '../shared/messaging';

class PolyglotContentScript {
  private overlayManager: OverlayManager;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentSettings: UserSettings = { ...DEFAULT_SETTINGS };
  private activeElement: HTMLElement | null = null;
  private currentDetectedLanguage: string = 'en';
  private checkRequestId: number = 0;

  constructor() {
    // 1. Instantiate Shadow Root host immediately
    ShadowRootHost.getInstance();
    this.overlayManager = new OverlayManager();

    // 2. Setup listeners immediately (synchronously, zero delay)
    this.setupTypingObserver();
    this.setupSelectionObserver();
    this.setupMessageListener();
    this.setupStorageObserver();

    // 3. Fetch user settings asynchronously without blocking
    this.fetchSettings();
  }

  private async fetchSettings(): Promise<void> {
    try {
      const settings = await sendRuntimeMessage<UserSettings>({ type: 'GET_SETTINGS' });
      if (settings && typeof settings.enabled === 'boolean') {
        this.currentSettings = { ...DEFAULT_SETTINGS, ...settings };
        this.currentDetectedLanguage = this.currentSettings.preferredLanguage || 'en';
        this.overlayManager.setAutoPopupHover(this.currentSettings.autoPopupOnHover !== false);
      }
    } catch {
      // Keep defaults
    }
  }

  private setupStorageObserver(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if ((areaName === 'local' || areaName === 'sync') && changes.polyglot_settings) {
          const newSettings = changes.polyglot_settings.newValue;
          if (newSettings) {
            this.currentSettings = { ...DEFAULT_SETTINGS, ...newSettings };
            this.currentDetectedLanguage = this.currentSettings.preferredLanguage || 'en';
            this.overlayManager.setAutoPopupHover(this.currentSettings.autoPopupOnHover !== false);
          }
        }
      });
    }
  }

  private setupTypingObserver(): void {
    const handleInput = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || !isEditableElement(target)) return;

      this.activeElement = target;
      KeepAliveManager.activate();

      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      const debounceDelay = this.currentSettings?.debounceMs || 450;

      this.debounceTimer = setTimeout(() => {
        this.checkElementText(target);
      }, debounceDelay);
    };

    // Attach to input events
    document.addEventListener('input', handleInput, { capture: true, passive: true });

    // Also check on focus if field already has content
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && isEditableElement(target)) {
        this.activeElement = target;
        KeepAliveManager.activate();
        const text = this.getElementText(target);
        if (text.trim().length >= 2) {
          setTimeout(() => this.checkElementText(target), 150);
        }
      }
    }, { capture: true, passive: true });

    // Clear overlay on blur (unless clicking into suggestion popup or within active element)
    document.addEventListener(
      'focusout',
      (e) => {
        const related = e.relatedTarget as HTMLElement | null;
        if (related && related.closest('grammar-checker-root')) {
          return;
        }
        setTimeout(() => {
          if (CorrectionPopup.isOpen()) {
            return;
          }
          if (!this.activeElement || !document.contains(this.activeElement)) {
            this.overlayManager.clear();
            this.activeElement = null;
          } else if (
            document.activeElement !== this.activeElement &&
            !this.activeElement.contains(document.activeElement)
          ) {
            this.overlayManager.clear();
            this.activeElement = null;
          }
        }, 220);
      },
      { capture: true, passive: true }
    );
  }

  private getElementText(element: HTMLElement): string {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value;
    } else if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
      return element.innerText || element.textContent || '';
    } else if (
      element.getAttribute('role') === 'textbox' ||
      element.getAttribute('role') === 'searchbox'
    ) {
      return element.innerText || element.textContent || '';
    }
    return '';
  }

  private async checkElementText(element: HTMLElement): Promise<void> {
    if (!document.contains(element)) return;

    // Check if domain is ignored
    const host = window.location.hostname.toLowerCase();
    if (this.currentSettings?.ignoredDomains?.some((d) => host.includes(d.toLowerCase()))) {
      this.overlayManager.clear();
      return;
    }

    const text = this.getElementText(element);
    if (!text.trim() || text.trim().length < 2) {
      this.overlayManager.clear();
      return;
    }

    const requestId = ++this.checkRequestId;

    try {
      const response = await sendRuntimeMessage<CheckTextResponse>({
        type: 'CHECK_TEXT',
        text,
        language: this.currentDetectedLanguage || this.currentSettings.preferredLanguage || 'en'
      });

      // Discard stale out-of-order responses from earlier keystrokes
      if (requestId !== this.checkRequestId) {
        return;
      }

      if (response && Array.isArray(response.corrections)) {
        // Dynamically adapt language based on what user is typing (if confirmed and recognized)
        if (
          response.detectedLanguage &&
          response.detectedLanguage !== 'auto' &&
          response.detectedLanguage !== 'und' &&
          text.trim().length >= 6
        ) {
          this.currentDetectedLanguage = response.detectedLanguage;
        }

        // Filter out locally ignored words immediately
        const ignored = new Set(
          (this.currentSettings.ignoredWords || []).map((w) => w.toLowerCase().trim())
        );
        const filteredCorrections = response.corrections.filter(
          (c) => !ignored.has(c.original.toLowerCase().trim())
        );

        this.overlayManager.setCorrections(
          element,
          filteredCorrections,
          this.currentDetectedLanguage
        );
      }
    } catch {
      // Silently back off without breaking future checks
    }
  }

  private setupSelectionObserver(): void {
    const handleSelectionChange = (e?: Event) => {
      // If the interaction originated inside grammar-checker-root (e.g. clicking Synonyms tab), ignore
      if (e && 'composedPath' in e) {
        const path = e.composedPath();
        const host = ShadowRootHost.getInstance();
        if (path.includes(host.rootElement)) {
          return;
        }
      }

      setTimeout(() => {
        const autoPopup = Boolean(this.currentSettings?.autoPopupOnHighlight);

        // 1. Form control selection check (crucial for Firefox where window.getSelection is empty for inputs/textareas)
        const activeEl = document.activeElement;
        if (
          activeEl &&
          (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) &&
          !isElementIgnored(activeEl)
        ) {
          const start = activeEl.selectionStart;
          const end = activeEl.selectionEnd;
          if (start !== null && end !== null && end > start) {
            const rawSelected = activeEl.value.substring(start, end);
            if (rawSelected.trim().length > 0) {
              SelectionPopup.handleInputSelection(activeEl, rawSelected, start, end, autoPopup);
              return;
            }
          }
        }

        // 2. Window DOM selection (contenteditable and regular page text)
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          if (!activeEl || !(activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement)) {
            SelectionPopup.close();
          }
          return;
        }

        // Check if selection anchor is within an ignored element
        const anchorNode = sel.anchorNode;
        const parent = anchorNode?.parentElement;
        if (parent && isElementIgnored(parent)) {
          return;
        }

        SelectionPopup.handleSelection(sel, autoPopup);
      }, 20);
    };

    document.addEventListener('mouseup', (e) => handleSelectionChange(e), { passive: true });
    document.addEventListener(
      'keyup',
      (e) => {
        // Safe check for e.key to prevent Uncaught TypeError on undefined
        if (typeof e.key === 'string' && (e.key === 'Shift' || e.key.startsWith('Arrow'))) {
          handleSelectionChange(e);
        }
      },
      { passive: true }
    );
  }

  private setupMessageListener(): void {
    const messageHandler = (message: any) => {
      if (message && message.type === 'OPEN_TRANSLATE_POPUP') {
        let rect: DOMRect | null = null;

        // Check active form control first
        const activeEl = document.activeElement;
        if (activeEl && (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement)) {
          const inputRect = activeEl.getBoundingClientRect();
          rect = new DOMRect(inputRect.left + 20, inputRect.top, 200, 30);
        } else {
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
            rect = sel.getRangeAt(0).getBoundingClientRect();
          }
        }

        if (!rect) {
          rect = new DOMRect(window.innerWidth / 2 - 150, 100, 300, 50);
        }
        SelectionPopup.openCard(message.selectedText || '', rect, 'translate');
      } else if (message && message.type === 'SETTINGS_UPDATED') {
        if (message.settings) {
          this.currentSettings = { ...DEFAULT_SETTINGS, ...message.settings };
          this.currentDetectedLanguage = this.currentSettings.preferredLanguage || 'en';
          this.overlayManager.setAutoPopupHover(this.currentSettings.autoPopupOnHover !== false);
        } else {
          this.fetchSettings();
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(messageHandler);
    } else if (typeof (window as any).browser !== 'undefined' && (window as any).browser?.runtime?.onMessage) {
      (window as any).browser.runtime.onMessage.addListener(messageHandler);
    }
  }
}

// Auto-instantiate
if (typeof window !== 'undefined') {
  new PolyglotContentScript();
}
