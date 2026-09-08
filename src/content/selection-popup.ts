import { ShadowRootHost } from './shadow-root';
import { TextReplacer } from './text-replacer';
import { SUPPORTED_LANGUAGES, POPULAR_LANGUAGES, getLanguageName } from '../shared/languages';
import {
  SynonymsResponse,
  TranslateResponse,
  CheckTextResponse,
  GrammarCorrection
} from '../shared/types';
import { sendRuntimeMessage } from '../shared/messaging';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildCorrectedSentence(
  originalText: string,
  corrections: GrammarCorrection[]
): {
  correctedText: string;
  htmlHighlighted: string;
} {
  if (!corrections || corrections.length === 0) {
    return {
      correctedText: originalText,
      htmlHighlighted: escapeHtml(originalText)
    };
  }

  // Sort corrections by offset ascending
  const sorted = [...corrections].sort((a, b) => a.offset - b.offset);

  let correctedText = '';
  let htmlHighlighted = '';
  let lastIndex = 0;

  for (const corr of sorted) {
    if (corr.offset < lastIndex) continue; // Skip overlapping
    const before = originalText.substring(lastIndex, corr.offset);
    correctedText += before + corr.corrected;
    htmlHighlighted +=
      escapeHtml(before) +
      `<span class="polyglot-diff-highlight">${escapeHtml(corr.corrected)}</span>`;
    lastIndex = corr.offset + corr.length;
  }

  const remaining = originalText.substring(lastIndex);
  correctedText += remaining;
  htmlHighlighted += escapeHtml(remaining);

  return { correctedText, htmlHighlighted };
}

export class SelectionPopup {
  private static activePopup: HTMLElement | null = null;
  private static floatingPill: HTMLElement | null = null;
  private static dismissHandler: ((e: MouseEvent) => void) | null = null;
  private static keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private static savedRange: Range | null = null;
  private static savedInputTarget: {
    element: HTMLInputElement | HTMLTextAreaElement;
    start: number;
    end: number;
  } | null = null;
  private static cachedCorrections: {
    text: string;
    corrections: GrammarCorrection[];
    detectedLanguage: string;
  } | null = null;

  public static handleInputSelection(
    input: HTMLInputElement | HTMLTextAreaElement,
    text: string,
    start: number,
    end: number,
    autoPopup: boolean = false
  ): void {
    const raw = text;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 1) {
      this.close();
      return;
    }

    const leadingSpaces = raw.indexOf(trimmed);
    const actualStart = start + (leadingSpaces >= 0 ? leadingSpaces : 0);
    const actualEnd = actualStart + trimmed.length;

    this.savedInputTarget = { element: input, start: actualStart, end: actualEnd };
    this.savedRange = null;

    const inputRect = input.getBoundingClientRect();
    const computed = window.getComputedStyle(input);

    const valLen = Math.max(1, input.value.length);
    const midChar = (actualStart + actualEnd) / 2;
    const charRatio = Math.min(1, Math.max(0, midChar / valLen));

    const approxX = inputRect.left + input.clientWidth * charRatio;
    const topY = inputRect.top;

    const rect = new DOMRect(
      Math.min(inputRect.right - 60, Math.max(inputRect.left + 10, approxX - 30)),
      topY,
      60,
      parseFloat(computed.lineHeight) || 20
    );

    const isSingleWord = trimmed.split(/\s+/).length <= 2;
    if (autoPopup) {
      this.openCard(trimmed, rect);
    } else {
      this.showFloatingPill(trimmed, rect, isSingleWord);
    }
  }

  public static handleSelection(selection: Selection, autoPopup: boolean = false): void {
    this.savedInputTarget = null;
    if (selection.isCollapsed || selection.rangeCount === 0) {
      this.close();
      return;
    }

    const rawText = selection.toString();
    const text = rawText.trim();
    if (!text || text.length < 1) {
      this.close();
      return;
    }

    const range = selection.getRangeAt(0);
    this.savedRange = range.cloneRange();

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.close();
      return;
    }

    const isSingleWord = text.split(/\s+/).length <= 2;

    if (autoPopup) {
      this.openCard(text, rect);
    } else {
      this.showFloatingPill(text, rect, isSingleWord);
    }
  }

  private static removeUI(): void {
    if (this.floatingPill) {
      this.floatingPill.remove();
      this.floatingPill = null;
    }
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
    }
  }

  private static showFloatingPill(text: string, rect: DOMRect, isSingleWord: boolean): void {
    this.removeUI();

    const host = ShadowRootHost.getInstance();
    const pill = document.createElement('div');
    pill.className = 'polyglot-floating-pill';

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let pillTop = rect.top + scrollY - 34;
    if (pillTop < scrollY + 10) {
      pillTop = rect.bottom + scrollY + 8;
    }
    const pillLeft = Math.max(10, rect.left + scrollX + rect.width / 2 - 45);

    pill.style.top = `${pillTop}px`;
    pill.style.left = `${pillLeft}px`;

    pill.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.789l1.599.799L9 4.323V3a1 1 0 011-1z"/>
      </svg>
      <span>${isSingleWord ? 'Synonyms & Translate' : 'Translate'}</span>
    `;

    // Immediately check text for spelling/grammar so pill and card are dynamic
    sendRuntimeMessage<CheckTextResponse>({
      type: 'CHECK_TEXT',
      text
    })
      .then((res) => {
        if (res && Array.isArray(res.corrections) && res.corrections.length > 0) {
          this.cachedCorrections = {
            text,
            corrections: res.corrections,
            detectedLanguage: res.detectedLanguage || 'en'
          };
          if (this.floatingPill === pill) {
            pill.classList.add('has-fixes');
            const count = res.corrections.length;
            const span = pill.querySelector('span');
            if (span) {
              span.textContent = `✨ Fix ${count} ${count > 1 ? 'typos' : 'typo'}`;
            }
          }
        }
      })
      .catch(() => {});

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const hasFixes =
        this.cachedCorrections &&
        this.cachedCorrections.text === text &&
        this.cachedCorrections.corrections.length > 0;
      const defaultTab = hasFixes ? 'fixes' : isSingleWord ? 'synonyms' : 'translate';
      this.openCard(text, rect, defaultTab);
    });

    host.overlayContainer.appendChild(pill);
    this.floatingPill = pill;

    this.attachOutsideDismiss();
  }  public static openCard(
    text: string,
    rect: DOMRect,
    initialTabOverride?: 'fixes' | 'synonyms' | 'translate'
  ): void {
    this.removeUI();

    const host = ShadowRootHost.getInstance();
    const popup = document.createElement('div');
    popup.className = 'polyglot-popover';

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let top = rect.top + scrollY - 250;
    if (top < scrollY + 10) {
      top = rect.bottom + scrollY + 8;
    }
    const left = Math.max(10, Math.min(window.innerWidth - 380, rect.left + scrollX - 20));

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    popup.style.width = '360px';

    const isSingleWord = text.split(/\s+/).length <= 2;
    const hasCachedFixes =
      this.cachedCorrections &&
      this.cachedCorrections.text === text &&
      this.cachedCorrections.corrections.length > 0;

    // Default to 'fixes' so spelling & grammar are always evaluated first
    let activeTab: 'fixes' | 'synonyms' | 'translate' =
      initialTabOverride || (hasCachedFixes ? 'fixes' : 'fixes');

    const fixesCount = hasCachedFixes ? this.cachedCorrections!.corrections.length : 0;

    // Render structure with 3 tabs: Fixes, Synonyms (if single word/short), Translate
    popup.innerHTML = `
      <div class="polyglot-card-header">
        <div class="polyglot-logo-wrap">
          <div class="polyglot-logo-dot"></div>
          <span>Polyglot ${isSingleWord ? 'Explorer' : 'Proofreader'}</span>
        </div>
        <span class="polyglot-lang-tag" id="polyglot-card-lang">Detecting...</span>
      </div>

      <div class="polyglot-tabs">
        <button class="polyglot-tab ${activeTab === 'fixes' ? 'active' : ''}" id="tab-fixes">
          Fixes <span class="polyglot-tab-badge" id="polyglot-tab-badge-fixes" style="${fixesCount > 0 ? 'display:inline-block;' : 'display:none;'}">${fixesCount || ''}</span>
        </button>
        ${
          isSingleWord
            ? `<button class="polyglot-tab ${activeTab === 'synonyms' ? 'active' : ''}" id="tab-synonyms">Synonyms</button>`
            : ''
        }
        <button class="polyglot-tab ${activeTab === 'translate' ? 'active' : ''}" id="tab-translate">Translate</button>
      </div>

      <div id="polyglot-tab-content-fixes" style="${activeTab === 'fixes' ? 'display: block;' : 'display: none;'}">
        <div class="polyglot-fixes-wrap" id="fixes-content">
          <div style="display: flex; align-items: center; justify-content: center; padding: 20px; gap: 8px; color: #94a3b8;">
            <div class="polyglot-spinner"></div>
            <span>Checking spelling & grammar...</span>
          </div>
        </div>
      </div>

      ${
        isSingleWord
          ? `
        <div id="polyglot-tab-content-synonyms" style="${activeTab === 'synonyms' ? 'display: block;' : 'display: none;'}">
          <div class="polyglot-synonyms-wrap" id="synonyms-content">
            <div style="display: flex; align-items: center; justify-content: center; padding: 20px; gap: 8px; color: #94a3b8;">
              <div class="polyglot-spinner"></div>
              <span>Fetching synonyms...</span>
            </div>
          </div>
        </div>
      `
          : ''
      }

      <div id="polyglot-tab-content-translate" style="${activeTab === 'translate' ? 'display: block;' : 'display: none;'}">
        <div class="polyglot-translate-wrap">
          <div class="polyglot-select-row">
            <span class="polyglot-select-label">To:</span>
            <select class="polyglot-select" id="polyglot-target-lang">
              ${this.renderLanguageOptions()}
            </select>
          </div>
          <div class="polyglot-trans-output" id="polyglot-trans-result">
            <div style="display: flex; align-items: center; gap: 8px; color: #94a3b8;">
              <div class="polyglot-spinner"></div>
              <span>Translating...</span>
            </div>
          </div>
          <div class="polyglot-trans-actions">
            <button class="polyglot-btn-sm" id="polyglot-btn-copy">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; vertical-align: middle; margin-right: 3px;">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
              </svg>
              Copy
            </button>
            <button class="polyglot-btn-primary" id="polyglot-btn-replace">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; vertical-align: middle;">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
              </svg>
              Replace
            </button>
          </div>
        </div>
      </div>
    `;

    popup.addEventListener('click', (e) => e.stopPropagation());
    popup.addEventListener('mousedown', (e) => e.stopPropagation());
    popup.addEventListener('mouseup', (e) => e.stopPropagation());

    host.popoverContainer.appendChild(popup);
    this.activePopup = popup;

    const tabFixes = popup.querySelector('#tab-fixes') as HTMLElement;
    const tabSyn = popup.querySelector('#tab-synonyms') as HTMLElement | null;
    const tabTrans = popup.querySelector('#tab-translate') as HTMLElement;
    const contentFixes = popup.querySelector('#polyglot-tab-content-fixes') as HTMLElement;
    const contentSyn = popup.querySelector('#polyglot-tab-content-synonyms') as HTMLElement | null;
    const contentTrans = popup.querySelector('#polyglot-tab-content-translate') as HTMLElement;

    const activateTab = (tabName: 'fixes' | 'synonyms' | 'translate', isManualUserClick: boolean = false) => {
      tabFixes.classList.toggle('active', tabName === 'fixes');
      if (tabSyn) tabSyn.classList.toggle('active', tabName === 'synonyms');
      tabTrans.classList.toggle('active', tabName === 'translate');

      contentFixes.style.display = tabName === 'fixes' ? 'block' : 'none';
      if (contentSyn) contentSyn.style.display = tabName === 'synonyms' ? 'block' : 'none';
      contentTrans.style.display = tabName === 'translate' ? 'block' : 'none';

      if (tabName === 'fixes') {
        this.loadFixes(text, popup, isSingleWord, isManualUserClick ? undefined : () => {
          if (!initialTabOverride && isSingleWord) {
            activateTab('synonyms', false);
          }
        });
      } else if (tabName === 'synonyms') {
        this.loadSynonyms(text, popup);
      } else if (tabName === 'translate') {
        this.runTranslation(text, popup);
      }
    };

    tabFixes.addEventListener('click', () => activateTab('fixes', true));
    if (tabSyn) tabSyn.addEventListener('click', () => activateTab('synonyms', true));
    tabTrans.addEventListener('click', () => activateTab('translate', true));

    // Trigger initial tab load
    activateTab(activeTab, false);

    // Language dropdown change
    const langSelect = popup.querySelector('#polyglot-target-lang') as HTMLSelectElement;
    langSelect.addEventListener('change', () => {
      this.runTranslation(text, popup, langSelect.value);
    });

    // Copy action
    const copyBtn = popup.querySelector('#polyglot-btn-copy') as HTMLElement;
    copyBtn.addEventListener('click', () => {
      const transResult = popup.querySelector('#polyglot-trans-result') as HTMLElement;
      const textToCopy = transResult.textContent || '';
      if (textToCopy && !textToCopy.includes('Translating...')) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          host.showToast('Copied translation to clipboard!');
        });
      }
    });

    // Replace action
    const replaceBtn = popup.querySelector('#polyglot-btn-replace') as HTMLElement;
    replaceBtn.addEventListener('click', () => {
      const transResult = popup.querySelector('#polyglot-trans-result') as HTMLElement;
      const translated = transResult.textContent || '';
      if (translated && !translated.includes('Translating...')) {
        const replaced = TextReplacer.replaceActiveSelection(
          translated,
          this.savedRange,
          this.savedInputTarget
        );
        if (replaced) {
          host.showToast('Replaced with translation!');
          this.close();
        } else {
          navigator.clipboard.writeText(translated).then(() => {
            host.showToast('Selection read-only. Copied to clipboard!');
          });
        }
      }
    });

    this.attachOutsideDismiss();
  }

  private static renderLanguageOptions(): string {
    let html = '<optgroup label="Popular Languages">';
    for (const code of POPULAR_LANGUAGES) {
      const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
      if (lang) {
        html += `<option value="${lang.code}">${lang.name} (${lang.nativeName})</option>`;
      }
    }
    html += '</optgroup><optgroup label="All Languages">';
    for (const lang of SUPPORTED_LANGUAGES) {
      html += `<option value="${lang.code}">${lang.name}</option>`;
    }
    html += '</optgroup>';
    return html;
  }

  public static async loadFixes(
    text: string,
    popup: HTMLElement,
    isSingleWord: boolean = false,
    onAutoSwitchToSynonyms?: () => void
  ): Promise<void> {
    const fixesContainer = popup.querySelector('#fixes-content') as HTMLElement;
    const badgeFixes = popup.querySelector('#polyglot-tab-badge-fixes') as HTMLElement;
    const langTag = popup.querySelector('#polyglot-card-lang') as HTMLElement;
    if (!fixesContainer) return;

    let corrections: GrammarCorrection[] = [];
    let detectedLang = 'en';

    if (
      this.cachedCorrections &&
      this.cachedCorrections.text === text &&
      Array.isArray(this.cachedCorrections.corrections)
    ) {
      corrections = this.cachedCorrections.corrections;
      detectedLang = this.cachedCorrections.detectedLanguage || 'en';
    } else {
      fixesContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 20px; gap: 8px; color: #94a3b8;">
          <div class="polyglot-spinner"></div>
          <span>Checking spelling & grammar...</span>
        </div>
      `;

      try {
        const response = await sendRuntimeMessage<CheckTextResponse>({
          type: 'CHECK_TEXT',
          text
        });

        if (response && Array.isArray(response.corrections)) {
          corrections = response.corrections;
          detectedLang = response.detectedLanguage || 'en';
          this.cachedCorrections = {
            text,
            corrections,
            detectedLanguage: detectedLang
          };
        }
      } catch {
        // failed lookup
      }
    }

    if (langTag) {
      langTag.textContent = getLanguageName(detectedLang);
    }

    if (badgeFixes) {
      if (corrections.length > 0) {
        badgeFixes.style.display = 'inline-block';
        badgeFixes.textContent = String(corrections.length);
      } else {
        badgeFixes.style.display = 'none';
      }
    }

    // Auto-switch to synonyms for single words that have NO spelling errors
    if (corrections.length === 0 && isSingleWord && onAutoSwitchToSynonyms) {
      onAutoSwitchToSynonyms();
      return;
    }

    // Render Google Translate-Style Sentence Correction
    if (corrections.length > 0) {
      const { correctedText, htmlHighlighted } = buildCorrectedSentence(text, corrections);

      fixesContainer.innerHTML = `
        <div class="polyglot-sentence-correction">
          <div class="polyglot-correction-caption">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.789l1.599.799L9 4.323V3a1 1 0 011-1z"/>
            </svg>
            Showing correction for:
          </div>
          <div class="polyglot-corrected-sentence">${htmlHighlighted}</div>
          <div class="polyglot-sentence-actions">
            <button class="polyglot-btn-sm" id="polyglot-btn-copy-sentence">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; vertical-align: middle; margin-right: 3px;">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
              </svg>
              Copy
            </button>
            <button class="polyglot-btn-primary" id="polyglot-btn-apply-all">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; vertical-align: middle;">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              Apply Correction
            </button>
          </div>
        </div>

        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8; margin: 10px 0 6px 2px;">
          Detected ${corrections.length > 1 ? 'Anomalies' : 'Correction'} (${corrections.length})
        </div>

        <div class="polyglot-fixes-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto;">
          ${corrections
            .map(
              (c, idx) => `
            <div class="polyglot-fix-chip-row">
              <span class="polyglot-typo-text">${escapeHtml(c.original)}</span>
              <span class="polyglot-arrow">→</span>
              <button class="polyglot-suggest-btn" data-fix-idx="${idx}">
                ${escapeHtml(c.corrected)}
              </button>
            </div>
          `
            )
            .join('')}
        </div>
      `;

      // Apply All Corrections
      const applyAllBtn = fixesContainer.querySelector('#polyglot-btn-apply-all') as HTMLElement;
      applyAllBtn?.addEventListener('click', () => {
        const host = ShadowRootHost.getInstance();
        const replaced = TextReplacer.replaceActiveSelection(
          correctedText,
          this.savedRange,
          this.savedInputTarget
        );
        if (replaced) {
          host.showToast('Replaced with corrected sentence!');
          this.close();
        } else {
          navigator.clipboard.writeText(correctedText).then(() => {
            host.showToast('Selection read-only. Copied to clipboard!');
          });
        }
      });

      // Copy Corrected Sentence
      const copySentenceBtn = fixesContainer.querySelector(
        '#polyglot-btn-copy-sentence'
      ) as HTMLElement;
      copySentenceBtn?.addEventListener('click', () => {
        const host = ShadowRootHost.getInstance();
        navigator.clipboard.writeText(correctedText).then(() => {
          host.showToast('Copied corrected sentence to clipboard!');
        });
      });

      // Individual Fix Buttons
      const fixBtns = fixesContainer.querySelectorAll('.polyglot-suggest-btn');
      fixBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-fix-idx') || '0', 10);
          const c = corrections[idx];
          if (c) {
            const host = ShadowRootHost.getInstance();
            // If the user selected just this word
            if (text.trim().toLowerCase() === c.original.trim().toLowerCase()) {
              const replaced = TextReplacer.replaceActiveSelection(
                c.corrected,
                this.savedRange,
                this.savedInputTarget
              );
              if (replaced) {
                host.showToast(`Fixed: "${c.corrected}"`);
                this.close();
                return;
              }
            }
            // For full sentence, apply either single fix or full correction
            const textToApply =
              corrections.length === 1
                ? correctedText
                : buildCorrectedSentence(text, [c]).correctedText;
            const replaced = TextReplacer.replaceActiveSelection(
              textToApply,
              this.savedRange,
              this.savedInputTarget
            );
            if (replaced) {
              host.showToast(`Applied correction: "${c.corrected}"`);
              this.close();
            } else {
              navigator.clipboard.writeText(c.corrected).then(() => {
                host.showToast(`Selection read-only. Copied "${c.corrected}" to clipboard!`);
              });
            }
          }
        });
      });
    } else {
      fixesContainer.innerHTML = `
        <div style="text-align: center; padding: 22px 14px; color: #94a3b8; font-size: 13px; line-height: 1.6;">
          <div style="font-size: 20px; margin-bottom: 6px;">✨</div>
          <div style="font-weight: 600; color: #f8fafc; margin-bottom: 4px;">No spelling issues found</div>
          <div style="font-size: 11.5px; color: #64748b;">The highlighted text looks grammatically correct.</div>
          <div style="margin-top: 10px;">
            <button class="polyglot-btn-sm" id="polyglot-switch-to-trans">
              Switch to Translate tab
            </button>
          </div>
        </div>
      `;

      fixesContainer
        .querySelector('#polyglot-switch-to-trans')
        ?.addEventListener('click', () => {
          const tabTrans = popup.querySelector('#tab-translate') as HTMLElement;
          if (tabTrans) tabTrans.click();
        });
    }
  }

  private static async loadSynonyms(word: string, popup: HTMLElement): Promise<void> {
    const synonymsContainer = popup.querySelector('#synonyms-content') as HTMLElement;
    const langTag = popup.querySelector('#polyglot-card-lang') as HTMLElement;
    if (!synonymsContainer) return;

    // Show spinner if not already showing
    synonymsContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; padding: 20px; gap: 8px; color: #94a3b8;">
        <div class="polyglot-spinner"></div>
        <span>Fetching synonyms...</span>
      </div>
    `;

    try {
      const response = await sendRuntimeMessage<SynonymsResponse>({
        type: 'GET_SYNONYMS',
        word
      });

      if (langTag && response && response.detectedLanguage) {
        langTag.textContent = getLanguageName(response.detectedLanguage);
      }

      if (!response || !response.synonyms || response.synonyms.length === 0) {
        if (response && response.definitions && response.definitions.length > 0) {
          let defHtml = `
            <div class="polyglot-definitions-wrap">
              <div class="polyglot-def-header">
                <span class="polyglot-def-badge">Definition</span>
                <span class="polyglot-def-word">${escapeHtml(word)}</span>
              </div>
              <div class="polyglot-def-subtext">No synonyms found — dictionary definition:</div>
              <div class="polyglot-def-list">
          `;
          for (const def of response.definitions) {
            defHtml += `
              <div class="polyglot-def-entry">
                <span class="polyglot-def-pos">${escapeHtml(def.pos)}</span>
                <div class="polyglot-def-gloss">${escapeHtml(def.gloss)}</div>
                ${def.example ? `<div class="polyglot-def-example">"${escapeHtml(def.example)}"</div>` : ''}
              </div>
            `;
          }
          defHtml += `
              </div>
            </div>
          `;
          synonymsContainer.innerHTML = defHtml;
          return;
        }

        synonymsContainer.innerHTML = `
          <div style="text-align: center; padding: 20px 14px; color: #94a3b8; font-size: 12.5px; line-height: 1.6;">
            <div style="font-weight: 600; color: #f1f5f9; margin-bottom: 4px;">No synonyms or definitions found for "${escapeHtml(word)}"</div>
            <div style="font-size: 11px; color: #64748b;">
              Check the <b style="color: #38bdf8; cursor: pointer;" id="polyglot-switch-fixes">Fixes</b> tab or <b style="color: #818cf8; cursor: pointer;" id="polyglot-switch-trans">Translate</b> tab!
            </div>
          </div>
        `;
        synonymsContainer.querySelector('#polyglot-switch-fixes')?.addEventListener('click', () => {
          const tabFixes = popup.querySelector('#tab-fixes') as HTMLElement;
          if (tabFixes) tabFixes.click();
        });
        synonymsContainer.querySelector('#polyglot-switch-trans')?.addEventListener('click', () => {
          const tabTrans = popup.querySelector('#tab-translate') as HTMLElement;
          if (tabTrans) tabTrans.click();
        });
        return;
      }

      let html = '';
      for (const group of response.synonyms) {
        html += `
          <div class="polyglot-pos-group">
            <div class="polyglot-pos-title">${group.pos}</div>
            <div class="polyglot-terms-row">
              ${group.terms
                .map(
                  (term) =>
                    `<button class="polyglot-term-chip" data-term="${term}">${term}</button>`
                )
                .join('')}
            </div>
          </div>
        `;
      }
      synonymsContainer.innerHTML = html;

      // Click on synonym chip
      const chips = synonymsContainer.querySelectorAll('.polyglot-term-chip');
      chips.forEach((chip) => {
        chip.addEventListener('click', () => {
          const replacementTerm = chip.getAttribute('data-term') || '';
          if (replacementTerm) {
            const success = TextReplacer.replaceActiveSelection(
              replacementTerm,
              this.savedRange,
              this.savedInputTarget
            );
            const host = ShadowRootHost.getInstance();
            if (success) {
              host.showToast(`Replaced with: "${replacementTerm}"`);
              this.close();
            } else {
              navigator.clipboard.writeText(replacementTerm).then(() => {
                host.showToast(`Copied "${replacementTerm}" to clipboard!`);
              });
            }
          }
        });
      });
    } catch {
      synonymsContainer.innerHTML = `
        <div style="text-align: center; padding: 18px; color: #94a3b8; font-size: 12px;">
          No synonyms found for "${word}".
        </div>
      `;
    }
  }

  private static async runTranslation(
    text: string,
    popup: HTMLElement,
    targetLangOverride?: string
  ): Promise<void> {
    const resultBox = popup.querySelector('#polyglot-trans-result') as HTMLElement;
    const langSelect = popup.querySelector('#polyglot-target-lang') as HTMLSelectElement;
    const langTag = popup.querySelector('#polyglot-card-lang') as HTMLElement;

    const targetLang = targetLangOverride || langSelect?.value || 'es';
    if (!resultBox) return;

    resultBox.textContent = 'Translating...';

    try {
      const response = await sendRuntimeMessage<TranslateResponse>({
        type: 'TRANSLATE_TEXT',
        text,
        targetLang
      });

      if (response && response.result) {
        resultBox.textContent = response.result.translatedText;
        if (langTag) {
          langTag.textContent = `${getLanguageName(response.result.detectedLanguage)} → ${getLanguageName(targetLang)}`;
        }
      } else {
        resultBox.textContent = text;
      }
    } catch {
      resultBox.textContent = 'Translation service temporarily unavailable.';
    }
  }

  private static attachOutsideDismiss(): void {
    if (this.dismissHandler) {
      window.removeEventListener('mousedown', this.dismissHandler);
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
    }

    setTimeout(() => {
      this.dismissHandler = (e: MouseEvent) => {
        const host = ShadowRootHost.getInstance();
        const path = e.composedPath();
        if (
          !path.includes(host.rootElement) &&
          !path.includes(this.activePopup as EventTarget) &&
          !path.includes(this.floatingPill as EventTarget)
        ) {
          this.close();
        }
      };

      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.close();
        }
      };

      window.addEventListener('mousedown', this.dismissHandler);
      window.addEventListener('keydown', this.keyHandler);
    }, 20);
  }

  public static close(): void {
    this.savedInputTarget = null;
    this.savedRange = null;
    if (this.floatingPill) {
      this.floatingPill.remove();
      this.floatingPill = null;
    }
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
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
