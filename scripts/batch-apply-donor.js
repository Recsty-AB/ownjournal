/**
 * For a target locale, build translations from a donor locale where donor[key] !== en[key].
 * Apply only where target[key] === en[key]. So we copy from donor to target for untranslated keys.
 * Usage: node scripts/batch-apply-donor.js <targetLocale> <donorLocale>
 * Example: node scripts/batch-apply-donor.js zh-TW zh
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

function keysFrom(obj, prefix = '') {
  const out = {};
  for (const k of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, keysFrom(v, p));
    } else {
      out[p] = v;
    }
  }
  return out;
}

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

const targetLocale = process.argv[2];
const donorLocale = process.argv[3];
if (!targetLocale || !donorLocale) {
  console.error('Usage: node batch-apply-donor.js <targetLocale> <donorLocale>');
  process.exit(1);
}

const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const targetFile = targetLocale === 'zh-TW' ? 'zh-TW.json' : targetLocale + '.json';
const donorFile = donorLocale === 'zh-TW' ? 'zh-TW.json' : donorLocale + '.json';
const targetPath = path.join(LOCALES_DIR, targetFile);
const donorPath = path.join(LOCALES_DIR, donorFile);
const targetObj = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const donorObj = JSON.parse(fs.readFileSync(donorPath, 'utf8'));

const enFlat = keysFrom(en);
const targetFlat = keysFrom(targetObj);
const donorFlat = keysFrom(donorObj);

let applied = 0;
for (const pathStr of Object.keys(enFlat)) {
  const enVal = enFlat[pathStr];
  if (typeof enVal !== 'string') continue;
  if (targetFlat[pathStr] !== enVal) continue;
  const donorVal = donorFlat[pathStr];
  if (donorVal != null && donorVal !== enVal) {
    setVal(targetObj, pathStr, donorVal);
    applied++;
  }
}
fs.writeFileSync(targetPath, JSON.stringify(targetObj, null, 2) + '\n', 'utf8');
console.log(`Applied ${applied} translations from ${donorLocale} to ${targetLocale}`);
