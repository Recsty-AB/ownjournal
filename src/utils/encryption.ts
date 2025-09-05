// Password-derived encryption utilities for journal entries

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
 * Encrypts the master key with a password-derived key
 */
export const encryptMasterKey = async (
  masterKey: CryptoKey,
  password: string
): Promise<{ encryptedKey: string; salt: string; iv: string }> => {
  const salt = generateSalt();
  const passwordKey = await deriveKeyFromPassword(password, salt);
  
  const exportedKey = await crypto.subtle.exportKey('raw', masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    passwordKey,
    exportedKey
  );

  return {
    encryptedKey: arrayBufferToBase64(encrypted),
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
  };
};

/**
 * Decrypts the master key using a password
 */
export const decryptMasterKey = async (
  encryptedKey: string,
  salt: string,
  iv: string,
  password: string
): Promise<CryptoKey> => {
  const saltBuffer = base64ToArrayBuffer(salt);
  const passwordKey = await deriveKeyFromPassword(password, new Uint8Array(saltBuffer));
  
  const encryptedBuffer = base64ToArrayBuffer(encryptedKey);
  const ivBuffer = base64ToArrayBuffer(iv);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    passwordKey,
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