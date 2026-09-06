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

  constructor() {
    this.host = ShadowRootHost.getInstance();
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

  private renderStatusBadge(
    element: HTMLElement,
    errorCount: number,
    detectedLang: string
  ): void {
    const rect = element.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    const badge = document.createElement('div');
    badge.className = `polyglot-status-badge ${errorCount > 0 ? 'has-errors' : ''}`;

    badge.style.left = `${rect.right + scrollX - 85}px`;
    badge.style.top = `${rect.bottom + scrollY - 30}px`;

    badge.innerHTML = `
      <div class="badge-dot"></div>
      <span>${errorCount > 0 ? `${errorCount} issue${errorCount > 1 ? 's' : ''}` : 'Polyglot'}</span>
    `;

    badge.title = `PolyglotGrammar: ${
      errorCount > 0 ? `${errorCount} grammar/spelling issues detected` : 'No errors detected'
    } (${detectedLang.toUpperCase()})`;

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      if (errorCount > 0 && this.markers.length > 0) {
        // Trigger click on first marker
        this.markers[0].click();
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

    // Create mirror element to measure exact text offsets
    const mirror = document.createElement('div');
    mirror.style.position = 'absolute';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.visibility = 'hidden';
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
    document.body.appendChild(mirror);
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
        markerTop >= rect.top + scrollY &&
        markerTop <= rect.bottom + scrollY &&
        markerLeft >= rect.left + scrollX &&
        markerLeft <= rect.right + scrollX
      ) {
        const marker = this.createMarker(correction, markerLeft, markerTop + spanRect.height - 4, spanRect.width, 4);
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
            const marker = this.createMarker(
              correction,
              rect.left + scrollX,
              rect.bottom + scrollY - 3,
              rect.width,
              4
            );
            this.markers.push(marker);
            this.host.overlayContainer.appendChild(marker);
          }
        }
      }
    }
  }

  private createMarker(
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
    marker.style.height = `${Math.max(h, 4)}px`;

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      CorrectionPopup.show(correction, marker, this.activeElement, () => {
        // When correction is accepted, re-evaluate or remove this marker
        marker.remove();
        const index = this.markers.indexOf(marker);
        if (index !== -1) this.markers.splice(index, 1);
        if (this.markers.length === 0 && this.statusBadge) {
          this.statusBadge.classList.remove('has-errors');
          this.statusBadge.querySelector('span')!.textContent = 'Polyglot';
        }
      });
    });

    return marker;
  }

  private attachScrollAndResizeListeners(): void {
    this.detachScrollAndResizeListeners();

    this.scrollListener = () => {
      this.repositionAll();
    };
    this.resizeListener = () => {
      this.repositionAll();
    };

    window.addEventListener('scroll', this.scrollListener, { passive: true });
    window.addEventListener('resize', this.resizeListener, { passive: true });
    if (this.activeElement) {
      this.activeElement.addEventListener('scroll', this.scrollListener, { passive: true });
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
