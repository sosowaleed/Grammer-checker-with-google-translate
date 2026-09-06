import browser from 'webextension-polyfill';
import { GrammarCorrection } from '../shared/types';
import { ShadowRootHost } from './shadow-root';
import { TextReplacer } from './text-replacer';

export class CorrectionPopup {
  private static currentPopup: HTMLElement | null = null;
  private static dismissHandler: ((e: MouseEvent) => void) | null = null;

  public static show(
    correction: GrammarCorrection,
    anchorEl: HTMLElement,
    targetInput: HTMLElement | null,
    onAccept: () => void
  ): void {
    this.close();

    const host = ShadowRootHost.getInstance();
    const popup = document.createElement('div');
    popup.className = 'polyglot-popover';

    const anchorRect = anchorEl.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Calculate position: prefer above anchor, fallback to below
    let top = anchorRect.top + scrollY - 110;
    if (top < scrollY + 10) {
      top = anchorRect.bottom + scrollY + 8;
    }
    const left = Math.max(10, Math.min(window.innerWidth - 300, anchorRect.left + scrollX - 20));

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    popup.innerHTML = `
      <div class="polyglot-card-header">
        <div class="polyglot-logo-wrap">
          <div class="polyglot-logo-dot"></div>
          <span>Polyglot Grammar</span>
        </div>
        <span class="polyglot-lang-tag">${correction.type?.toUpperCase() || 'SUGGESTION'}</span>
      </div>

      <div class="polyglot-correction-row">
        <span class="polyglot-typo-text">${correction.original}</span>
        <span class="polyglot-arrow">→</span>
        <button class="polyglot-suggest-btn" id="polyglot-btn-accept">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
          <span>${correction.corrected}</span>
        </button>
      </div>

      ${
        correction.explanation
          ? `<div class="polyglot-explanation">${correction.explanation}</div>`
          : ''
      }

      <div class="polyglot-card-actions">
        <button class="polyglot-btn-sm" id="polyglot-btn-ignore">Ignore</button>
      </div>
    `;

    // Accept button listener
    const acceptBtn = popup.querySelector('#polyglot-btn-accept') as HTMLButtonElement;
    acceptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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

      // Record stat
      try {
        browser.runtime.sendMessage({ type: 'RECORD_STAT', stat: 'correctionsAccepted' });
      } catch {}

      host.showToast(`Applied: "${correction.corrected}"`);
      this.close();
      onAccept();
    });

    // Ignore button listener
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

    // Dismiss on click outside or escape
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
  }
}
