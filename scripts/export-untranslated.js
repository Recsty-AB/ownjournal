/**
 * Exports keys where locale value === en value to a JSON file.
 * Usage: node scripts/export-untranslated.js <locale>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');

const SKIP_KEYS = new Set([
  'app.name', 'auth.emailPlaceholder', 'auth.passwordPlaceholder',
  'storage.googleDrive', 'storage.dropbox', 'storage.icloud',
  'providers.googleDrive.title', 'providers.dropbox.title', 'providers.nextcloud.title', 'providers.icloud.title',
  'common.plus', 'storage.googleDevInstructions', 'storage.dropboxDevInstructions',
  'providers.googleDrive.devModeDesc', 'providers.dropbox.devModeDesc',
  'storage.typeToConfirm', 'storage.typeDeleteToConfirm', 'storage.confirmationRequiredDesc',
  'encryption.typeToConfirm', 'encryption.typeDeleteToConfirm', 'encryption.confirmationRequiredDesc',
  'encryption.confirmReset', 'auth.deleteAccount.confirmLabel',
  'nextcloud.serverUrlPlaceholder', 'nextcloud.usernamePlaceholder', 'nextcloud.appPasswordPlaceholder',
  'providers.nextcloud.serverUrlPlaceholder', 'providers.nextcloud.usernamePlaceholder', 'providers.nextcloud.appPasswordPlaceholder',
  'providers.icloud.containerIdPlaceholder',
  'syncHealth.lessThan10', 'notFound.title',
  'onboarding.storage.googleDrive', 'onboarding.storage.dropbox', 'onboarding.storage.nextcloud',
  'help.sections.proBadge', 'help.support.email.address',
  'company.name', 'company.email', 'company.supervisoryAuthorityUrl', 'company.supervisoryAuthority',
  'nextcloudHelp.letsEncryptSetup',
  'features.zeroKnowledge', 'export.tags', 'journalEntry.moods.okay', 'journalEntry.tags',
  'providers.nextcloud.server', 'syncStatus.offline', 'syncHealth.auto', 'syncDiagnostics.auto',
  'syncHealth.severity.info', 'syncDiagnostics.details', 'syncDiagnostics.types.circuit_breaker',
  'help.tabs.faq',
  'common.contact', 'header.help', 'features.endToEnd', 'settings.tabs.account',
  'syncHealth.per100Syncs', 'syncDiagnostics.open', 'help.faq.path.step2', 'legal.terms.contact.title',
]);

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

const locale = process.argv[2];
if (!locale) {
  console.error('Usage: node export-untranslated.js <locale>');
  process.exit(1);
}

const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const localeFile = locale === 'zh-TW' ? 'zh-TW.json' : locale + '.json';
const localePath = path.join(LOCALES_DIR, localeFile);
const localeObj = JSON.parse(fs.readFileSync(localePath, 'utf8'));

const enFlat = keysFrom(en);
const locFlat = keysFrom(localeObj);
const untranslated = {};
for (const [key, enVal] of Object.entries(enFlat)) {
  if (SKIP_KEYS.has(key)) continue;
  if (typeof enVal !== 'string') continue;
  if (enVal.length < 3) continue;
  if (locFlat[key] === enVal) untranslated[key] = enVal;
}

const outPath = path.join(__dirname, `untranslated-${locale}.json`);
fs.writeFileSync(outPath, JSON.stringify(untranslated, null, 2), 'utf8');
console.log(`${locale}: ${Object.keys(untranslated).length} untranslated keys -> ${outPath}`);
