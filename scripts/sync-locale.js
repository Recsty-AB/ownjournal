/**
 * Syncs a locale file to match en.json structure:
 * - Adds missing keys (from translations map or fallback to en)
 * - Removes keys not in en
 * - Optionally fixes confirmation keywords (DELETE, DELETE ALL, DELETE ACCOUNT) to stay in English
 *
 * Usage: node scripts/sync-locale.js <locale> [translations.json]
 * Example: node scripts/sync-locale.js nb scripts/translations-nb.json
 * If translations.json is omitted, missing keys get en value.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

// Keys that must keep literal English keywords (user types these)
// storage.confirmationRequiredDesc uses keyword "DELETE"; encryption uses "DELETE ALL" — not forced here so locale/translation can provide native wrapper
const CONFIRMATION_KEYWORDS = {
  'auth.deleteAccount.confirmLabel': 'Type DELETE ACCOUNT to confirm:',
  'encryption.confirmReset': 'Type DELETE to confirm',
  'encryption.confirmationRequiredDesc': 'Please type "DELETE ALL" to confirm.',
  'storage.typeToConfirm': 'Type "DELETE ALL" to confirm',
  'storage.typeDeleteToConfirm': 'Type "DELETE ALL" to confirm',
};

const LOCALES_FIX_KEYWORDS = ['zh', 'ko', 'pt', 'pl', 'nl', 'it', 'fr', 'de'];

function getLeafKeys(obj, prefix = '') {
  const out = {};
  for (const k of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, getLeafKeys(v, p));
    } else {
      out[p] = v;
    }
  }
  return out;
}

function setByPath(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function buildFromEn(enObj, localeObj, translations, enPath) {
  const result = {};
  for (const key of Object.keys(enObj)) {
    const fullPath = enPath ? `${enPath}.${key}` : key;
    const enVal = enObj[key];
    const localeVal = localeObj[key];

    if (enVal !== null && typeof enVal === 'object' && !Array.isArray(enVal)) {
      result[key] = buildFromEn(
        enVal,
        localeVal && typeof localeVal === 'object' ? localeVal : {},
        translations,
        fullPath
      );
    } else {
      // Enforce same type as en: if en has a string, use locale only if it's also a string (avoid copying nested objects from old locale structure)
      let value =
        typeof localeVal === typeof enVal && localeVal !== null && typeof localeVal !== 'object'
          ? localeVal
          : undefined;
      if (value === undefined) value = translations[fullPath];
      if (value === undefined) value = enVal;

      const localeId = path.basename(process.argv[2] || '', '.json');
      if (LOCALES_FIX_KEYWORDS.includes(localeId) && CONFIRMATION_KEYWORDS[fullPath]) {
        value = CONFIRMATION_KEYWORDS[fullPath];
      }
      result[key] = value;
    }
  }
  return result;
}

function main() {
  const locale = process.argv[2];
  const translationsPath = process.argv[3];
  if (!locale) {
    console.error('Usage: node sync-locale.js <locale> [translations.json]');
    process.exit(1);
  }

  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
  const localePath = path.join(LOCALES_DIR, locale === 'zh-TW' ? 'zh-TW.json' : `${locale}.json`);
  let localeObj = {};
  if (fs.existsSync(localePath)) {
    localeObj = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  }

  let translations = {};
  if (translationsPath && fs.existsSync(path.resolve(translationsPath))) {
    translations = JSON.parse(fs.readFileSync(path.resolve(translationsPath), 'utf8'));
  }

  const result = buildFromEn(en, localeObj, translations, '');
  fs.writeFileSync(localePath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log('Wrote', localePath);
}

main();
