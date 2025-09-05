/**
 * Encryption mode storage utility
 * Manages user's choice between Simple (no password) and E2E Encrypted modes
 */

import { scopedKey } from './userScope';

export type EncryptionMode = 'simple' | 'e2e';

const ENCRYPTION_MODE_KEY = 'journalEncryptionMode';

/**
 * Get the current encryption mode
 * Default to 'simple' for easier onboarding
 */
export function getEncryptionMode(): EncryptionMode {
  const stored = localStorage.getItem(scopedKey(ENCRYPTION_MODE_KEY));
  if (stored === 'simple' || stored === 'e2e') {
    return stored;
  }
  return 'simple'; // Default to simple mode
}

/**
 * Set the encryption mode
 */
export function setEncryptionMode(mode: EncryptionMode): void {
  localStorage.setItem(scopedKey(ENCRYPTION_MODE_KEY), mode);
}

/**
 * Check if E2E encryption is enabled
 */
export function isE2EEnabled(): boolean {
  return getEncryptionMode() === 'e2e';
}

/**
 * Check if Simple mode is enabled (no encryption)
 */
export function isSimpleModeEnabled(): boolean {
  return getEncryptionMode() === 'simple';
}
