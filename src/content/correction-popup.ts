import { GrammarCorrection } from '../shared/types';
import { ShadowRootHost } from './shadow-root';
import { TextReplacer } from './text-replacer';
import { sendRuntimeMessage } from '../shared/messaging';

function createCheckSvg(width = 12, height = 12): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill-rule', 'evenodd');
  path.setAttribute('d', 'M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z');
  path.setAttribute('clip-rule', 'evenodd');
  svg.appendChild(path);
  return svg;
}

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

    popup.replaceChildren();

    // Header
    const header = document.createElement('div');
    header.className = 'polyglot-card-header';
    header.style.marginBottom = '6px';
    header.style.paddingBottom = '5px';

    const logoWrap = document.createElement('div');
    logoWrap.className = 'polyglot-logo-wrap';
    const logoDot = document.createElement('div');
    logoDot.className = 'polyglot-logo-dot';
    const logoTitle = document.createElement('span');
    logoTitle.style.fontSize = '10px';
    logoTitle.textContent = 'Suggestions';
    logoWrap.appendChild(logoDot);
    logoWrap.appendChild(logoTitle);

    const langTag = document.createElement('span');
    langTag.className = 'polyglot-lang-tag';
    langTag.textContent = correction.type === 'grammar' ? 'Grammar' : 'Spelling';

    header.appendChild(logoWrap);
    header.appendChild(langTag);

    // Row
    const row = document.createElement('div');
    row.className = 'polyglot-correction-row';
    row.style.marginBottom = '6px';

    const typoSpan = document.createElement('span');
    typoSpan.className = 'polyglot-typo-text';
    typoSpan.textContent = correction.original;

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'polyglot-arrow';
    arrowSpan.textContent = '→';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'polyglot-suggest-btn';
    acceptBtn.id = 'polyglot-btn-accept';
    acceptBtn.title = 'Click to accept suggestion';
    acceptBtn.appendChild(createCheckSvg(12, 12));
    const acceptText = document.createElement('span');
    acceptText.textContent = correction.corrected;
    acceptBtn.appendChild(acceptText);

    row.appendChild(typoSpan);
    row.appendChild(arrowSpan);
    row.appendChild(acceptBtn);

    popup.appendChild(header);
    popup.appendChild(row);

    if (correction.explanation) {
      const explDiv = document.createElement('div');
      explDiv.className = 'polyglot-explanation';
      explDiv.style.fontSize = '10.5px';
      explDiv.style.marginBottom = '4px';
      explDiv.textContent = correction.explanation;
      popup.appendChild(explDiv);
    }

    const actions = document.createElement('div');
    actions.className = 'polyglot-card-actions';
    actions.style.marginTop = '4px';
    const ignoreBtn = document.createElement('button');
    ignoreBtn.className = 'polyglot-btn-sm';
    ignoreBtn.id = 'polyglot-btn-ignore';
    ignoreBtn.title = 'Dismiss suggestion';
    ignoreBtn.textContent = 'Ignore';
    actions.appendChild(ignoreBtn);

    popup.appendChild(actions);

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

    // Ignore action
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

    popup.replaceChildren();

    // Header
    const header = document.createElement('div');
    header.className = 'polyglot-card-header';
    header.style.marginBottom = '8px';
    header.style.paddingBottom = '6px';

    const logoWrap = document.createElement('div');
    logoWrap.className = 'polyglot-logo-wrap';
    const logoDot = document.createElement('div');
    logoDot.className = 'polyglot-logo-dot';
    const logoTitle = document.createElement('span');
    logoTitle.style.fontSize = '10px';
    logoTitle.textContent = 'Detected Issues';
    logoWrap.appendChild(logoDot);
    logoWrap.appendChild(logoTitle);

    const countTag = document.createElement('span');
    countTag.className = 'polyglot-lang-tag';
    countTag.id = 'polyglot-list-count';
    countTag.textContent = `${corrections.length} ${corrections.length > 1 ? 'Issues' : 'Issue'}`;

    header.appendChild(logoWrap);
    header.appendChild(countTag);

    // Fixes List
    const fixesList = document.createElement('div');
    fixesList.className = 'polyglot-fixes-list';
    fixesList.id = 'polyglot-fixes-list-body';
    fixesList.style.display = 'flex';
    fixesList.style.flexDirection = 'column';
    fixesList.style.gap = '6px';
    fixesList.style.maxHeight = '200px';
    fixesList.style.overflowY = 'auto';
    fixesList.style.paddingRight = '2px';

    corrections.forEach((c, idx) => {
      const itemRow = document.createElement('div');
      itemRow.className = 'polyglot-correction-row';
      itemRow.setAttribute('data-item-idx', String(idx));
      itemRow.style.marginBottom = '0';
      itemRow.style.justifyContent = 'space-between';
      itemRow.style.background = 'rgba(255, 255, 255, 0.04)';
      itemRow.style.padding = '5px 8px';
      itemRow.style.borderRadius = '6px';

      const typo = document.createElement('span');
      typo.className = 'polyglot-typo-text';
      typo.style.maxWidth = '110px';
      typo.style.overflow = 'hidden';
      typo.style.textOverflow = 'ellipsis';
      typo.style.whiteSpace = 'nowrap';
      typo.title = c.original;
      typo.textContent = c.original;

      const arrow = document.createElement('span');
      arrow.className = 'polyglot-arrow';
      arrow.textContent = '→';

      const fixBtn = document.createElement('button');
      fixBtn.className = 'polyglot-suggest-btn polyglot-fix-item-btn';
      fixBtn.setAttribute('data-fix-idx', String(idx));
      fixBtn.title = `Fix '${c.original}' → '${c.corrected}'`;
      fixBtn.appendChild(createCheckSvg(11, 11));
      const btnTxt = document.createElement('span');
      btnTxt.textContent = c.corrected;
      fixBtn.appendChild(btnTxt);

      itemRow.appendChild(typo);
      itemRow.appendChild(arrow);
      itemRow.appendChild(fixBtn);
      fixesList.appendChild(itemRow);
    });

    // Actions
    const actions = document.createElement('div');
    actions.className = 'polyglot-card-actions';
    actions.style.marginTop = '8px';
    actions.style.justifyContent = 'space-between';

    if (corrections.length > 1) {
      const fixAllBtn = document.createElement('button');
      fixAllBtn.className = 'polyglot-suggest-btn';
      fixAllBtn.id = 'polyglot-btn-fix-all';
      fixAllBtn.style.fontSize = '11px';
      fixAllBtn.style.padding = '4px 8px';
      fixAllBtn.appendChild(createCheckSvg(11, 11));
      const fixAllTxt = document.createElement('span');
      fixAllTxt.textContent = `Fix All (${corrections.length})`;
      fixAllBtn.appendChild(fixAllTxt);
      actions.appendChild(fixAllBtn);
    } else {
      actions.appendChild(document.createElement('div'));
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'polyglot-btn-sm';
    closeBtn.id = 'polyglot-btn-close-list';
    closeBtn.title = 'Close';
    closeBtn.textContent = 'Close';
    actions.appendChild(closeBtn);

    popup.appendChild(header);
    popup.appendChild(fixesList);
    popup.appendChild(actions);

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

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

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
