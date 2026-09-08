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

  it('replaces active selection using savedInputTarget when focus was shifted to popup', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'I has an error here';
    document.body.appendChild(input);

    // Simulate focus shifted away to a popup button
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    document.execCommand = vi.fn().mockReturnValue(false);

    // Target "has" at index 2..5
    const savedInputTarget = {
      element: input,
      start: 2,
      end: 5
    };

    const replaced = TextReplacer.replaceActiveSelection('have', null, savedInputTarget);
    expect(replaced).toBe(true);
    expect(input.value).toBe('I have an error here');
    expect(savedInputTarget.end).toBe(6); // 2 + 4 ("have".length)

    input.remove();
    button.remove();
  });

  it('rejects replace on truly read-only or disabled input', () => {
    const input = document.createElement('input');
    input.readOnly = true;
    input.value = 'Static content';
    document.body.appendChild(input);

    const savedInputTarget = {
      element: input,
      start: 0,
      end: 6
    };

    const replaced = TextReplacer.replaceActiveSelection('Dynamic', null, savedInputTarget);
    expect(replaced).toBe(false);
    expect(input.value).toBe('Static content');

    input.remove();
  });
});
