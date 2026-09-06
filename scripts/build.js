import { build } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

const target = process.argv[2] === 'firefox' ? 'firefox' : 'chrome';
const outDir = resolve(`dist/${target}`);

async function runBuild() {
  console.log(`Building PolyglotGrammar for ${target.toUpperCase()}...`);

  // 1. Build Popup
  await build({
    configFile: false,
    root: resolve('src/popup'),
    base: '',
    build: {
      outDir: outDir,
      emptyOutDir: true,
      rollupOptions: {
        input: resolve('src/popup/index.html'),
        output: {
          entryFileNames: 'popup.js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    }
  });

  // Move index.html from root if needed
  if (fs.existsSync(resolve(outDir, 'index.html'))) {
    fs.renameSync(resolve(outDir, 'index.html'), resolve(outDir, 'popup.html'));
  }

  // 2. Build Content Script as standalone IIFE (no imports, works 100% in content_scripts)
  await build({
    configFile: false,
    build: {
      outDir: outDir,
      emptyOutDir: false,
      lib: {
        entry: resolve('src/content/index.ts'),
        name: 'PolyglotContent',
        formats: ['iife'],
        fileName: () => 'content.js'
      },
      rollupOptions: {
        output: {
          extend: true
        }
      }
    }
  });

  // 3. Build Background Script as standalone IIFE (universal for Chrome service worker & Firefox scripts)
  await build({
    configFile: false,
    build: {
      outDir: outDir,
      emptyOutDir: false,
      lib: {
        entry: resolve('src/background/index.ts'),
        name: 'PolyglotBackground',
        formats: ['iife'],
        fileName: () => 'background.js'
      },
      rollupOptions: {
        output: {
          extend: true
        }
      }
    }
  });

  // 4. Copy Manifest
  const manifestSource =
    target === 'firefox'
      ? resolve('src/manifest.firefox.json')
      : resolve('src/manifest.chrome.json');
  fs.copyFileSync(manifestSource, resolve(outDir, 'manifest.json'));
  console.log(`Copied ${target} manifest to ${outDir}/manifest.json`);

  // 5. Copy Icons
  const iconsDest = resolve(outDir, 'icons');
  fs.mkdirSync(iconsDest, { recursive: true });
  for (const size of [16, 48, 128]) {
    const srcIcon = resolve(`public/icons/icon${size}.png`);
    if (fs.existsSync(srcIcon)) {
      fs.copyFileSync(srcIcon, resolve(iconsDest, `icon${size}.png`));
    }
  }

  console.log(`Build for ${target.toUpperCase()} complete in ${outDir}`);
}

runBuild().catch((err) => {
  console.error(err);
  process.exit(1);
});
