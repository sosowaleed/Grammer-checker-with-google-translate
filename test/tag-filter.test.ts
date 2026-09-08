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

  it('returns true for password inputs and sensitive security autocomplete', () => {
    const pwdInput = document.createElement('input');
    pwdInput.type = 'password';
    expect(isElementIgnored(pwdInput)).toBe(true);
    expect(isEditableElement(pwdInput)).toBe(false);

    const newPwdInput = document.createElement('input');
    newPwdInput.type = 'text';
    newPwdInput.setAttribute('autocomplete', 'new-password');
    expect(isElementIgnored(newPwdInput)).toBe(true);
    expect(isEditableElement(newPwdInput)).toBe(false);

    const ccInput = document.createElement('input');
    ccInput.type = 'text';
    ccInput.setAttribute('autocomplete', 'cc-number');
    expect(isElementIgnored(ccInput)).toBe(true);
    expect(isEditableElement(ccInput)).toBe(false);
  });

  it('returns true for data-gramm="false"', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    div.setAttribute('data-gramm', 'false');

    expect(isElementIgnored(div)).toBe(true);
    expect(isEditableElement(div)).toBe(false);
  });

  it('allows standard textarea, text input, search input, email, and contenteditable', () => {
    const textarea = document.createElement('textarea');
    expect(isElementIgnored(textarea)).toBe(false);
    expect(isEditableElement(textarea)).toBe(true);

    const textInput = document.createElement('input');
    textInput.type = 'text';
    expect(isElementIgnored(textInput)).toBe(false);
    expect(isEditableElement(textInput)).toBe(true);

    // Normal search bar with autocomplete="off" should be allowed
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.setAttribute('autocomplete', 'off');
    expect(isElementIgnored(searchInput)).toBe(false);
    expect(isEditableElement(searchInput)).toBe(true);

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    expect(isElementIgnored(emailInput)).toBe(false);
    expect(isEditableElement(emailInput)).toBe(true);

    const editableDiv = document.createElement('div');
    editableDiv.contentEditable = 'true';
    expect(isElementIgnored(editableDiv)).toBe(false);
    expect(isEditableElement(editableDiv)).toBe(true);

    const roleTextbox = document.createElement('div');
    roleTextbox.setAttribute('role', 'textbox');
    expect(isElementIgnored(roleTextbox)).toBe(false);
    expect(isEditableElement(roleTextbox)).toBe(true);
  });

  it('ignores non-text input types like color, date, range, file', () => {
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    expect(isElementIgnored(colorInput)).toBe(true);
    expect(isEditableElement(colorInput)).toBe(false);

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    expect(isElementIgnored(dateInput)).toBe(true);
    expect(isEditableElement(dateInput)).toBe(false);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    expect(isElementIgnored(fileInput)).toBe(true);
    expect(isEditableElement(fileInput)).toBe(false);
  });
});
