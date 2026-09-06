---
trigger: always_on
---

# Antigravity 2.0 Agent Rules: Polyglot Grammar Extension

## Manifest V3 Compatibility
- Do NOT use persistent background pages. Use event-driven background service workers.
- Maintain compatibility for both Firefox and Chrome:
  - In `manifest.json`, use standard WebExtension conventions or generate target-specific manifests (`manifest.chrome.json`, `manifest.firefox.json`).
  - Use `webextension-polyfill` (`browser.*` namespace) rather than raw `chrome.*` callbacks.
- Restrict host permissions to active tabs or `<all_urls>` strictly scoped to user text interactions.

## DOM Injection & Content Script Safety
- Never inject naked HTML/CSS directly into target document bodies.
- All extension UI elements (bubbles, markers, popups) MUST reside inside a closed or isolated open Shadow DOM container (`<grammar-checker-root>`).
- Respect non-editable tags: Ignore `code`, `pre`, `script`, `style`, password inputs, and elements with `autocomplete="off"` or `data-gramm="false"`.
- Implement selection preservation: When replacing text, use `document.execCommand('insertText')` or `InputEvent` dispatching to preserve undo/redo history (`Ctrl+Z`).

## Performance & Rate Limits
- Debounce all typing listeners by 400ms-600ms. Do not fire requests on keystroke.
- Check a local in-memory LRU cache before dispatching any translation/dictionary lookup.
- If an API request fails or is throttled, silently back off without blocking user typing.