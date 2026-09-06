import { describe, it, expect, vi } from 'vitest';
import { TextReplacer } from '../src/content/text-replacer';

describe('TextReplacer', () => {
  it('replaces text in textarea preserving value and dispatching events', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'This is a exampel of spelling';
    document.body.appendChild(textarea);

    const inputListener = vi.fn();
    textarea.addEventListener('input', inputListener);

    // Mock document.execCommand to test fallback
    document.execCommand = vi.fn().mockReturnValue(false);

    // Replace "exampel" (offset 10 to 17) with "example"
    const replaced = TextReplacer.replaceInInput(textarea, 10, 17, 'example');

    expect(replaced).toBe(true);
    expect(textarea.value).toBe('This is a example of spelling');
    expect(inputListener).toHaveBeenCalled();

    textarea.remove();
  });

  it('replaces text in contenteditable div', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.innerHTML = 'Hello wrld friend';
    document.body.appendChild(div);

    document.execCommand = vi.fn().mockReturnValue(false);

    // Replace "wrld" (offset 6 to 10) with "world"
    const replaced = TextReplacer.replaceInContentEditable(div, 6, 10, 'world');

    expect(replaced).toBe(true);
    expect(div.textContent).toContain('world');

    div.remove();
  });
});
