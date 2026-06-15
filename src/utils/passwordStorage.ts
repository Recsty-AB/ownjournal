/**
 * Secure password storage utility
 * Encrypts password before storing in localStorage or sessionStorage
 * Uses a device-specific key for encryption
 * 
 * Security model:
 * - Password is encrypted with AES-GCM using a device-specific key
 * - The device key is a NON-EXTRACTABLE CryptoKey held in IndexedDB. Unlike the
 *   previous extractable-JWK-in-localStorage design, an attacker with read access
 *   to storage (XSS, malicious extension, forensics) can no longer exfiltrate the
 *   key — WebCrypto will not export it. They can at most *use* it while the page
 *   is live, which is a strictly higher bar.
 * - User can choose persistence mode: localStorage, sessionStorage, or none
 * - Main residual risk is shared devices
 *
 * @module passwordStorage
 */

import {
  getPasswordPersistenceMode,
  shouldPersistPassword,
  type PasswordPersistenceMode
} from './passwordPersistenceSettings';
import { scopedKey } from './userScope';

// Per-user: each account can have its own journal password
const STORAGE_KEY = 'ownjournal_encrypted_password';
// Legacy device-key location: an EXTRACTABLE JWK in localStorage (pre-migration).
const DEVICE_KEY_STORAGE = 'ownjournal_device_key';

// Non-extractable device key lives in a dedicated IndexedDB store.
const DEVICE_KEY_DB = 'ownjournal_secure';
const DEVICE_KEY_STORE = 'keys';
const DEVICE_KEY_ID = 'deviceKey';

let deviceKeyPromise: Promise<CryptoKey> | null = null;

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

function openDeviceKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DEVICE_KEY_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DEVICE_KEY_STORE)) {
        req.result.createObjectStore(DEVICE_KEY_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetDeviceKey(): Promise<CryptoKey | null> {
  const db = await openDeviceKeyDB();
  try {
    return await new Promise<CryptoKey | null>((resolve, reject) => {
      const tx = db.transaction(DEVICE_KEY_STORE, 'readonly');
      const req = tx.objectStore(DEVICE_KEY_STORE).get(DEVICE_KEY_ID);
      req.onsuccess = () => resolve((req.result as CryptoKey) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbPutDeviceKey(key: CryptoKey): Promise<void> {
  const db = await openDeviceKeyDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DEVICE_KEY_STORE, 'readwrite');
      tx.objectStore(DEVICE_KEY_STORE).put(key, DEVICE_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Get the device-specific encryption key as a NON-EXTRACTABLE CryptoKey.
 *
 * Resolution order:
 *  1. Existing non-extractable key in IndexedDB.
 *  2. Legacy extractable JWK in localStorage → migrate in place: re-import the
 *     SAME key bytes as non-extractable, persist to IndexedDB, delete the JWK.
 *     Preserving the bytes is important — the shared device key encrypts every
 *     account's stored password on this device, so rotating it would orphan
 *     other accounts' ciphertext. Migration keeps all of them decryptable.
 *  3. Otherwise generate a fresh non-extractable key.
 */
async function getDeviceKey(): Promise<CryptoKey> {
  if (deviceKeyPromise) return deviceKeyPromise;

  deviceKeyPromise = (async () => {
    // 1. Already migrated — non-extractable key in IndexedDB.
    try {
      const existing = await idbGetDeviceKey();
      if (existing) return existing;
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Device key IDB read failed:', error);
    }

    // 2. Legacy extractable JWK in localStorage — migrate the same bytes.
    const legacy = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (legacy) {
      try {
        const jwk = JSON.parse(legacy);
        const extractable = await window.crypto.subtle.importKey(
          'jwk',
          jwk,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        const rawBytes = await window.crypto.subtle.exportKey('raw', extractable);
        const nonExtractable = await window.crypto.subtle.importKey(
          'raw',
          rawBytes,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
        await idbPutDeviceKey(nonExtractable);
        localStorage.removeItem(DEVICE_KEY_STORAGE);
        if (import.meta.env.DEV) console.log('🔐 Migrated device key to non-extractable IndexedDB storage');
        return nonExtractable;
      } catch (error) {
        console.error('Failed to migrate legacy device key:', error);
        // Fall through to generate a new key.
      }
    }

    // 3. Fresh non-extractable key.
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    await idbPutDeviceKey(key);
    return key;
  })();

  try {
    return await deviceKeyPromise;
  } catch (error) {
    deviceKeyPromise = null; // allow retry on failure
    throw error;
  }
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
