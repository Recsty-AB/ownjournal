/**
 * Applies a flat path -> value translation file to a locale JSON.
 * Only overwrites values where locale[path] === en[path] (i.e. currently English).
 * Usage: node scripts/apply-translations.js <locale> <translations.json>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

function getVal(obj, pathStr) {
  let cur = obj;
  for (const p of pathStr.split('.')) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setVal(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!(p in cur)) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function main() {
  const locale = process.argv[2];
  const translationsPath = process.argv[3];
  if (!locale || !translationsPath) {
    console.error('Usage: node apply-translations.js <locale> <translations.json>');
    process.exit(1);
  }
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
  const localeFile = locale === 'zh-TW' ? 'zh-TW.json' : locale + '.json';
const localePath = path.join(LOCALES_DIR, localeFile);
  const localeObj = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  const translations = JSON.parse(fs.readFileSync(path.resolve(translationsPath), 'utf8'));

  let applied = 0;
  for (const [pathStr, translatedVal] of Object.entries(translations)) {
    const enVal = getVal(en, pathStr);
    const localeVal = getVal(localeObj, pathStr);
    if (enVal !== undefined && localeVal === enVal && typeof enVal === 'string') {
      setVal(localeObj, pathStr, translatedVal);
      applied++;
    }
  }
  fs.writeFileSync(localePath, JSON.stringify(localeObj, null, 2) + '\n', 'utf8');
  console.log(`Applied ${applied} translations to ${localePath}`);
}

main();
