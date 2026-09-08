const IGNORED_TAGS = new Set([
  'CODE',
  'PRE',
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'OBJECT',
  'EMBED',
  'IFRAME'
]);

const IGNORED_INPUT_TYPES = new Set([
  'password',
  'hidden',
  'file',
  'checkbox',
  'radio',
  'submit',
  'reset',
  'button',
  'image',
  'range',
  'color',
  'date',
  'time',
  'datetime-local',
  'number'
]);

const SENSITIVE_AUTOCOMPLETE_VALUES = new Set([
  'new-password',
  'current-password',
  'one-time-code',
  'cc-number',
  'cc-csc',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-type'
]);

export function isElementIgnored(el: HTMLElement | null): boolean {
  if (!el) return true;

  // Inside our own extension Shadow DOM or container
  if (el.tagName === 'GRAMMAR-CHECKER-ROOT' || el.closest('grammar-checker-root')) {
    return true;
  }

  // Tag name check
  if (IGNORED_TAGS.has(el.tagName)) {
    return true;
  }

  // Input type check
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    if (IGNORED_INPUT_TYPES.has(type)) {
      return true;
    }
  }

  // Sensitive security autocomplete check (passwords, PINs, 2FA, credit cards)
  const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
  if (SENSITIVE_AUTOCOMPLETE_VALUES.has(autocomplete)) {
    return true;
  }

  // Explicit grammar disable flags
  if (
    el.getAttribute('data-gramm') === 'false' ||
    el.getAttribute('data-enable-grammarly') === 'false' ||
    el.getAttribute('spellcheck') === 'false'
  ) {
    return true;
  }

  // Read-only or disabled input/textarea or aria-disabled elements
  if (
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
    (el.readOnly || el.disabled)
  ) {
    return true;
  }
  if (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-readonly') === 'true') {
    return true;
  }

  // Ancestor check for ignored containers
  let parent = el.parentElement;
  while (parent) {
    if (IGNORED_TAGS.has(parent.tagName)) return true;
    if (parent.getAttribute('data-gramm') === 'false') return true;
    if (parent.classList.contains('notranslate')) return true;
    parent = parent.parentElement;
  }

  return false;
}

export function isEditableElement(el: HTMLElement | null): boolean {
  if (!el || isElementIgnored(el)) return false;

  if (el instanceof HTMLTextAreaElement) return true;

  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    return !IGNORED_INPUT_TYPES.has(type);
  }

  if (el.isContentEditable) return true;

  const contentEditableAttr = (el.getAttribute('contenteditable') || '').toLowerCase();
  if (contentEditableAttr === 'true' || contentEditableAttr === '') return true;

  const role = (el.getAttribute('role') || '').toLowerCase();
  if (role === 'textbox' || role === 'searchbox') return true;

  // Check if inside a contenteditable or role=textbox parent
  if (el.closest('[contenteditable="true"], [role="textbox"]') !== null) {
    return true;
  }

  return false;
}
