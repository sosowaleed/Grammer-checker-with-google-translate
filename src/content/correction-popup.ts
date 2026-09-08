import { GrammarCorrection } from '../shared/types';
import { ShadowRootHost } from './shadow-root';
import { TextReplacer } from './text-replacer';
import { sendRuntimeMessage } from '../shared/messaging';

export class CorrectionPopup {
  private static currentPopup: HTMLElement | null = null;
  private static dismissHandler: ((e: MouseEvent) => void) | null = null;
  private static keyHandler: ((e: KeyboardEvent) => void) | null = null;

  public static show(
    correction: GrammarCorrection,
    anchorEl: HTMLElement,
    targetInput: HTMLElement | null,
    onAccept: () => void,
    onIgnore?: () => void
  ): void {
    this.close();

    const host = ShadowRootHost.getInstance();
    const popup = document.createElement('div');
    popup.className = 'polyglot-popover on-top';

    const anchorRect = anchorEl.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Center horizontally on top of the word
    const wordCenterX = anchorRect.left + scrollX + anchorRect.width / 2;

    // Estimated height of popup ~95px
    const estimatedHeight = 96;
    const popupWidth = Math.min(280, Math.max(220, correction.corrected.length * 12 + 100));

    let top = anchorRect.top + scrollY - estimatedHeight - 8;
    let isAbove = true;

    // If near the top of the viewport, display below with upward arrow
    if (top < scrollY + 8) {
      top = anchorRect.bottom + scrollY + 8;
      isAbove = false;
      popup.className = 'polyglot-popover below';
    }

    let left = wordCenterX - popupWidth / 2;
    if (left < 10) left = 10;
    if (left + popupWidth > window.innerWidth - 10) {
      left = window.innerWidth - popupWidth - 10;
    }

    // Set position
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    popup.style.width = `${popupWidth}px`;

    // Arrow caret position relative to popup
    const arrowOffset = Math.max(16, Math.min(popupWidth - 16, wordCenterX - left));
    popup.style.setProperty('--arrow-left', `${arrowOffset}px`);

    popup.innerHTML = `
      <div class="polyglot-card-header" style="margin-bottom: 6px; padding-bottom: 5px;">
        <div class="polyglot-logo-wrap">
          <div class="polyglot-logo-dot"></div>
          <span style="font-size: 10px;">Suggestions</span>
        </div>
        <span class="polyglot-lang-tag">${correction.type === 'grammar' ? 'Grammar' : 'Spelling'}</span>
      </div>

      <div class="polyglot-correction-row" style="margin-bottom: 6px;">
        <span class="polyglot-typo-text">${correction.original}</span>
        <span class="polyglot-arrow">→</span>
        <button class="polyglot-suggest-btn" id="polyglot-btn-accept" title="Click to accept suggestion">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
          <span>${correction.corrected}</span>
        </button>
      </div>

      ${
        correction.explanation
          ? `<div class="polyglot-explanation" style="font-size: 10.5px; margin-bottom: 4px;">${correction.explanation}</div>`
          : ''
      }

      <div class="polyglot-card-actions" style="margin-top: 4px;">
        <button class="polyglot-btn-sm" id="polyglot-btn-ignore" title="Dismiss suggestion">Ignore</button>
      </div>
    `;

    // Accept action
    let applied = false;
    const applyCorrection = () => {
      if (applied) return;
      applied = true;

      const resolvedTarget =
        targetInput ||
        (anchorEl as any)?.__polyglotTarget ||
        (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
          ? document.activeElement
          : null);

      if (resolvedTarget) {
        if (
          resolvedTarget instanceof HTMLInputElement ||
          resolvedTarget instanceof HTMLTextAreaElement
        ) {
          TextReplacer.replaceInInput(
            resolvedTarget,
            correction.offset,
            correction.offset + correction.length,
            correction.corrected,
            correction.original
          );
        } else if (
          resolvedTarget.isContentEditable ||
          (resolvedTarget as HTMLElement).getAttribute('contenteditable') === 'true'
        ) {
          TextReplacer.replaceInContentEditable(
            resolvedTarget as HTMLElement,
            correction.offset,
            correction.offset + correction.length,
            correction.corrected
          );
        }
      }

      // Record stat safely
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: 'RECORD_STAT', stat: 'correctionsAccepted' });
        }
      } catch {}

      host.showToast(`Applied: "${correction.corrected}"`);
      this.close();
      onAccept();
    };

    const acceptBtn = popup.querySelector('#polyglot-btn-accept') as HTMLButtonElement;
    if (acceptBtn) {
      acceptBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        applyCorrection();
      });
      acceptBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        applyCorrection();
      });
    }

    // Ignore action
    const ignoreBtn = popup.querySelector('#polyglot-btn-ignore') as HTMLButtonElement;
    if (ignoreBtn) {
      let ignored = false;
      const handleIgnore = async (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
        if (ignored) return;
        ignored = true;
        try {
          await sendRuntimeMessage({
            type: 'IGNORE_WORD',
            word: correction.original
          });
        } catch {}
        host.showToast(`Ignored "${correction.original}"`);
        this.close();
        if (onIgnore) {
          onIgnore();
        }
      };

      ignoreBtn.addEventListener('mousedown', handleIgnore);
      ignoreBtn.addEventListener('click', handleIgnore);
    }

    popup.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    popup.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    host.popoverContainer.appendChild(popup);
    this.currentPopup = popup;

    // Keyboard support (Enter to apply, Esc to close)
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCorrection();
      } else if (e.key === 'Escape') {
        this.close();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    // Dismiss on click outside
    setTimeout(() => {
      this.dismissHandler = (e: MouseEvent) => {
        const path = e.composedPath ? e.composedPath() : [];
        if (
          popup &&
          !path.includes(popup) &&
          !path.includes(anchorEl) &&
          !popup.contains(e.target as Node)
        ) {
          this.close();
        }
      };
      window.addEventListener('mousedown', this.dismissHandler);
    }, 20);
  }

  /**
   * Show a list of all detected typos and their suggested corrections
   * when clicking the input status badge
   */
  public static showList(
    corrections: GrammarCorrection[],
    anchorEl: HTMLElement,
    targetInput: HTMLElement | null,
    onAcceptOne: (correction: GrammarCorrection) => void,
    onAcceptAll?: () => void
  ): void {
    this.close();

    if (!corrections || corrections.length === 0) return;

    const host = ShadowRootHost.getInstance();
    const popup = document.createElement('div');
    popup.className = 'polyglot-popover on-top';

    const anchorRect = anchorEl.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    const anchorCenterX = anchorRect.left + scrollX + anchorRect.width / 2;
    const popupWidth = 280;
    const estimatedHeight = Math.min(320, 80 + corrections.length * 40);

    let top = anchorRect.top + scrollY - estimatedHeight - 8;
    let isAbove = true;

    if (top < scrollY + 8) {
      top = anchorRect.bottom + scrollY + 8;
      isAbove = false;
      popup.className = 'polyglot-popover below';
    }

    let left = anchorCenterX - popupWidth / 2;
    if (left < 10) left = 10;
    if (left + popupWidth > window.innerWidth - 10) {
      left = window.innerWidth - popupWidth - 10;
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    popup.style.width = `${popupWidth}px`;

    const arrowOffset = Math.max(16, Math.min(popupWidth - 16, anchorCenterX - left));
    popup.style.setProperty('--arrow-left', `${arrowOffset}px`);

    popup.innerHTML = `
      <div class="polyglot-card-header" style="margin-bottom: 8px; padding-bottom: 6px;">
        <div class="polyglot-logo-wrap">
          <div class="polyglot-logo-dot"></div>
          <span style="font-size: 10px;">Detected Issues</span>
        </div>
        <span class="polyglot-lang-tag" id="polyglot-list-count">${corrections.length} ${corrections.length > 1 ? 'Issues' : 'Issue'}</span>
      </div>

      <div class="polyglot-fixes-list" id="polyglot-fixes-list-body" style="display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; padding-right: 2px;">
        ${corrections
          .map(
            (c, idx) => `
          <div class="polyglot-correction-row" data-item-idx="${idx}" style="margin-bottom: 0; justify-content: space-between; background: rgba(255, 255, 255, 0.04); padding: 5px 8px; border-radius: 6px;">
            <span class="polyglot-typo-text" style="max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.original}">${c.original}</span>
            <span class="polyglot-arrow">→</span>
            <button class="polyglot-suggest-btn polyglot-fix-item-btn" data-fix-idx="${idx}" title="Fix '${c.original}' → '${c.corrected}'">
              <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <span>${c.corrected}</span>
            </button>
          </div>
        `
          )
          .join('')}
      </div>

      <div class="polyglot-card-actions" style="margin-top: 8px; justify-content: space-between;">
        ${
          corrections.length > 1
            ? `
          <button class="polyglot-suggest-btn" id="polyglot-btn-fix-all" style="font-size: 11px; padding: 4px 8px;">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            <span>Fix All (${corrections.length})</span>
          </button>
        `
            : '<div></div>'
        }
        <button class="polyglot-btn-sm" id="polyglot-btn-close-list" title="Close">Close</button>
      </div>
    `;

    const applySingleCorrection = (c: GrammarCorrection) => {
      const resolvedTarget =
        targetInput ||
        (anchorEl as any)?.__polyglotTarget ||
        (document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
          ? document.activeElement
          : null);

      if (resolvedTarget) {
        if (
          resolvedTarget instanceof HTMLInputElement ||
          resolvedTarget instanceof HTMLTextAreaElement
        ) {
          TextReplacer.replaceInInput(
            resolvedTarget,
            c.offset,
            c.offset + c.length,
            c.corrected,
            c.original
          );
        } else if (
          resolvedTarget.isContentEditable ||
          (resolvedTarget as HTMLElement).getAttribute('contenteditable') === 'true'
        ) {
          TextReplacer.replaceInContentEditable(
            resolvedTarget as HTMLElement,
            c.offset,
            c.offset + c.length,
            c.corrected
          );
        }
      }

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: 'RECORD_STAT', stat: 'correctionsAccepted' });
        }
      } catch {}

      host.showToast(`Applied: "${c.corrected}"`);
      onAcceptOne(c);
    };

    popup.querySelectorAll('.polyglot-fix-item-btn').forEach((btn) => {
      const fixIdx = Number(btn.getAttribute('data-fix-idx'));
      const c = corrections[fixIdx];
      if (!c) return;

      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        applySingleCorrection(c);

        const row = popup.querySelector(`[data-item-idx="${fixIdx}"]`);
        row?.remove();

        const remainingRows = popup.querySelectorAll('.polyglot-correction-row');
        if (remainingRows.length === 0) {
          this.close();
        } else {
          const countBadge = popup.querySelector('#polyglot-list-count');
          if (countBadge) {
            countBadge.textContent = `${remainingRows.length} ${remainingRows.length > 1 ? 'Issues' : 'Issue'}`;
          }
          const fixAllBtn = popup.querySelector('#polyglot-btn-fix-all') as HTMLElement;
          if (fixAllBtn) {
            if (remainingRows.length > 1) {
              const span = fixAllBtn.querySelector('span');
              if (span) span.textContent = `Fix All (${remainingRows.length})`;
            } else {
              fixAllBtn.style.display = 'none';
            }
          }
        }
      });
    });

    const fixAllBtn = popup.querySelector('#polyglot-btn-fix-all');
    if (fixAllBtn) {
      fixAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Sort descending by offset to preserve text positions
        const sorted = [...corrections].sort((a, b) => b.offset - a.offset);
        for (const c of sorted) {
          applySingleCorrection(c);
        }

        host.showToast(`Applied all ${corrections.length} fixes!`);
        this.close();
        if (onAcceptAll) {
          onAcceptAll();
        }
      });
    }

    const closeBtn = popup.querySelector('#polyglot-btn-close-list');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.close();
      });
    }

    popup.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    popup.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    host.popoverContainer.appendChild(popup);
    this.currentPopup = popup;

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    setTimeout(() => {
      this.dismissHandler = (e: MouseEvent) => {
        const path = e.composedPath ? e.composedPath() : [];
        if (
          popup &&
          !path.includes(popup) &&
          !path.includes(anchorEl) &&
          !popup.contains(e.target as Node)
        ) {
          this.close();
        }
      };
      window.addEventListener('mousedown', this.dismissHandler);
    }, 20);
  }

  public static isOpen(): boolean {
    return this.currentPopup !== null;
  }

  public static close(): void {
    if (this.currentPopup) {
      this.currentPopup.remove();
      this.currentPopup = null;
    }
    if (this.dismissHandler) {
      window.removeEventListener('mousedown', this.dismissHandler);
      this.dismissHandler = null;
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }
}
