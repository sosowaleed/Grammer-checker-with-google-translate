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
    replacement: string
  ): boolean {
    element.focus();

    const originalValue = element.value;
    if (startOffset < 0 || endOffset > originalValue.length || startOffset > endOffset) {
      return false;
    }

    try {
      element.setSelectionRange(startOffset, endOffset);
      const success = document.execCommand('insertText', false, replacement);
      if (success) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    } catch {
      // fallback below
    }

    // Fallback: setRangeText + InputEvent
    try {
      element.setRangeText(replacement, startOffset, endOffset, 'end');
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
    savedRange?: Range | null
  ): boolean {
    const selection = window.getSelection();
    if (savedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
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

    try {
      const success = document.execCommand('insertText', false, replacement);
      if (success) return true;
    } catch {
      // fallback
    }

    if (savedRange) {
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
