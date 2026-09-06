import { ShadowRootHost } from './shadow-root';
import { isEditableElement, isElementIgnored } from './tag-filter';
import { OverlayManager } from './overlay-manager';
import { SelectionPopup } from './selection-popup';
import { UserSettings, CheckTextResponse, DEFAULT_SETTINGS, ExtensionMessage } from '../shared/types';

import { sendRuntimeMessage } from '../shared/messaging';

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

    // 3. Fetch user settings asynchronously without blocking
    this.fetchSettings();
  }

  private async fetchSettings(): Promise<void> {
    try {
      const settings = await sendRuntimeMessage<UserSettings>({ type: 'GET_SETTINGS' });
      if (settings && typeof settings.enabled === 'boolean') {
        this.currentSettings = { ...DEFAULT_SETTINGS, ...settings };
        this.currentDetectedLanguage = this.currentSettings.preferredLanguage || 'en';
      }
    } catch {
      // Keep defaults
    }
  }

  private setupTypingObserver(): void {
    const handleInput = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || !isEditableElement(target)) return;

      this.activeElement = target;

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
          if (!this.activeElement || !document.contains(this.activeElement)) {
            this.overlayManager.clear();
          } else if (
            document.activeElement !== this.activeElement &&
            !this.activeElement.contains(document.activeElement)
          ) {
            this.overlayManager.clear();
          }
        }, 220);
      },
      { capture: true, passive: true }
    );
  }

  private getElementText(element: HTMLElement): string {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value;
    } else if (element.isContentEditable) {
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
        const sel = window.getSelection();
        if (!sel) return;

        // Check if selection anchor is within an ignored element
        const anchorNode = sel.anchorNode;
        const parent = anchorNode?.parentElement;
        if (parent && isElementIgnored(parent)) {
          return;
        }

        SelectionPopup.handleSelection(sel);
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
        const sel = window.getSelection();
        let rect: DOMRect;
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          rect = sel.getRangeAt(0).getBoundingClientRect();
        } else {
          rect = new DOMRect(window.innerWidth / 2 - 150, 100, 300, 50);
        }
        SelectionPopup.openCard(message.selectedText || '', rect, 'translate');
      } else if (message && message.type === 'SETTINGS_UPDATED') {
        this.fetchSettings();
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
