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
        gap: 4px;
        padding: 4px 8px;
        border-radius: 20px;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #94a3b8;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        user-select: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 2147483641;
      }

      .polyglot-status-badge:hover {
        transform: scale(1.05);
        background: rgba(30, 41, 59, 0.95);
        color: #f8fafc;
      }

      .polyglot-status-badge .badge-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #10b981;
      }

      .polyglot-status-badge.has-errors .badge-dot {
        background: #f43f5e;
        animation: polyglotPulse 2s infinite;
      }

      .polyglot-status-badge.checking .badge-dot {
        background: #38bdf8;
        animation: polyglotSpin 1s linear infinite;
      }

      /* Popover Card Glassmorphism */
      .polyglot-popover {
        position: absolute;
        pointer-events: auto;
        background: rgba(15, 23, 42, 0.96);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
        padding: 12px;
        min-width: 250px;
        max-width: 380px;
        animation: polyglotPopIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 2147483646;
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
