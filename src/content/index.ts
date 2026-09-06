import browser from 'webextension-polyfill';
import { ShadowRootHost } from './shadow-root';
import { isEditableElement, isElementIgnored } from './tag-filter';
import { OverlayManager } from './overlay-manager';
import { SelectionPopup } from './selection-popup';
import { UserSettings, CheckTextResponse } from '../shared/types';

class PolyglotContentScript {
  private overlayManager: OverlayManager;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentSettings: UserSettings | null = null;
  private activeElement: HTMLElement | null = null;

  constructor() {
    // Ensure Shadow DOM host is instantiated
    ShadowRootHost.getInstance();
    this.overlayManager = new OverlayManager();

    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.currentSettings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
    } catch {
      // fallback
    }

    // Check if current domain is ignored
    const host = window.location.hostname.toLowerCase();
    if (this.currentSettings?.ignoredDomains?.some((d) => host.includes(d.toLowerCase()))) {
      return;
    }

    this.setupTypingObserver();
    this.setupSelectionObserver();
    this.setupMessageListener();
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

    document.addEventListener('input', handleInput, { capture: true, passive: true });

    // Clear overlay on blur (unless focusing into popover)
    document.addEventListener(
      'focusout',
      (e) => {
        const related = e.relatedTarget as HTMLElement | null;
        if (related && related.closest('grammar-checker-root')) {
          return;
        }
        // Small delay in case user clicked an overlay marker
        setTimeout(() => {
          if (document.activeElement !== this.activeElement) {
            this.overlayManager.clear();
          }
        }, 200);
      },
      { capture: true, passive: true }
    );
  }

  private async checkElementText(element: HTMLElement): Promise<void> {
    if (!document.contains(element)) return;

    let text = '';
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      text = element.value;
    } else if (element.isContentEditable) {
      text = element.innerText || element.textContent || '';
    }

    if (!text.trim() || text.trim().length < 2) {
      this.overlayManager.clear();
      return;
    }

    try {
      const response: CheckTextResponse = await browser.runtime.sendMessage({
        type: 'CHECK_TEXT',
        text,
        language: this.currentSettings?.preferredLanguage || 'es'
      });

      if (response && Array.isArray(response.corrections)) {
        this.overlayManager.setCorrections(
          element,
          response.corrections,
          response.detectedLanguage
        );
      }
    } catch {
      // User rule: Silently back off without blocking user typing
    }
  }

  private setupSelectionObserver(): void {
    const handleSelectionChange = () => {
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
      }, 15);
    };

    document.addEventListener('mouseup', handleSelectionChange, { passive: true });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
        handleSelectionChange();
      }
    }, { passive: true });
  }

  private setupMessageListener(): void {
    browser.runtime.onMessage.addListener((message: any) => {
      if (message.type === 'OPEN_TRANSLATE_POPUP') {
        const sel = window.getSelection();
        let rect: DOMRect;
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          rect = sel.getRangeAt(0).getBoundingClientRect();
        } else {
          // Fallback to center screen
          rect = new DOMRect(window.innerWidth / 2 - 150, 100, 300, 50);
        }
        SelectionPopup.openCard(message.selectedText || '', rect, 'translate');
      }
    });
  }
}

// Instantiate content script
if (typeof window !== 'undefined') {
  new PolyglotContentScript();
}
