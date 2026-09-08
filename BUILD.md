# PolyglotGrammar - Extension Build Instructions

This document provides step-by-step instructions for Mozilla Add-ons (AMO) reviewers to reproduce the exact `polyglot-grammar-firefox-v1.0.7.zip` package from this source code.

---

## 1. System Requirements

* **Operating System**: Platform independent (Linux, macOS, or Windows)
* **Node.js**: `v18.0.0` or higher (tested on `v20.x` and `v22.13.0`)
  * Download: [https://nodejs.org/](https://nodejs.org/)
* **npm**: `v9.0.0` or higher (bundled with Node.js)

---

## 2. Tools & Build Process Overview

PolyglotGrammar is written in TypeScript and uses:
- **Vite 6 / Rollup**: Bundles the modular TypeScript code into standalone, self-contained IIFE scripts (`background.js`, `content.js`, `popup.js`) compatible with Firefox Manifest V3.
- **TypeScript 5.7**: Type checking and compilation.
- **webextension-polyfill**: Ensures cross-browser WebExtension API standards.

No external obfuscation or proprietary code generators are used.

---

## 3. Step-by-Step Reproduction Instructions

### Step 1: Extract and navigate to project directory
Open a terminal in the root directory of this unzipped source code:
```bash
cd polyglot-grammar
```

### Step 2: Install dependencies
Install the exact locked dependencies using npm:
```bash
npm ci
```
*(Or `npm install` if `npm ci` is not preferred)*

### Step 3: Execute the Firefox build script
Run the dedicated Firefox build script:
```bash
npm run build:firefox
```
This executes `node scripts/build.js firefox` which:
1. Compiles and bundles `src/popup/` to `dist/firefox/popup.js` and `dist/firefox/popup.html`.
2. Compiles and bundles `src/content/` to standalone `dist/firefox/content.js`.
3. Compiles and bundles `src/background/` to standalone `dist/firefox/background.js`.
4. Copies `src/manifest.firefox.json` to `dist/firefox/manifest.json`.
5. Copies extension icons from `public/icons/` to `dist/firefox/icons/`.

### Step 4: Verify the build output
The compiled extension files are located in `dist/firefox/`:
```
dist/firefox/
├── manifest.json
├── background.js
├── content.js
├── popup.js
├── popup.html
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    ├── icon96.png
    └── icon128.png
```

### Step 5: (Optional) Create the distribution zip package
To produce the exact `.zip` package submitted to AMO:
```bash
npm run pack
```
The output zip archive will be generated at:
```
dist/polyglot-grammar-firefox-v1.0.7.zip
```

---

## 4. Running Unit Tests

To verify all test suites (40 tests across 8 test suites):
```bash
npm test
```
All tests should pass.
