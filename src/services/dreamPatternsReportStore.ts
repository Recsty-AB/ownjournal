/**
 * The latest Dream patterns report as stored on this device: the per-user
 * IndexedDB settings store, with no expiry. "Save as note" is how a user keeps
 * it across devices. It summarises dream content, so in an encrypted journal
 * it is stored encrypted with the journal's key and cannot be read before the
 * journal is unlocked.
 *
 * Kept apart from dreamService so that storageServiceV2 can convert the stored
 * report when the encryption mode changes without importing its own importer.
 */

import { getFromIndexedDB, saveToIndexedDB } from '@/utils/pwa';
import { arrayBufferToBase64, base64ToArrayBuffer, decryptData, encryptData } from '@/utils/encryption';
import { DREAM_PATTERNS_REPORT_KEY, type DreamPatternsReport, sanitizeDreamPatternsReport } from '@/types/dream';

interface EncryptedReport {
  ciphertext: string;
  iv: string;
}

const isEncryptedReport = (value: unknown): value is EncryptedReport =>
  !!value && typeof value === 'object' && typeof (value as EncryptedReport).ciphertext === 'string' &&
  typeof (value as EncryptedReport).iv === 'string';

async function readRaw(): Promise<unknown> {
  return (await getFromIndexedDB('settings', DREAM_PATTERNS_REPORT_KEY))?.value;
}

const writeRaw = (value: DreamPatternsReport | EncryptedReport) =>
  saveToIndexedDB('settings', { key: DREAM_PATTERNS_REPORT_KEY, value });

async function encryptReport(report: DreamPatternsReport, key: CryptoKey): Promise<EncryptedReport> {
  const { encrypted, iv } = await encryptData(JSON.stringify(report), key);
  return { ciphertext: arrayBufferToBase64(encrypted), iv: arrayBufferToBase64(iv) };
}

async function decryptReport(value: EncryptedReport, key: CryptoKey): Promise<DreamPatternsReport | null> {
  const text = await decryptData(base64ToArrayBuffer(value.ciphertext), key, base64ToArrayBuffer(value.iv));
  return sanitizeDreamPatternsReport(JSON.parse(text)) ?? null;
}

/**
 * @param key the journal's key, or null when there is none (no encryption, or locked)
 * @param e2e whether the journal is encrypted
 */
export async function readStoredPatternsReport(key: CryptoKey | null, e2e: boolean): Promise<DreamPatternsReport | null> {
  try {
    const value = await readRaw();
    if (isEncryptedReport(value)) return key ? await decryptReport(value, key) : null;
    const report = sanitizeDreamPatternsReport(value) ?? null;
    if (!e2e || !report) return report;
    // Left in the clear from before the journal was encrypted: never shown
    // while locked, and encrypted where it lies as soon as the key is there.
    if (!key) return null;
    await writeRaw(await encryptReport(report, key));
    return report;
  } catch {
    return null;
  }
}

export async function writeStoredPatternsReport(report: DreamPatternsReport, key: CryptoKey | null, e2e: boolean): Promise<void> {
  try {
    // Never stored unencrypted in an encrypted journal.
    if (e2e && !key) return;
    await writeRaw(e2e ? await encryptReport(report, key!) : report);
  } catch {
    // The report stays on screen; it just won't be there after a reload.
  }
}

/**
 * Follows the journal when its encryption mode changes, while the key is still
 * in memory: encrypted when the journal becomes encrypted, readable without a
 * key when it stops being so (the key is discarded right after).
 */
export async function convertStoredPatternsReport(key: CryptoKey, toEncrypted: boolean): Promise<void> {
  try {
    const value = await readRaw();
    if (toEncrypted) {
      const report = isEncryptedReport(value) ? null : sanitizeDreamPatternsReport(value);
      if (report) await writeRaw(await encryptReport(report, key));
    } else if (isEncryptedReport(value)) {
      const report = await decryptReport(value, key);
      if (report) await writeRaw(report);
    }
  } catch {
    // Not converted: an unencrypted report is encrypted the next time it is
    // read, and an encrypted one can no longer be read once the key is gone.
  }
}
