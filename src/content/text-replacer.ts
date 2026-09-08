/**
 * Preserves selection and native undo stack (Ctrl+Z)
 */
export class TextReplacer {
  /**
   * Replace text in HTMLInputElement or HTMLTextAreaElement
   */
  public static replaceInInput(
    element: HTMLInputElement | HTMLTextAreaElement,
    startOffset: number,
    endOffset: number,
    replacement: string,
    expectedOriginal?: string
  ): boolean {
    element.focus();

    if (element.readOnly || element.disabled) {
      return false;
    }

    const originalValue = element.value;
    let safeStart = Math.max(0, Math.min(startOffset, originalValue.length));
    let safeEnd = Math.max(safeStart, Math.min(endOffset, originalValue.length));

    // Dynamic offset realignment if expectedOriginal does not match current substring
    if (expectedOriginal && originalValue.substring(safeStart, safeEnd) !== expectedOriginal) {
      let bestIdx = -1;
      let minDistance = Infinity;
      let pos = originalValue.indexOf(expectedOriginal);
      while (pos !== -1) {
        const dist = Math.abs(pos - safeStart);
        if (dist < minDistance) {
          minDistance = dist;
          bestIdx = pos;
        }
        pos = originalValue.indexOf(expectedOriginal, pos + 1);
      }
      if (bestIdx !== -1) {
        safeStart = bestIdx;
        safeEnd = bestIdx + expectedOriginal.length;
      }
    }

    try {
      element.setSelectionRange(safeStart, safeEnd);
      const success = document.execCommand('insertText', false, replacement);
      if (success) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } catch {
      // fallback below
    }

    // Fallback 1: setRangeText + InputEvent
    try {
      element.setRangeText(replacement, safeStart, safeEnd, 'end');
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: replacement
        })
      );
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch {
      // fallback below
    }

    // Fallback 2: Direct value assignment
    try {
      element.value =
        originalValue.substring(0, safeStart) +
        replacement +
        originalValue.substring(safeEnd);
      const newPos = safeStart + replacement.length;
      element.selectionStart = newPos;
      element.selectionEnd = newPos;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Replace text in contenteditable element
   */
  public static replaceInContentEditable(
    element: HTMLElement,
    startOffset: number,
    endOffset: number,
    replacement: string
  ): boolean {
    element.focus();

    const range = this.createRangeFromOffsets(element, startOffset, endOffset);
    if (!range) return false;

    const selection = window.getSelection();
    if (!selection) return false;

    selection.removeAllRanges();
    selection.addRange(range);

    try {
      const success = document.execCommand('insertText', false, replacement);
      if (success) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    } catch {
      // fallback below
    }

    try {
      range.deleteContents();
      const textNode = document.createTextNode(replacement);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: replacement
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Replace current active text selection (e.g. from mouse highlight)
   */
  public static replaceActiveSelection(
    replacement: string,
    savedRange?: Range | null,
    savedInputTarget?: { element: HTMLInputElement | HTMLTextAreaElement; start: number; end: number } | null
  ): boolean {
    if (savedInputTarget && document.contains(savedInputTarget.element)) {
      const success = this.replaceInInput(
        savedInputTarget.element,
        savedInputTarget.start,
        savedInputTarget.end,
        replacement
      );
      if (success) {
        savedInputTarget.end = savedInputTarget.start + replacement.length;
        return true;
      }
    }

    // Check if savedRange is inside an editable element (contenteditable or role=textbox)
    if (savedRange) {
      const container = savedRange.commonAncestorContainer;
      const targetElem = container instanceof HTMLElement ? container : container.parentElement;
      let editableRoot: HTMLElement | null = null;
      if (targetElem) {
        if (targetElem.isContentEditable) {
          editableRoot = targetElem;
        } else {
          editableRoot = targetElem.closest<HTMLElement>(
            '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"], [contenteditable], [role="textbox"], [role="searchbox"]'
          );
        }
      }

      if (editableRoot && document.contains(editableRoot)) {
        editableRoot.focus();
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(savedRange);
        }

        try {
          const success = document.execCommand('insertText', false, replacement);
          if (success) {
            editableRoot.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        } catch {}

        try {
          savedRange.deleteContents();
          const textNode = document.createTextNode(replacement);
          savedRange.insertNode(textNode);
          savedRange.setStartAfter(textNode);
          savedRange.setEndAfter(textNode);
          editableRoot.dispatchEvent(
            new InputEvent('input', {
              bubbles: true,
              inputType: 'insertText',
              data: replacement
            })
          );
          return true;
        } catch {}
      }
    }

    // Check if active element is input or textarea
    const activeEl = document.activeElement;
    if (
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement
    ) {
      const start = activeEl.selectionStart ?? 0;
      const end = activeEl.selectionEnd ?? 0;
      return this.replaceInInput(activeEl, start, end, replacement);
    }

    if (savedRange) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
      }
      try {
        const success = document.execCommand('insertText', false, replacement);
        if (success) return true;
      } catch {}

      try {
        savedRange.deleteContents();
        const textNode = document.createTextNode(replacement);
        savedRange.insertNode(textNode);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  private static createRangeFromOffsets(
    root: Node,
    start: number,
    end: number
  ): Range | null {
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
          return true; // Finished
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
