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

try {
  if (process.platform === 'win32') {
    // Windows PowerShell Compress-Archive
    execSync(
      `powershell -Command "Compress-Archive -Path '${chromeDir}\\*' -DestinationPath '${chromeZip}' -Force"`,
      { stdio: 'inherit' }
    );
    console.log(`Created Chrome package: ${chromeZip}`);

    execSync(
      `powershell -Command "Compress-Archive -Path '${firefoxDir}\\*' -DestinationPath '${firefoxZip}' -Force"`,
      { stdio: 'inherit' }
    );
    console.log(`Created Firefox package: ${firefoxZip}`);
  } else {
    // Unix zip command
    execSync(`cd "${chromeDir}" && zip -r "${chromeZip}" .`, { stdio: 'inherit' });
    console.log(`Created Chrome package: ${chromeZip}`);

    execSync(`cd "${firefoxDir}" && zip -r "${firefoxZip}" .`, { stdio: 'inherit' });
    console.log(`Created Firefox package: ${firefoxZip}`);
  }
  console.log('\nPackaging complete! Zip files ready for Chrome Web Store and Firefox Add-ons.');
} catch (err) {
  console.error('Packaging failed:', err);
  process.exit(1);
}
