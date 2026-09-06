import { describe, it, expect } from 'vitest';
import { isElementIgnored, isEditableElement } from '../src/content/tag-filter';

describe('tag-filter', () => {
  it('returns true for ignored tags (CODE, PRE, SCRIPT, STYLE)', () => {
    const codeEl = document.createElement('code');
    const preEl = document.createElement('pre');
    const scriptEl = document.createElement('script');
    const styleEl = document.createElement('style');

    expect(isElementIgnored(codeEl)).toBe(true);
    expect(isElementIgnored(preEl)).toBe(true);
    expect(isElementIgnored(scriptEl)).toBe(true);
    expect(isElementIgnored(styleEl)).toBe(true);
  });

  it('returns true for password inputs and autocomplete="off"', () => {
    const pwdInput = document.createElement('input');
    pwdInput.type = 'password';
    expect(isElementIgnored(pwdInput)).toBe(true);
    expect(isEditableElement(pwdInput)).toBe(false);

    const autoOffInput = document.createElement('input');
    autoOffInput.type = 'text';
    autoOffInput.setAttribute('autocomplete', 'off');
    expect(isElementIgnored(autoOffInput)).toBe(true);
    expect(isEditableElement(autoOffInput)).toBe(false);
  });

  it('returns true for data-gramm="false"', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.setAttribute('data-gramm', 'false');

    expect(isElementIgnored(div)).toBe(true);
    expect(isEditableElement(div)).toBe(false);
  });

  it('allows standard textarea, text input, and contenteditable', () => {
    const textarea = document.createElement('textarea');
    expect(isElementIgnored(textarea)).toBe(false);
    expect(isEditableElement(textarea)).toBe(true);

    const textInput = document.createElement('input');
    textInput.type = 'text';
    expect(isElementIgnored(textInput)).toBe(false);
    expect(isEditableElement(textInput)).toBe(true);

    const editableDiv = document.createElement('div');
    editableDiv.contentEditable = 'true';
    expect(isElementIgnored(editableDiv)).toBe(false);
    expect(isEditableElement(editableDiv)).toBe(true);
  });
});
