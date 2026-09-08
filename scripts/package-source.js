import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve('.');
const distDir = path.resolve('dist');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const version = pkg.version || '1.0.8';

const sourceZip = path.join(distDir, `polyglot-grammar-source-v${version}.zip`);
const stagingDir = path.join(distDir, '.source-staging');

console.log(`Packaging PolyglotGrammar source code (v${version}) for Firefox AMO...`);

// Ensure dist exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Clean previous staging and zip
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
if (fs.existsSync(sourceZip)) {
  fs.unlinkSync(sourceZip);
}

fs.mkdirSync(stagingDir, { recursive: true });

// Files to copy from root
const rootFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'LICENSE',
  'README.md',
  'BUILD.md'
];

for (const file of rootFiles) {
  const src = path.join(rootDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(stagingDir, file));
  }
}

// Directories to copy recursively
function copyDir(src, dest, filterFn) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (filterFn && !filterFn(entry.name, srcPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, filterFn);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy src, public, test, scripts
copyDir(path.join(rootDir, 'src'), path.join(stagingDir, 'src'));
copyDir(path.join(rootDir, 'public'), path.join(stagingDir, 'public'));
copyDir(path.join(rootDir, 'test'), path.join(stagingDir, 'test'));
copyDir(path.join(rootDir, 'scripts'), path.join(stagingDir, 'scripts'), (name) => {
  // Only keep essential build scripts
  return ['build.js', 'package-zip.js', 'make-zip.ps1', 'package-source.js'].includes(name);
});

// Create zip archive
try {
  if (process.platform === 'win32') {
    const psScript = path.resolve('scripts/make-zip.ps1');
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScript}" -SrcDir "${stagingDir}" -DestZip "${sourceZip}"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd "${stagingDir}" && zip -r "${sourceZip}" .`, { stdio: 'inherit' });
  }

  // Clean staging
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const stats = fs.statSync(sourceZip);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  const sizeKB = (stats.size / 1024).toFixed(1);

  console.log(`\nSource archive created successfully!`);
  console.log(`Path: ${sourceZip}`);
  console.log(`Size: ${sizeKB} KB (${sizeMB} MB) [Max allowed: 200 MB]`);
} catch (err) {
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  console.error('Failed to package source:', err);
  process.exit(1);
}
