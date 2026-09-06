# PolyglotGrammar 🌐✍️

> **Manifest V3 Cross-Browser Extension** for real-time grammar checking as you type, contextual synonym exploration on highlighted words, and instant multilingual translation across 130+ languages powered by Google Translate.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-6366f1.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Chrome](https://img.shields.io/badge/Browser-Chrome-4285F4.svg)](https://www.google.com/chrome/)
[![Firefox](https://img.shields.io/badge/Browser-Firefox-FF7139.svg)](https://www.mozilla.org/firefox/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Bundler-Vite%206-646CFF.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-Vitest%20Passed-10b981.svg)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Features

- **⚡ Real-Time Grammar & Spell Checking**: Debounces typing events ($450\text{ ms}$) on standard inputs (`<textarea>`, `<input type="text">`, `<input type="search">`) and rich text editors (`[contenteditable="true"]`). Highlights detected grammatical anomalies or spelling typos with inline visual squiggly indicators.
- **🔍 Instant Synonym Explorer**: Detects double-click or drag-to-highlight text selections, resolves the word against Google Translate's thesaurus (`dt=ss`) and dictionary definitions (`dt=bd`), and displays a floating popup showing synonyms grouped by Part-of-Speech tags with one-click text replacement.
- **🌍 Full Multilingual Support (130+ Languages)**: Dynamically passes `sl=auto` (auto-detect) across all Google Translate supported languages, automatically adapting suggestions without requiring manual language toggling.
- **🔄 Multilingual Sentence Translation**: Translates highlighted phrases or full sentences with a target language selector, an undo-safe **Replace** button (`document.execCommand('insertText')`), and a **Copy** button.
- **🛡️ Isolated Shadow DOM**: Mounts all tooltips, underlines, badges, and popups inside an isolated Shadow Root container (`<grammar-checker-root>`) with Open mode, preventing any host page CSS collisions or style leakage.
- **⏪ Undo Stack Preservation**: Replaces mistakes while strictly preserving the browser's native `Ctrl+Z` undo/redo history.
- **🔒 Tag & Privacy Safety**: Ignores sensitive inputs (`input[type="password"]`), `code`, `pre`, `script`, `style`, and elements marked with `autocomplete="off"` or `data-gramm="false"`.
- **⚡ In-Memory LRU Cache**: Checks an in-memory LRU cache backed by `chrome.storage.session` / `browser.storage.local` before dispatching any network lookup to avoid rate limits and duplicate queries.
- **🎨 Sleek Dashboard Popup**: Modern glassmorphic interface allowing users to toggle extension status, select preferred fallback languages, manage ignored domains, view real-time statistics, and test phrases in a live playground.

---

## 🏛️ Architecture

```mermaid
graph TD
    subgraph HostWebPage ["Target Web Page"]
        Input["textarea / input / contenteditable"]
        Selection["User Selected Text"]
    end

    subgraph ShadowDOM ["Shadow DOM (<grammar-checker-root>)"]
        Overlay["Non-destructive Overlay Layer"]
        Squiggly["Squiggly Underlines & Badges"]
        PopCheck["Correction Popover"]
        PopSyn["Synonym Explorer (Part-of-speech tabs)"]
        PopTrans["Multilingual Translation Modal"]
    end

    subgraph ContentScript ["Content Script (IIFE Standalone)"]
        Observer["Typing Observer (450ms Debounced)"]
        SelectionListener["Selection Listener (mouseup/selectionchange)"]
        UndoPreserver["Undo History Preserver (execCommand / InputEvent)"]
        TagFilter["Tag Exclusions (code, pre, password, etc.)"]
    end

    subgraph BackgroundWorker ["Background Service Worker (MV3)"]
        Router["Message Router"]
        LRUCache["In-Memory LRU Cache + Storage"]
        GTClient["Google Translate Integration Engine"]
        ContextMenu["Context Menu Actions"]
    end

    Input -->|debounced 450ms| Observer
    Observer --> TagFilter
    TagFilter -->|browser.runtime.sendMessage| Router
    Selection --> SelectionListener
    SelectionListener --> Router
    Router --> LRUCache
    LRUCache --> GTClient
    GTClient --> Router
    Router --> ContentScript
    ContentScript --> ShadowDOM
    PopCheck --> UndoPreserver
    PopSyn --> UndoPreserver
    PopTrans --> UndoPreserver
    UndoPreserver --> Input
```

---

## 🚀 Installation & Getting Started

### Prerequisites
- Node.js 18+ & npm

### 1. Clone & Install
```bash
git clone https://github.com/your-username/polyglot-grammar.git
cd polyglot-grammar
npm install
```

### 2. Build for Chrome & Firefox
```bash
# Build both Chrome and Firefox distributions
npm run build

# Or build individually
npm run build:chrome
npm run build:firefox
```

The output will be generated in `dist/chrome` and `dist/firefox`.

---

## 📦 Loading into Browsers

### Google Chrome / Chromium / Edge / Brave
1. Open `chrome://extensions/` in your browser.
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the `dist/chrome` directory from this repository.

### Mozilla Firefox
1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on...**
3. Select `dist/firefox/manifest.json`.

---

## 🧪 Testing

Run the automated test suite powered by Vitest:
```bash
npm test
```

### Running the Interactive Test Harness
Launch the local test server to interact with the demo page and test fixtures:
```bash
node scripts/serve-test.js
```
Then navigate to [http://localhost:5173/](http://localhost:5173/) to test proofreading, synonym discovery, and sentence translation live.

---

## 📁 Project Structure

```
├── .github/workflows/ci.yml       # GitHub Actions CI pipeline
├── public/icons/                  # Extension PNG icons (16px, 48px, 128px)
├── scripts/
│   ├── build.js                   # Universal dual-target build script
│   ├── generate-icons.js          # Pure Node PNG icon generator
│   └── serve-test.js              # Local test server with API proxy
├── src/
│   ├── assets/                    # Vector assets (SVG)
│   ├── background/
│   │   ├── google-translate.ts    # Google Translate query correction & synonym service
│   │   ├── index.ts               # Manifest V3 service worker & message router
│   │   └── lru-cache.ts           # Fast LRU cache with session storage persistence
│   ├── content/
│   │   ├── correction-popup.ts    # Isolated error popover & suggestion card
│   │   ├── index.ts               # Content script entry & debounced typing observer
│   │   ├── overlay-manager.ts     # Squiggly underline coordinates & status badges
│   │   ├── selection-popup.ts     # Floating pill, thesaurus & translation modal
│   │   ├── shadow-root.ts         # Isolated Shadow DOM container & stylesheet
│   │   ├── tag-filter.ts          # Non-editable tag & safety filtering
│   │   └── text-replacer.ts       # Native undo/redo (Ctrl+Z) text replacement
│   ├── popup/
│   │   ├── index.html             # Dashboard UI with dark glassmorphism
│   │   └── index.ts               # Dashboard settings, stats & playground logic
│   ├── shared/
│   │   ├── languages.ts           # 130+ Google Translate languages registry
│   │   └── types.ts               # Data contracts & message definitions
│   ├── manifest.chrome.json       # Chrome MV3 manifest (service worker)
│   └── manifest.firefox.json      # Firefox MV3 manifest (background scripts + gecko)
├── test/
│   ├── fixtures/demo-page.html    # Interactive browser test page
│   ├── google-translate.test.ts   # HTML query correction parser unit tests
│   ├── languages.test.ts          # Language registry unit tests
│   ├── lru-cache.test.ts          # Cache eviction unit tests
│   ├── tag-filter.test.ts         # Tag filtering unit tests
│   └── text-replacer.test.ts      # Undo-safe text insertion tests
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
