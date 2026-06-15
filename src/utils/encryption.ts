// Password-derived encryption utilities for journal entries

import { argon2id } from 'hash-wasm';
import { FEATURES } from '@/config/features';

/**
 * Key-derivation function identifiers stored alongside the wrapped master key.
 * - 'pbkdf2'  : legacy PBKDF2-SHA256 (100k iterations). Used for key files written
 *               before the Argon2id migration; still readable indefinitely.
 * - 'argon2id': memory-hard Argon2id (default for all new key files).
 * Absence of the field means a legacy file → treat as 'pbkdf2'.
 */
export type KdfId = 'pbkdf2' | 'argon2id';

export interface Argon2idParams {
  iterations: number;
  memorySize: number; // in KiB
  parallelism: number;
}

/**
 * Default Argon2id parameters for wrapping the master key.
 * 64 MiB / 3 passes is a common interactive-login target: memory-hard enough to
 * neutralise the GPU/ASIC advantage that makes PBKDF2 cheap to brute-force,
 * while staying ~sub-second on typical devices. Stored in the key file so the
 * parameters can be raised later without breaking old files.
 */
export const ARGON2ID_DEFAULT_PARAMS: Argon2idParams = {
  iterations: 3,
  memorySize: 65536, // 64 MiB
  parallelism: 1,
};

/** Spec describing how a wrapped master key was derived; read from the key file. */
export interface WrapKdfSpec {
  kdf?: KdfId;
  kdfParams?: Argon2idParams;
}

const LEGACY_PBKDF2_ITERATIONS = 100000;

/**
 * Derives the AES-GCM wrapping key used to encrypt/decrypt the master key.
 * Dispatches on the stored KDF: Argon2id for new files, PBKDF2 for legacy files.
 * The wrapping key is non-extractable — it never needs to leave WebCrypto.
 */
const deriveWrapKey = async (
  password: string,
  salt: Uint8Array,
  spec?: WrapKdfSpec
): Promise<CryptoKey> => {
  const kdf: KdfId = spec?.kdf ?? 'pbkdf2';

  if (kdf === 'argon2id') {
    const params = spec?.kdfParams ?? ARGON2ID_DEFAULT_PARAMS;
    const rawKey = await argon2id({
      password: new TextEncoder().encode(password),
      salt,
      parallelism: params.parallelism,
      iterations: params.iterations,
      memorySize: params.memorySize,
      hashLength: 32,
      outputType: 'binary',
    });
    return crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Legacy PBKDF2 path — kept so key files written before the migration stay readable.
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: LEGACY_PBKDF2_ITERATIONS, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Derives an encryption key from a user's password using PBKDF2
 * @param password - User's password
 * @param salt - Salt for key derivation (should be stored with encrypted data)
 * @returns CryptoKey for AES-GCM encryption
 */
export const deriveKeyFromPassword = async (
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Ensure we have an ArrayBuffer, not ArrayBufferLike
  const saltBuffer = salt.buffer instanceof ArrayBuffer 
    ? salt.buffer 
    : new Uint8Array(salt).buffer;

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

/**
 * Generates a random salt for key derivation
 */
export const generateSalt = (): Uint8Array => {
  return crypto.getRandomValues(new Uint8Array(16));
};

/**
 * Generates a master encryption key for journal entries
 */
export const generateMasterKey = async (): Promise<CryptoKey> => {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypts the master key with a password-derived key.
 * Records the KDF (and parameters, for Argon2id) in the result so the key file
 * is self-describing for decryption and future parameter upgrades.
 *
 * The KDF used for NEW wraps is governed by FEATURES.CLOUD_CRYPTO_V2_WRITE:
 * key files are shared with the user's other devices through their cloud, and a
 * build without Argon2id read support treats an Argon2id file as a wrong
 * password. Until that flag flips, new wraps stay PBKDF2 (legacy-compatible)
 * while every build with this code can already READ Argon2id files.
 * @param kdfOverride - Force a specific KDF (used by tests; production call
 *                      sites rely on the flag-derived default).
 */
export const encryptMasterKey = async (
  masterKey: CryptoKey,
  password: string,
  kdfOverride?: KdfId
): Promise<{ encryptedKey: string; salt: string; iv: string; kdf: KdfId; kdfParams?: Argon2idParams }> => {
  const kdf: KdfId = kdfOverride ?? (FEATURES.CLOUD_CRYPTO_V2_WRITE ? 'argon2id' : 'pbkdf2');
  const salt = generateSalt();
  const kdfParams = kdf === 'argon2id' ? ARGON2ID_DEFAULT_PARAMS : undefined;
  const wrapKey = await deriveWrapKey(password, salt, { kdf, kdfParams });

  const exportedKey = await crypto.subtle.exportKey('raw', masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrapKey,
    exportedKey
  );

  return {
    encryptedKey: arrayBufferToBase64(encrypted),
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    kdf,
    kdfParams,
  };
};

/**
 * Decrypts the master key using a password.
 * @param spec - KDF descriptor from the stored key file. Omit (or pass no kdf)
 *               for legacy PBKDF2 key files written before the Argon2id migration.
 */
export const decryptMasterKey = async (
  encryptedKey: string,
  salt: string,
  iv: string,
  password: string,
  spec?: WrapKdfSpec
): Promise<CryptoKey> => {
  const saltBuffer = base64ToArrayBuffer(salt);
  const wrapKey = await deriveWrapKey(password, new Uint8Array(saltBuffer), spec);

  const encryptedBuffer = base64ToArrayBuffer(encryptedKey);
  const ivBuffer = base64ToArrayBuffer(iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    wrapKey,
    encryptedBuffer
  );

  return await crypto.subtle.importKey(
    'raw',
    decrypted,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypts data with a key
 */
export const encryptData = async (
  data: string,
  key: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: ArrayBuffer }> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  
  return { encrypted, iv: iv.buffer };
};

/**
 * Decrypts data with a key
 */
export const decryptData = async (
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: ArrayBuffer
): Promise<string> => {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  );
  
  return new TextDecoder().decode(decrypted);
};

// Helper functions for base64 conversion
export const arrayBufferToBase64 = (buffer: ArrayBuffer | ArrayBufferLike): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Returns a short fingerprint of a master key for debugging (first 8 hex chars of SHA-256).
 * Used to confirm the same key is used across providers.
 */
export const getMasterKeyFingerprint = async (key: CryptoKey): Promise<string> => {
  const raw = await crypto.subtle.exportKey('raw', key);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.substring(0, 8);
};