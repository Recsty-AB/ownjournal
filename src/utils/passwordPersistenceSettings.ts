/**
 * Password persistence settings utility
 * Manages user preferences for how the journal password is stored
 */

import { scopedKey } from './userScope';

export type PasswordPersistenceMode = 'localStorage' | 'sessionStorage' | 'none';

const SETTINGS_KEY = 'ownjournal_password_persistence_mode';

/**
 * Get the current password persistence mode
 * Default: localStorage (for backward compatibility and seamless UX)
 */
export function getPasswordPersistenceMode(): PasswordPersistenceMode {
  const stored = localStorage.getItem(scopedKey(SETTINGS_KEY));
  if (stored === 'sessionStorage' || stored === 'none') {
    return stored;
  }
  return 'localStorage'; // Default for backward compatibility
}

/**
 * Set the password persistence mode
 * Note: Changing this does NOT automatically clear existing stored passwords
 */
export function setPasswordPersistenceMode(mode: PasswordPersistenceMode): void {
  localStorage.setItem(scopedKey(SETTINGS_KEY), mode);
  console.log(`🔐 Password persistence mode set to: ${mode}`);
}

/**
 * Check if password should be persisted at all
 */
export function shouldPersistPassword(): boolean {
  return getPasswordPersistenceMode() !== 'none';
}

/**
 * Check if password should persist across browser restarts
 */
export function shouldPersistAcrossSessions(): boolean {
  return getPasswordPersistenceMode() === 'localStorage';
}
