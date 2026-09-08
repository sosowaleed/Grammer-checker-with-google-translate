import { GrammarCorrection } from '../shared/types';
import { ShadowRootHost } from './shadow-root';
import { CorrectionPopup } from './correction-popup';

export class OverlayManager {
  private host: ShadowRootHost;
  private activeElement: HTMLElement | null = null;
  private markers: HTMLElement[] = [];
  private statusBadge: HTMLElement | null = null;
  private currentCorrections: GrammarCorrection[] = [];
  private mirrorDiv: HTMLDivElement | null = null;
  private scrollListener: (() => void) | null = null;
  private resizeListener: (() => void) | null = null;
  private mouseMoveListener: ((e: MouseEvent) => void) | null = null;
  private autoPopupHover: boolean = true;
  private currentHoverMarker: HTMLElement | null = null;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.host = ShadowRootHost.getInstance();
  }

  public setAutoPopupHover(enabled: boolean): void {
    this.autoPopupHover = enabled;
  }

  public setAutoPopup(enabled: boolean): void {
    this.setAutoPopupHover(enabled);
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  public setCorrections(
    element: HTMLElement,
    corrections: GrammarCorrection[],
    detectedLang: string = 'en'
  ): void {
    this.clear();
    this.activeElement = element;
    this.currentCorrections = corrections;

    this.renderStatusBadge(element, corrections.length, detectedLang);

    if (corrections.length === 0) {
      return;
    }

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      this.renderInputUnderlines(element, corrections);
    } else if (element.isContentEditable) {
      this.renderContentEditableUnderlines(element, corrections);
    }

    this.attachScrollAndResizeListeners();
  }

  public clear(): void {
    this.clearHoverTimer();
    this.currentHoverMarker = null;
    for (const marker of this.markers) {
      marker.remove();
    }
    this.markers = [];

    if (this.statusBadge) {
      this.statusBadge.remove();
      this.statusBadge = null;
    }

    if (this.mirrorDiv) {
      this.mirrorDiv.remove();
      this.mirrorDiv = null;
    }

    this.detachScrollAndResizeListeners();
    this.activeElement = null;
    this.currentCorrections = [];
  }

  public removeMarkersForWord(word: string): void {
    const target = word.trim().toLowerCase();
    const remaining: HTMLElement[] = [];
    for (const marker of this.markers) {
      const orig = (marker as any).__polyglotCorrection?.original?.trim()?.toLowerCase();
      if (orig === target) {
        marker.remove();
      } else {
        remaining.push(marker);
      }
    }
    this.markers = remaining;
    this.currentCorrections = this.currentCorrections.filter(
      (c) => c.original.trim().toLowerCase() !== target
    );
    if (this.statusBadge) {
      if (this.markers.length === 0) {
        this.statusBadge.classList.remove('has-errors');
        this.statusBadge.querySelector('span')!.textContent = 'Polyglot';
      } else {
        const lang = (this.statusBadge.getAttribute('data-lang') || 'EN').toUpperCase();
        this.statusBadge.querySelector('span')!.textContent = `${lang} • ${this.markers.length} issue${this.markers.length > 1 ? 's' : ''}`;
      }
    }
  }

  private renderStatusBadge(
    element: HTMLElement,
    errorCount: number,
    detectedLang: string
  ): void {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    const isSingleLine = element instanceof HTMLInputElement || rect.height <= 44;
    const badge = document.createElement('div');
    badge.className = `polyglot-status-badge ${errorCount > 0 ? 'has-errors' : ''} ${isSingleLine ? 'compact-icon' : ''}`;
    badge.setAttribute('data-lang', detectedLang || 'en');

    const langUpper = (detectedLang || 'en').toUpperCase();

    badge.replaceChildren();
    if (isSingleLine) {
      const iconSize = 14;
      badge.style.left = `${rect.right + scrollX - 18}px`;
      badge.style.top = `${rect.top + scrollY + Math.max(1, (rect.height - iconSize) / 2)}px`;
      if (errorCount > 0) {
        const countSpan = document.createElement('span');
        countSpan.className = 'compact-count';
        countSpan.textContent = String(errorCount);
        badge.appendChild(countSpan);
      } else {
        const dot = document.createElement('div');
        dot.className = 'badge-dot';
        dot.style.margin = '0';
        badge.appendChild(dot);
      }
    } else {
      badge.style.left = `${rect.right + scrollX - 82}px`;
      badge.style.top = `${rect.bottom + scrollY - 26}px`;
      const dot = document.createElement('div');
      dot.className = 'badge-dot';
      const textSpan = document.createElement('span');
      textSpan.textContent = `${langUpper} • ${errorCount > 0 ? `${errorCount} issue${errorCount > 1 ? 's' : ''}` : 'Polyglot'}`;
      badge.appendChild(dot);
      badge.appendChild(textSpan);
    }

    badge.title = `PolyglotGrammar [${langUpper}]: ${
      errorCount > 0 ? `${errorCount} grammar/spelling issues detected (Click to review)` : 'No errors detected'
    }`;

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      if (errorCount > 0 && this.currentCorrections.length > 0) {
        CorrectionPopup.showList(
          this.currentCorrections,
          badge,
          this.activeElement,
          (accepted) => {
            this.currentCorrections = this.currentCorrections.filter((c) => c !== accepted);
            this.setCorrections(element, this.currentCorrections, detectedLang);
          },
          () => {
            this.currentCorrections = [];
            this.clear();
          }
        );
      }
    });

    this.host.overlayContainer.appendChild(badge);
    this.statusBadge = badge;
  }

  private renderInputUnderlines(
    input: HTMLInputElement | HTMLTextAreaElement,
    corrections: GrammarCorrection[]
  ): void {
    const computed = window.getComputedStyle(input);
    const rect = input.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Create mirror element to measure exact text offsets - strictly inside isolated Shadow DOM
    const mirror = document.createElement('div');
    mirror.style.position = 'fixed';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.visibility = 'hidden';
    mirror.style.pointerEvents = 'none';
    mirror.style.opacity = '0';
    mirror.style.whiteSpace = input instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
    mirror.style.wordWrap = 'break-word';
    mirror.style.boxSizing = computed.boxSizing;
    mirror.style.width = `${input.clientWidth}px`;
    mirror.style.font = computed.font;
    mirror.style.fontFamily = computed.fontFamily;
    mirror.style.fontSize = computed.fontSize;
    mirror.style.fontWeight = computed.fontWeight;
    mirror.style.letterSpacing = computed.letterSpacing;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.style.padding = computed.padding;
    mirror.style.border = computed.border;
    this.host.overlayContainer.appendChild(mirror);
    this.mirrorDiv = mirror;

    const value = input.value;

    for (const correction of corrections) {
      const beforeText = value.substring(0, correction.offset);
      const targetText = value.substring(correction.offset, correction.offset + correction.length);

      mirror.textContent = beforeText;
      const span = document.createElement('span');
      span.textContent = targetText;
      mirror.appendChild(span);

      const spanRect = span.getBoundingClientRect();
      const mirrorRect = mirror.getBoundingClientRect();

      const relativeTop = spanRect.top - mirrorRect.top;
      const relativeLeft = spanRect.left - mirrorRect.left;

      // Adjust for input scroll
      const markerTop = rect.top + scrollY + relativeTop - input.scrollTop;
      const markerLeft = rect.left + scrollX + relativeLeft - input.scrollLeft;

      // Only show if inside input visible area
      if (
        markerTop >= rect.top + scrollY - 5 &&
        markerTop <= rect.bottom + scrollY + 5 &&
        markerLeft >= rect.left + scrollX - 5 &&
        markerLeft <= rect.right + scrollX + 5
      ) {
        const markerHeight = Math.max(spanRect.height, 18);
        const marker = this.createMarker(
          input,
          correction,
          markerLeft,
          markerTop,
          spanRect.width,
          markerHeight
        );
        this.markers.push(marker);
        this.host.overlayContainer.appendChild(marker);
      }
    }
  }

  private renderContentEditableUnderlines(
    element: HTMLElement,
    corrections: GrammarCorrection[]
  ): void {
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    for (const correction of corrections) {
      const range = this.createRangeFromOffsets(element, correction.offset, correction.offset + correction.length);
      if (range) {
        const rects = range.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i];
          if (rect.width > 0 && rect.height > 0) {
            const markerHeight = Math.max(rect.height, 18);
            const marker = this.createMarker(
              element,
              correction,
              rect.left + scrollX,
              rect.top + scrollY,
              rect.width,
              markerHeight
            );
            this.markers.push(marker);
            this.host.overlayContainer.appendChild(marker);
          }
        }
      }
    }
  }

  private createMarker(
    targetElement: HTMLElement,
    correction: GrammarCorrection,
    x: number,
    y: number,
    w: number,
    h: number
  ): HTMLElement {
    const marker = document.createElement('div');
    marker.className = `polyglot-error-marker ${correction.type === 'grammar' ? 'grammar-style' : ''}`;
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.width = `${Math.max(w, 8)}px`;
    marker.style.height = `${Math.max(h, 18)}px`;
    marker.title = `Suggestion: "${correction.corrected}" (Hover or click to view)`;
    (marker as any).__polyglotCorrection = correction;
    (marker as any).__polyglotTarget = targetElement;

    // Prevent input blur when clicking marker
    marker.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });

    const triggerPopup = () => {
      CorrectionPopup.show(
        correction,
        marker,
        targetElement || this.activeElement,
        () => {
          marker.remove();
          const index = this.markers.indexOf(marker);
          if (index !== -1) this.markers.splice(index, 1);
          if (this.statusBadge) {
            if (this.markers.length === 0) {
              this.statusBadge.classList.remove('has-errors');
              this.statusBadge.querySelector('span')!.textContent = 'Polyglot';
            } else {
              const lang = (this.statusBadge.getAttribute('data-lang') || 'EN').toUpperCase();
              this.statusBadge.querySelector('span')!.textContent = `${lang} • ${this.markers.length} issue${this.markers.length > 1 ? 's' : ''}`;
            }
          }
        },
        () => {
          this.removeMarkersForWord(correction.original);
        }
      );
    };

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      triggerPopup();
    });

    // Hover listener if autoPopupHover is true
    marker.addEventListener('mouseenter', () => {
      if (this.autoPopupHover) {
        this.clearHoverTimer();
        this.currentHoverMarker = marker;
        this.hoverTimer = setTimeout(() => {
          if (this.currentHoverMarker === marker) {
            triggerPopup();
          }
        }, 150);
      }
    });

    marker.addEventListener('mouseleave', () => {
      if (this.currentHoverMarker === marker) {
        this.clearHoverTimer();
        this.currentHoverMarker = null;
      }
    });

    return marker;
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.autoPopupHover || this.markers.length === 0) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    let hitMarker: HTMLElement | null = null;
    for (const marker of this.markers) {
      const b = marker.getBoundingClientRect();
      if (
        mouseX >= b.left - 2 &&
        mouseX <= b.right + 2 &&
        mouseY >= b.top - 2 &&
        mouseY <= b.bottom + 4
      ) {
        hitMarker = marker;
        break;
      }
    }

    if (hitMarker) {
      if (this.currentHoverMarker !== hitMarker) {
        this.clearHoverTimer();
        this.currentHoverMarker = hitMarker;
        this.hoverTimer = setTimeout(() => {
          if (this.currentHoverMarker === hitMarker && hitMarker) {
            hitMarker.click();
          }
        }, 150);
      }
    } else {
      if (this.currentHoverMarker) {
        this.clearHoverTimer();
        this.currentHoverMarker = null;
      }
    }
  }

  private attachScrollAndResizeListeners(): void {
    this.detachScrollAndResizeListeners();

    this.scrollListener = () => {
      this.repositionAll();
    };
    this.resizeListener = () => {
      this.repositionAll();
    };
    this.mouseMoveListener = (e: MouseEvent) => {
      this.handleMouseMove(e);
    };

    window.addEventListener('scroll', this.scrollListener, { passive: true });
    window.addEventListener('resize', this.resizeListener, { passive: true });
    if (this.activeElement) {
      this.activeElement.addEventListener('scroll', this.scrollListener, { passive: true });
      this.activeElement.addEventListener('mousemove', this.mouseMoveListener, { passive: true });
    }
  }

  private detachScrollAndResizeListeners(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      if (this.activeElement) {
        this.activeElement.removeEventListener('scroll', this.scrollListener);
      }
      this.scrollListener = null;
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }
    if (this.mouseMoveListener) {
      if (this.activeElement) {
        this.activeElement.removeEventListener('mousemove', this.mouseMoveListener);
      }
      this.mouseMoveListener = null;
    }
  }

  private repositionAll(): void {
    if (!this.activeElement || !document.contains(this.activeElement)) {
      this.clear();
      return;
    }
    const currentElem = this.activeElement;
    const currentCorrections = [...this.currentCorrections];
    this.setCorrections(currentElem, currentCorrections);
  }

  private createRangeFromOffsets(root: Node, start: number, end: number): Range | null {
    const doc = root.ownerDocument || document;
    const range = doc.createRange();
    let currentOffset = 0;
    let startSet = false;
    let endSet = false;

    function traverse(node: Node): boolean {
      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0;
        const nextOffset = currentOffset + textLength;

        if (!startSet && start >= currentOffset && start <= nextOffset) {
          range.setStart(node, start - currentOffset);
          startSet = true;
        }

        if (!endSet && end >= currentOffset && end <= nextOffset) {
          range.setEnd(node, end - currentOffset);
          endSet = true;
          return true;
        }

        currentOffset = nextOffset;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (traverse(node.childNodes[i])) return true;
        }
      }
      return false;
    }

    traverse(root);
    return startSet && endSet ? range : null;
  }
}
