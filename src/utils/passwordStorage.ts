/**
 * Secure password storage utility
 * Encrypts password before storing in localStorage or sessionStorage
 * Uses a device-specific key for encryption
 * 
 * Security model:
 * - Password is encrypted with AES-GCM using a device-specific key
 * - User can choose persistence mode: localStorage, sessionStorage, or none
 * - XSS risk is LOW due to React's built-in JSX escaping
 * - Main risk is shared devices or malicious browser extensions
 * 
 * @module passwordStorage - Last updated: 2026-01-28
 */

import {
  getPasswordPersistenceMode,
  shouldPersistPassword,
  type PasswordPersistenceMode
} from './passwordPersistenceSettings';
import { scopedKey } from './userScope';

// Per-user: each account can have its own journal password
const STORAGE_KEY = 'ownjournal_encrypted_password';
// Device-level: same key used to encrypt all users' stored passwords on this device
const DEVICE_KEY_STORAGE = 'ownjournal_device_key';

/**
 * Get the appropriate storage based on persistence mode
 */
function getStorage(): Storage | null {
  const mode = getPasswordPersistenceMode();
  if (mode === 'localStorage') {
    return localStorage;
  } else if (mode === 'sessionStorage') {
    return sessionStorage;
  }
  return null; // 'none' mode - don't persist
}

/**
 * Generate or retrieve device-specific encryption key
 * Always uses localStorage for the device key (needed for decryption)
 */
async function getDeviceKey(): Promise<CryptoKey> {
  // Check if we already have a device key
  const stored = localStorage.getItem(DEVICE_KEY_STORAGE);
  
  if (stored) {
    try {
      const keyData = JSON.parse(stored);
      return await window.crypto.subtle.importKey(
        'jwk',
        keyData,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      console.error('Failed to import stored device key:', error);
      // Fall through to generate new key
    }
  }
  
  // Generate new device key
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // Store the key (always in localStorage - needed for decryption)
  const exportedKey = await window.crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(DEVICE_KEY_STORAGE, JSON.stringify(exportedKey));
  
  return key;
}

/**
 * Encrypt and store password based on user's persistence preference
 */
export async function storePassword(password: string): Promise<void> {
  // Check if we should persist at all
  if (!shouldPersistPassword()) {
    if (import.meta.env.DEV) console.log('🔐 Password persistence disabled - not storing');
    return;
  }

  const storage = getStorage();
  if (!storage) {
    if (import.meta.env.DEV) console.log('🔐 No storage available - not storing password');
    return;
  }

  try {
    const deviceKey = await getDeviceKey();
    
    // Generate random IV
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt password
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      deviceKey,
      passwordData
    );
    
    // Store encrypted data with IV
    const data = {
      encrypted: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv),
    };
    
    storage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(data));
    if (import.meta.env.DEV) {
      const mode = getPasswordPersistenceMode();
      console.log(`🔐 Password stored securely (${mode})`);
    }
  } catch (error) {
    console.error('Failed to store password:', error);
    throw new Error('Failed to store password securely');
  }
}

/**
 * Retrieve and decrypt password from storage
 * Checks both localStorage and sessionStorage for backward compatibility
 */
export async function retrievePassword(): Promise<string | null> {
  try {
    // Try current storage mode first (scoped key)
    const storage = getStorage();
    let stored = storage?.getItem(scopedKey(STORAGE_KEY)) ?? null;

    // Fallback: check both storages for backward compatibility (unscoped and scoped)
    if (!stored) {
      stored =
        localStorage.getItem(scopedKey(STORAGE_KEY)) ??
        sessionStorage.getItem(scopedKey(STORAGE_KEY)) ??
        localStorage.getItem(STORAGE_KEY) ??
        sessionStorage.getItem(STORAGE_KEY) ??
        null;
    }
    
    if (!stored) {
      return null;
    }
    
    const data = JSON.parse(stored);
    const deviceKey = await getDeviceKey();
    
    // Decrypt password
    const encrypted = new Uint8Array(data.encrypted);
    const iv = new Uint8Array(data.iv);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      deviceKey,
      encrypted
    );
    
    const decoder = new TextDecoder();
    const password = decoder.decode(decrypted);
    
    if (import.meta.env.DEV) console.log('🔓 Password retrieved securely');
    return password;
  } catch (error) {
    console.error('Failed to retrieve password:', error);
    // Clear corrupted data
    clearPassword();
    return null;
  }
}

/**
 * Clear stored password from all storages
 */
export function clearPassword(): void {
  // Clear both scoped and legacy unscoped keys
  localStorage.removeItem(scopedKey(STORAGE_KEY));
  sessionStorage.removeItem(scopedKey(STORAGE_KEY));
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (import.meta.env.DEV) console.log('🗑️ Stored password cleared');
}

/**
 * Check if password is stored in any storage
 */
export function hasStoredPassword(): boolean {
  return (
    localStorage.getItem(scopedKey(STORAGE_KEY)) !== null ||
    sessionStorage.getItem(scopedKey(STORAGE_KEY)) !== null ||
    // Legacy unscoped fallback for migrating users
    localStorage.getItem(STORAGE_KEY) !== null ||
    sessionStorage.getItem(STORAGE_KEY) !== null
  );
}

/**
 * Migrate password to new persistence mode
 * Call this when user changes their persistence preference
 */
export async function migratePasswordToMode(newMode: PasswordPersistenceMode): Promise<void> {
  // First, retrieve the current password
  const password = await retrievePassword();
  
  // Clear from all storages
  clearPassword();
  
  // If no password was stored, or new mode is 'none', we're done
  if (!password || newMode === 'none') {
    if (import.meta.env.DEV) console.log(`🔐 Password migration complete (mode: ${newMode})`);
    return;
  }
  
  // Store in new location (settings already updated by caller)
  await storePassword(password);
  if (import.meta.env.DEV) console.log(`🔐 Password migrated to ${newMode}`);
}
