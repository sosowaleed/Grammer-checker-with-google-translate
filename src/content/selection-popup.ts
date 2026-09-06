import { ShadowRootHost } from './shadow-root';
import { TextReplacer } from './text-replacer';
import { SUPPORTED_LANGUAGES, POPULAR_LANGUAGES, getLanguageName } from '../shared/languages';
import { SynonymGroup, SynonymsResponse, TranslateResponse } from '../shared/types';
import { sendRuntimeMessage } from '../shared/messaging';

export class SelectionPopup {
  private static activePopup: HTMLElement | null = null;
  private static floatingPill: HTMLElement | null = null;
  private static dismissHandler: ((e: MouseEvent) => void) | null = null;
  private static keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private static savedRange: Range | null = null;

  public static handleSelection(selection: Selection): void {
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

    this.showFloatingPill(text, rect, isSingleWord);
  }

  private static showFloatingPill(text: string, rect: DOMRect, isSingleWord: boolean): void {
    this.close();

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

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.openCard(text, rect, isSingleWord ? 'synonyms' : 'translate');
    });

    host.overlayContainer.appendChild(pill);
    this.floatingPill = pill;

    this.attachOutsideDismiss();
  }

  public static openCard(
    text: string,
    rect: DOMRect,
    initialTab: 'synonyms' | 'translate' = 'synonyms'
  ): void {
    if (this.floatingPill) {
      this.floatingPill.remove();
      this.floatingPill = null;
    }
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
    }

    const host = ShadowRootHost.getInstance();
    const popup = document.createElement('div');
    popup.className = 'polyglot-popover';

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let top = rect.top + scrollY - 240;
    if (top < scrollY + 10) {
      top = rect.bottom + scrollY + 8;
    }
    const left = Math.max(10, Math.min(window.innerWidth - 380, rect.left + scrollX - 20));

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    popup.style.width = '350px';

    const isSingleWord = text.split(/\s+/).length <= 2;

    // Render structure
    popup.innerHTML = `
      <div class="polyglot-card-header">
        <div class="polyglot-logo-wrap">
          <div class="polyglot-logo-dot"></div>
          <span>Polyglot ${isSingleWord ? 'Explorer' : 'Translator'}</span>
        </div>
        <span class="polyglot-lang-tag" id="polyglot-card-lang">Detecting...</span>
      </div>

      ${
        isSingleWord
          ? `
        <div class="polyglot-tabs">
          <button class="polyglot-tab ${initialTab === 'synonyms' ? 'active' : ''}" id="tab-synonyms">Synonyms</button>
          <button class="polyglot-tab ${initialTab === 'translate' ? 'active' : ''}" id="tab-translate">Translate</button>
        </div>
      `
          : ''
      }

      <div id="polyglot-tab-content-synonyms" style="${initialTab === 'synonyms' && isSingleWord ? 'display: block;' : 'display: none;'}">
        <div class="polyglot-synonyms-wrap" id="synonyms-content">
          <div style="display: flex; align-items: center; justify-content: center; padding: 20px; gap: 8px; color: #94a3b8;">
            <div class="polyglot-spinner"></div>
            <span>Fetching synonyms...</span>
          </div>
        </div>
      </div>

      <div id="polyglot-tab-content-translate" style="${initialTab === 'translate' || !isSingleWord ? 'display: block;' : 'display: none;'}">
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

    host.popoverContainer.appendChild(popup);
    this.activePopup = popup;

    // Tabs switching
    if (isSingleWord) {
      const tabSyn = popup.querySelector('#tab-synonyms') as HTMLElement;
      const tabTrans = popup.querySelector('#tab-translate') as HTMLElement;
      const contentSyn = popup.querySelector('#polyglot-tab-content-synonyms') as HTMLElement;
      const contentTrans = popup.querySelector('#polyglot-tab-content-translate') as HTMLElement;

      tabSyn.addEventListener('click', () => {
        tabSyn.classList.add('active');
        tabTrans.classList.remove('active');
        contentSyn.style.display = 'block';
        contentTrans.style.display = 'none';
      });

      tabTrans.addEventListener('click', () => {
        tabTrans.classList.add('active');
        tabSyn.classList.remove('active');
        contentTrans.style.display = 'block';
        contentSyn.style.display = 'none';
        this.runTranslation(text, popup);
      });
    }

    // Load initial data
    if (isSingleWord && initialTab === 'synonyms') {
      this.loadSynonyms(text, popup);
    } else {
      this.runTranslation(text, popup);
    }

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
        const replaced = TextReplacer.replaceActiveSelection(translated, this.savedRange);
        if (replaced) {
          host.showToast('Replaced with translation!');
          this.close();
        } else {
          // If not in editable field, copy to clipboard
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

  private static async loadSynonyms(word: string, popup: HTMLElement): Promise<void> {
    const synonymsContainer = popup.querySelector('#synonyms-content') as HTMLElement;
    const langTag = popup.querySelector('#polyglot-card-lang') as HTMLElement;

    try {
      const response = await sendRuntimeMessage<SynonymsResponse>({
        type: 'GET_SYNONYMS',
        word
      });

      if (langTag && response.detectedLanguage) {
        langTag.textContent = getLanguageName(response.detectedLanguage);
      }

      if (!response.synonyms || response.synonyms.length === 0) {
        synonymsContainer.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
            No direct synonyms found. Try the <b style="color: #6366f1;">Translate</b> tab!
          </div>
        `;
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
            const success = TextReplacer.replaceActiveSelection(replacementTerm, this.savedRange);
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
        <div style="text-align: center; padding: 15px; color: #fda4af;">
          Failed to load synonyms.
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

    const targetLang = targetLangOverride || langSelect.value || 'es';

    resultBox.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: #94a3b8;">
        <div class="polyglot-spinner"></div>
        <span>Translating...</span>
      </div>
    `;

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
