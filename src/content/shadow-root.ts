export class ShadowRootHost {
  private static instance: ShadowRootHost | null = null;
  public rootElement: HTMLElement;
  public shadowRoot: ShadowRoot;
  public overlayContainer: HTMLElement;
  public popoverContainer: HTMLElement;
  public toastContainer: HTMLElement;

  private constructor() {
    // Check if element already exists
    let existingHost = document.querySelector('grammar-checker-root') as HTMLElement;
    if (!existingHost) {
      existingHost = document.createElement('grammar-checker-root');
      existingHost.setAttribute('data-polyglot-extension', 'true');
      (document.documentElement || document.body).appendChild(existingHost);
    }
    this.rootElement = existingHost;

    if (existingHost.shadowRoot) {
      this.shadowRoot = existingHost.shadowRoot;
    } else {
      this.shadowRoot = existingHost.attachShadow({ mode: 'open' });
    }

    this.shadowRoot.innerHTML = ''; // clear

    // Inject isolated CSS styles
    const styleEl = document.createElement('style');
    styleEl.textContent = this.getStyles();
    this.shadowRoot.appendChild(styleEl);

    // Containers
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'polyglot-overlay-container';

    this.popoverContainer = document.createElement('div');
    this.popoverContainer.id = 'polyglot-popover-container';

    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'polyglot-toast-container';

    this.shadowRoot.appendChild(this.overlayContainer);
    this.shadowRoot.appendChild(this.popoverContainer);
    this.shadowRoot.appendChild(this.toastContainer);
  }

  public static getInstance(): ShadowRootHost {
    if (!this.instance || !document.contains(this.instance.rootElement)) {
      this.instance = new ShadowRootHost();
    }
    return this.instance;
  }

  public showToast(message: string, durationMs: number = 2200): void {
    const toast = document.createElement('div');
    toast.className = 'polyglot-toast';
    toast.innerHTML = `
      <svg class="polyglot-toast-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
      </svg>
      <span>${message}</span>
    `;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 250);
    }, durationMs);
  }

  private getStyles(): string {
    return `
      :host {
        all: initial !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        color: #f1f5f9 !important;
        box-sizing: border-box !important;
      }

      *, *::before, *::after {
        box-sizing: border-box !important;
        margin: 0;
        padding: 0;
        font-family: inherit;
      }

      #polyglot-overlay-container,
      #polyglot-popover-container,
      #polyglot-toast-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      /* Squiggly Underlines */
      .polyglot-error-marker {
        position: absolute;
        pointer-events: auto;
        cursor: pointer;
        background-repeat: repeat-x;
        background-position: bottom left;
        background-size: 6px 3px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 3'%3E%3Cpath d='M0 1.5 Q 1.5 0, 3 1.5 T 6 1.5' fill='none' stroke='%23f43f5e' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E");
        border-radius: 2px;
        transition: background-color 0.15s ease;
        z-index: 2147483640;
      }

      .polyglot-error-marker:hover {
        background-color: rgba(244, 63, 94, 0.12);
      }

      .polyglot-error-marker.grammar-style {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 3'%3E%3Cpath d='M0 1.5 Q 1.5 0, 3 1.5 T 6 1.5' fill='none' stroke='%236366f1' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E");
      }

      .polyglot-error-marker.grammar-style:hover {
        background-color: rgba(99, 102, 241, 0.12);
      }

      /* Subtle Editor Status Badge */
      .polyglot-status-badge {
        position: absolute;
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 3px;
        padding: 2px 6px;
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(6px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #94a3b8;
        font-size: 10px;
        font-weight: 500;
        cursor: pointer;
        user-select: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        opacity: 0.75;
        transition: opacity 0.15s ease, transform 0.15s ease;
        z-index: 2147483641;
      }

      .polyglot-status-badge:hover {
        opacity: 1;
        transform: scale(1.1);
        background: rgba(30, 41, 59, 0.95);
        color: #f8fafc;
      }

      .polyglot-status-badge .badge-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #10b981;
        pointer-events: none;
      }

      .polyglot-status-badge.has-errors .badge-dot {
        background: #f43f5e;
        animation: polyglotPulse 2s infinite;
      }

      .polyglot-status-badge.checking .badge-dot {
        background: #38bdf8;
        animation: polyglotSpin 1s linear infinite;
      }

      .polyglot-status-badge.compact-icon {
        width: 14px;
        height: 14px;
        padding: 0;
        border-radius: 50%;
        justify-content: center;
        text-align: center;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
      }

      .polyglot-status-badge.compact-icon.has-errors {
        background: rgba(244, 63, 94, 0.9);
        border-color: #f43f5e;
        box-shadow: 0 0 6px rgba(244, 63, 94, 0.5);
      }

      .polyglot-status-badge .compact-count {
        font-size: 8px;
        font-weight: 700;
        color: #ffffff;
        line-height: 1;
        pointer-events: none;
      }

      /* Google Translate Style Sentence & Word Corrections */
      .polyglot-sentence-correction {
        background: rgba(2, 6, 23, 0.65);
        border: 1px solid rgba(56, 189, 248, 0.25);
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 10px;
      }

      .polyglot-correction-caption {
        font-size: 11px;
        color: #94a3b8;
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 6px;
      }

      .polyglot-correction-caption svg {
        color: #38bdf8;
      }

      .polyglot-corrected-sentence {
        font-size: 13px;
        line-height: 1.55;
        color: #f8fafc;
        margin-bottom: 10px;
        word-break: break-word;
      }

      /* Google Translate bold italic blue diff highlight */
      .polyglot-diff-highlight {
        color: #38bdf8;
        font-weight: 700;
        font-style: italic;
        text-decoration: underline;
        text-decoration-color: rgba(56, 189, 248, 0.45);
      }

      .polyglot-sentence-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }

      .polyglot-btn-apply-sentence {
        background: linear-gradient(135deg, #10b981, #059669);
        color: #ffffff;
        border: none;
        border-radius: 6px;
        padding: 5px 12px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
        transition: all 0.15s ease;
      }

      .polyglot-btn-apply-sentence:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(16, 185, 129, 0.45);
      }

      .polyglot-tab-badge {
        background: #f43f5e;
        color: #ffffff;
        font-size: 9.5px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 10px;
        margin-left: 4px;
      }

      .polyglot-fix-chip-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .polyglot-floating-pill.has-fixes {
        border-color: #38bdf8;
        box-shadow: 0 8px 24px rgba(56, 189, 248, 0.35);
        background: rgba(15, 23, 42, 0.98);
      }

      .polyglot-floating-pill.has-fixes svg {
        color: #38bdf8;
      }

      /* Popover Card Glassmorphism */
      .polyglot-popover {
        position: absolute;
        pointer-events: auto;
        background: rgba(15, 23, 42, 0.98);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        box-shadow: 0 16px 32px -4px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);
        padding: 10px 12px;
        min-width: 220px;
        max-width: 340px;
        animation: polyglotPopIn 0.16s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 2147483646;
      }

      /* Downward pointing arrow for suggestions shown on top of word */
      .polyglot-popover.on-top::after {
        content: '';
        position: absolute;
        bottom: -7px;
        left: var(--arrow-left, 50%);
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-top: 7px solid rgba(15, 23, 42, 0.98);
        filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.4));
        pointer-events: none;
      }

      /* Upward pointing arrow if displayed below word */
      .polyglot-popover.below::before {
        content: '';
        position: absolute;
        top: -7px;
        left: var(--arrow-left, 50%);
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-bottom: 7px solid rgba(15, 23, 42, 0.98);
        filter: drop-shadow(0 -1px 2px rgba(0, 0, 0, 0.4));
        pointer-events: none;
      }

      /* Header & Badges */
      .polyglot-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .polyglot-logo-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        color: #818cf8;
        text-transform: uppercase;
      }

      .polyglot-logo-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #a855f7);
      }

      .polyglot-lang-tag {
        font-size: 10px;
        font-weight: 600;
        background: rgba(99, 102, 241, 0.18);
        color: #a5b4fc;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid rgba(99, 102, 241, 0.3);
      }

      /* Correction Card Elements */
      .polyglot-correction-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .polyglot-typo-text {
        color: #fda4af;
        text-decoration: line-through;
        font-size: 13px;
        font-weight: 500;
      }

      .polyglot-arrow {
        color: #64748b;
        font-size: 12px;
      }

      .polyglot-suggest-btn {
        background: linear-gradient(135deg, #10b981, #059669);
        color: #ffffff;
        border: none;
        border-radius: 6px;
        padding: 5px 10px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
        transition: all 0.15s ease;
      }

      .polyglot-suggest-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(16, 185, 129, 0.4);
      }

      .polyglot-explanation {
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.4;
        margin-bottom: 8px;
      }

      .polyglot-card-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        margin-top: 6px;
      }

      .polyglot-btn-sm {
        background: transparent;
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 5px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .polyglot-btn-sm:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #f1f5f9;
      }

      /* Tabs for Selection Explorer */
      .polyglot-tabs {
        display: flex;
        align-items: center;
        background: rgba(2, 6, 23, 0.5);
        border-radius: 8px;
        padding: 3px;
        margin-bottom: 10px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .polyglot-tab {
        flex: 1;
        text-align: center;
        padding: 5px 8px;
        font-size: 11px;
        font-weight: 600;
        color: #94a3b8;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none;
        background: transparent;
      }

      .polyglot-tab.active {
        background: rgba(99, 102, 241, 0.25);
        color: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }

      /* Synonyms Container */
      .polyglot-synonyms-wrap {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 220px;
        overflow-y: auto;
        padding-right: 4px;
      }

      .polyglot-pos-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .polyglot-pos-title {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #38bdf8;
      }

      .polyglot-terms-row {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .polyglot-term-chip {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e2e8f0;
        border-radius: 6px;
        padding: 3px 8px;
        font-size: 11.5px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .polyglot-term-chip:hover {
        background: rgba(99, 102, 241, 0.3);
        border-color: rgba(99, 102, 241, 0.5);
        color: #ffffff;
        transform: translateY(-1px);
      }

      /* Definitions View (when word has no synonyms) */
      .polyglot-definitions-wrap {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 240px;
        overflow-y: auto;
        padding-right: 4px;
      }

      .polyglot-def-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .polyglot-def-badge {
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        background: rgba(56, 189, 248, 0.2);
        color: #38bdf8;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid rgba(56, 189, 248, 0.35);
      }

      .polyglot-def-word {
        font-size: 13px;
        font-weight: 700;
        color: #f8fafc;
      }

      .polyglot-def-subtext {
        font-size: 11px;
        color: #94a3b8;
        font-style: italic;
      }

      .polyglot-def-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .polyglot-def-entry {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        padding: 6px 9px;
      }

      .polyglot-def-pos {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        color: #818cf8;
        letter-spacing: 0.4px;
        display: inline-block;
        margin-bottom: 3px;
      }

      .polyglot-def-gloss {
        font-size: 12px;
        color: #e2e8f0;
        line-height: 1.45;
      }

      .polyglot-def-example {
        font-size: 11px;
        color: #94a3b8;
        font-style: italic;
        margin-top: 4px;
        padding-left: 6px;
        border-left: 2px solid rgba(99, 102, 241, 0.4);
      }

      /* Translation View */
      .polyglot-translate-wrap {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .polyglot-select-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .polyglot-select-label {
        font-size: 11px;
        color: #94a3b8;
      }

      .polyglot-select {
        flex: 1;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        color: #f1f5f9;
        padding: 5px 8px;
        font-size: 11.5px;
        outline: none;
        cursor: pointer;
      }

      .polyglot-select:focus {
        border-color: #6366f1;
      }

      .polyglot-select option {
        background: #0f172a;
        color: #f8fafc;
      }

      .polyglot-trans-output {
        background: rgba(2, 6, 23, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 10px;
        font-size: 13px;
        color: #f8fafc;
        line-height: 1.5;
        min-height: 48px;
        max-height: 180px;
        overflow-y: auto;
        white-space: pre-wrap;
      }

      .polyglot-trans-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }

      .polyglot-btn-primary {
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: #ffffff;
        border: none;
        border-radius: 6px;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        box-shadow: 0 2px 6px rgba(99, 102, 241, 0.35);
        transition: all 0.15s ease;
      }

      .polyglot-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.45);
      }

      /* Toasts */
      #polyglot-toast-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        padding-bottom: 24px;
      }

      .polyglot-toast {
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(16, 185, 129, 0.4);
        box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(10px);
        color: #ffffff;
        padding: 8px 14px;
        border-radius: 24px;
        font-size: 12px;
        font-weight: 500;
        margin-top: 8px;
        animation: polyglotSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        transition: opacity 0.25s ease, transform 0.25s ease;
      }

      .polyglot-toast.fade-out {
        opacity: 0;
        transform: translateY(10px);
      }

      .polyglot-toast-icon {
        width: 16px;
        height: 16px;
        color: #10b981;
      }

      /* Floating Mini Pill for highlighted text */
      .polyglot-floating-pill {
        position: absolute;
        pointer-events: auto;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(15, 23, 42, 0.94);
        border: 1px solid rgba(99, 102, 241, 0.4);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(12px);
        border-radius: 20px;
        padding: 4px 10px;
        color: #e2e8f0;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        animation: polyglotPopIn 0.15s ease-out;
        z-index: 2147483645;
        transition: transform 0.15s ease;
      }

      .polyglot-floating-pill:hover {
        transform: scale(1.05);
        border-color: #6366f1;
        background: rgba(30, 41, 59, 0.98);
      }

      .polyglot-floating-pill svg {
        width: 13px;
        height: 13px;
        color: #818cf8;
      }

      /* Loading skeletons & spinners */
      .polyglot-spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-top-color: #6366f1;
        border-radius: 50%;
        animation: polyglotSpin 0.7s linear infinite;
      }

      /* Keyframes */
      @keyframes polyglotPopIn {
        from {
          opacity: 0;
          transform: scale(0.92) translateY(4px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      @keyframes polyglotSlideUp {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes polyglotPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.2); }
      }

      @keyframes polyglotSpin {
        to { transform: rotate(360deg); }
      }
    `;
  }
}
