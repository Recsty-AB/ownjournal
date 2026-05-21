#!/usr/bin/env node
/**
 * Locale terminology consistency auditor.
 *
 * For each "concept" (export, import, sync, backup, ...), we know the set of
 * en.json key paths that express it. Within a single locale, that concept
 * should be translated with ONE consistent term — not a mix of, say, a katakana
 * loanword in some keys and a native verb in others.
 *
 * Detection is driven by CANDIDATES[lang][concept] = [familyA, familyB, ...],
 * where each family is an array of equivalent surface forms (e.g. a native
 * verb + its noun inflection, which are NOT a real inconsistency). A locale is
 * flagged only when 2+ distinct *families* appear across a concept's keys
 * (e.g. a katakana loanword family AND a native family). Languages that only
 * ever use one cognate root (most European ones) have no entry and can't be
 * flagged.
 *
 * Usage: node scripts/audit-locale-terms.mjs
 * Exit code 1 if any inconsistency is found (usable in CI).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');

/** Map an en.json leaf to a concept by key-name segment or English value. */
function conceptOf(keyName, enValue) {
  const k = keyName.toLowerCase();
  const v = (enValue || '').toLowerCase();
  if (/export/.test(k) || /\bexport/.test(v)) return 'export';
  if (/import/.test(k) || /\bimport(?!ant)/.test(v)) return 'import';
  return null;
}

// Competing term FAMILIES per language. Each family is a list of equivalent
// surface forms (inflections of the same root); only distinct families count
// as an inconsistency. e.g. Finnish native [vie, vienti] is one family, the
// loanword [eksport] another.
const CANDIDATES = {
  ja: { export: [['エクスポート'], ['書き出'], ['抽出']], import: [['インポート'], ['読み込'], ['取り込']] },
  ko: { export: [['내보내기'], ['익스포트', '엑스포트']], import: [['가져오기'], ['임포트']] },
  zh: { export: [['导出'], ['输出']], import: [['导入'], ['输入'], ['引入']] },
  'zh-TW': { export: [['匯出'], ['輸出']], import: [['匯入'], ['輸入'], ['引入']] },
  fi: { export: [['vie', 'vienti', 'viedä'], ['eksport']], import: [['tuo', 'tuonti', 'tuoda'], ['importoi', 'import']] },
};

function flatten(obj, path, out) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const p = path ? `${path}.${k}` : k;
    if (typeof v === 'string') out.push([p, k, v]);
    else if (v && typeof v === 'object') flatten(v, p, out);
  }
}

const en = JSON.parse(readFileSync(join(LOCALES_DIR, 'en.json'), 'utf8'));
const enLeaves = [];
flatten(en, '', enLeaves);

// concept -> [keyPath]
const conceptKeys = { export: [], import: [] };
for (const [p, k, v] of enLeaves) {
  const c = conceptOf(k, v);
  if (c) conceptKeys[c].push(p);
}

const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));

let flagged = 0;
for (const file of files.sort()) {
  const lang = file.replace('.json', '');
  const cand = CANDIDATES[lang];
  if (!cand) continue; // single-cognate language: nothing to flag
  const data = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8'));
  for (const concept of ['export', 'import']) {
    const families = cand[concept];
    if (!families) continue;
    const found = new Map(); // family label -> Set(keyPaths)
    for (const p of conceptKeys[concept]) {
      const val = get(data, p);
      if (typeof val !== 'string') continue;
      for (const family of families) {
        if (family.some((form) => val.includes(form))) {
          const label = family.join('/');
          if (!found.has(label)) found.set(label, new Set());
          found.get(label).add(p);
        }
      }
    }
    if (found.size > 1) {
      flagged++;
      console.log(`\n⚠️  ${lang} / ${concept}: ${found.size} competing term families`);
      for (const [label, paths] of found) {
        const arr = [...paths];
        console.log(`    "${label}" in ${arr.length} key(s): ${arr.slice(0, 6).join(', ')}${arr.length > 6 ? ', …' : ''}`);
      }
    }
  }
}

if (flagged === 0) {
  console.log('✓ No export/import terminology inconsistencies across locales.');
  process.exit(0);
} else {
  console.log(`\n${flagged} inconsistency group(s) found.`);
  process.exit(1);
}
