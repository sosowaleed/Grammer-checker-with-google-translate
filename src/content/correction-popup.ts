import { GrammarCorrection } from '../shared/types';
import { ShadowRootHost } from './shadow-root';
import { TextReplacer } from './text-replacer';

export class CorrectionPopup {
  private static currentPopup: HTMLElement | null = null;
  private static dismissHandler: ((e: MouseEvent) => void) | null = null;
  private static keyHandler: ((e: KeyboardEvent) => void) | null = null;

  public static show(
    correction: GrammarCorrection,
    anchorEl: HTMLElement,
    targetInput: HTMLElement | null,
    onAccept: () => void
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
    const applyCorrection = () => {
      if (targetInput) {
        if (
          targetInput instanceof HTMLInputElement ||
          targetInput instanceof HTMLTextAreaElement
        ) {
          TextReplacer.replaceInInput(
            targetInput,
            correction.offset,
            correction.offset + correction.length,
            correction.corrected
          );
        } else if (targetInput.isContentEditable) {
          TextReplacer.replaceInContentEditable(
            targetInput,
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
    acceptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyCorrection();
    });

    // Ignore action
    const ignoreBtn = popup.querySelector('#polyglot-btn-ignore') as HTMLButtonElement;
    ignoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
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
        if (popup && !popup.contains(e.target as Node)) {
          this.close();
        }
      };
      window.addEventListener('mousedown', this.dismissHandler);
    }, 10);
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
