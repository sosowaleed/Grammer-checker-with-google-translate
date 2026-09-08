import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const chromeDir = path.resolve('dist/chrome');
const firefoxDir = path.resolve('dist/firefox');

if (!fs.existsSync(chromeDir) || !fs.existsSync(firefoxDir)) {
  console.log('Build output not found. Running build first...');
  execSync('npm run build', { stdio: 'inherit' });
}

console.log('Packaging PolyglotGrammar extensions...');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const version = pkg.version || '1.1.0';

const chromeZip = path.join(distDir, `polyglot-grammar-chrome-v${version}.zip`);
const firefoxZip = path.join(distDir, `polyglot-grammar-firefox-v${version}.zip`);

// Delete old zips if exist
if (fs.existsSync(chromeZip)) fs.unlinkSync(chromeZip);
if (fs.existsSync(firefoxZip)) fs.unlinkSync(firefoxZip);

function createZip(srcDir, destZip) {
  if (fs.existsSync(destZip)) fs.unlinkSync(destZip);

  if (process.platform === 'win32') {
    const psScript = path.resolve('scripts/make-zip.ps1');
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScript}" -SrcDir "${srcDir}" -DestZip "${destZip}"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd "${srcDir}" && zip -r "${destZip}" .`, { stdio: 'inherit' });
  }
}

try {
  createZip(chromeDir, chromeZip);
  console.log(`Created Chrome package: ${chromeZip}`);

  createZip(firefoxDir, firefoxZip);
  console.log(`Created Firefox package: ${firefoxZip}`);

  console.log('\nPackaging complete! Zip files ready for Chrome Web Store and Firefox Add-ons.');
} catch (err) {
  console.error('Packaging failed:', err);
  process.exit(1);
}
