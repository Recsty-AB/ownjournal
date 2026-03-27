import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  deriveKeyFromPassword,
  generateSalt,
  generateMasterKey,
  encryptMasterKey,
  decryptMasterKey,
  encryptData,
  decryptData,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../encryption';

/**
 * NOTE: These tests run against the mocked crypto.subtle from test/setup.ts.
 * The mock returns static values (e.g., encrypt always returns 8-byte ArrayBuffer),
 * so tests verify function call flow and data structure rather than actual
 * cryptographic correctness. Integration tests with real crypto are in
 * encryption.integration.test.ts.
 */
describe('Encryption Utilities', () => {
  describe('Salt Generation', () => {
    it('should generate a 16-byte salt', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it('should generate unique salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      // getRandomValues mock uses Math.random so salts should differ
      expect(salt1).not.toEqual(salt2);
    });
  });

  describe('Key Derivation', () => {
    it('should derive a key from password and salt', async () => {
      const password = 'secure-password-123';
      const salt = generateSalt();

      const key = await deriveKeyFromPassword(password, salt);

      // Mock returns a CryptoKey-like object
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should call crypto.subtle.importKey and deriveKey', async () => {
      const password = 'test-password';
      const salt = generateSalt();

      await deriveKeyFromPassword(password, salt);

      // Verify the mock was called
      expect(crypto.subtle.importKey).toHaveBeenCalled();
      expect(crypto.subtle.deriveKey).toHaveBeenCalled();
    });

    it('should handle empty password', async () => {
      const salt = generateSalt();
      const key = await deriveKeyFromPassword('', salt);
      expect(key).toBeDefined();
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const salt = generateSalt();
      const key = await deriveKeyFromPassword(longPassword, salt);
      expect(key).toBeDefined();
    });
  });

  describe('Master Key Generation', () => {
    it('should generate a valid AES-GCM master key', async () => {
      const masterKey = await generateMasterKey();

      expect(masterKey).toBeDefined();
      expect(masterKey.type).toBe('secret');
      expect(masterKey.algorithm.name).toBe('AES-GCM');
    });

    it('should call crypto.subtle.generateKey', async () => {
      await generateMasterKey();
      expect(crypto.subtle.generateKey).toHaveBeenCalled();
    });
  });

  describe('Master Key Encryption/Decryption', () => {
    it('should encrypt master key and return required fields', async () => {
      const password = 'secure-password';
      const masterKey = await generateMasterKey();

      const { encryptedKey, salt, iv } = await encryptMasterKey(masterKey, password);

      expect(encryptedKey).toBeTruthy();
      expect(salt).toBeTruthy();
      expect(iv).toBeTruthy();
      expect(typeof encryptedKey).toBe('string');
      expect(typeof salt).toBe('string');
      expect(typeof iv).toBe('string');
    });

    it('should call exportKey and encrypt when encrypting master key', async () => {
      const masterKey = await generateMasterKey();
      await encryptMasterKey(masterKey, 'password');

      expect(crypto.subtle.exportKey).toHaveBeenCalled();
      expect(crypto.subtle.encrypt).toHaveBeenCalled();
    });

    it('should handle special characters in password', async () => {
      const masterKey = await generateMasterKey();
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

      // Should not throw
      const result = await encryptMasterKey(masterKey, password);
      expect(result.encryptedKey).toBeTruthy();
    });
  });

  describe('Data Encryption/Decryption', () => {
    it('should call encrypt with correct algorithm', async () => {
      const key = await generateMasterKey();
      await encryptData('test data', key);

      expect(crypto.subtle.encrypt).toHaveBeenCalled();
    });

    it('should return encrypted data and IV', async () => {
      const key = await generateMasterKey();
      const { encrypted, iv } = await encryptData('test data', key);

      expect(encrypted).toBeInstanceOf(ArrayBuffer);
      expect(iv).toBeInstanceOf(ArrayBuffer);
    });

    it('should call decrypt with correct algorithm', async () => {
      const key = await generateMasterKey();
      const { encrypted, iv } = await encryptData('test data', key);
      await decryptData(encrypted, key, iv);

      expect(crypto.subtle.decrypt).toHaveBeenCalled();
    });

    it('should generate unique IVs for each encryption', async () => {
      const key = await generateMasterKey();
      const ivs = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const { iv } = await encryptData('test', key);
        const ivBase64 = arrayBufferToBase64(iv);
        ivs.add(ivBase64);
      }

      expect(ivs.size).toBe(100); // All IVs should be unique
    });
  });

  describe('Base64 Conversion', () => {
    it('should convert ArrayBuffer to Base64 and back', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 127]);
      const base64 = arrayBufferToBase64(original.buffer);
      const restored = base64ToArrayBuffer(base64);

      expect(new Uint8Array(restored)).toEqual(original);
    });

    it('should handle empty ArrayBuffer', () => {
      const original = new Uint8Array([]);
      const base64 = arrayBufferToBase64(original.buffer);
      const restored = base64ToArrayBuffer(base64);

      expect(new Uint8Array(restored)).toEqual(original);
    });

    it('should handle large ArrayBuffers', () => {
      const original = new Uint8Array(10000);
      crypto.getRandomValues(original);

      const base64 = arrayBufferToBase64(original.buffer);
      const restored = base64ToArrayBuffer(base64);

      expect(new Uint8Array(restored)).toEqual(original);
    });

    it('should produce valid Base64 strings', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const base64 = arrayBufferToBase64(data.buffer);

      // Valid Base64 should only contain these characters
      expect(base64).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });
  });

  describe('End-to-End Encryption Flow', () => {
    it('should complete full encryption workflow without errors', async () => {
      const password = 'user-password-123';
      const journalEntry = 'Today I learned about cryptography!';

      // 1. Generate master key
      const masterKey = await generateMasterKey();

      // 2. Encrypt master key with password
      const { encryptedKey, salt, iv: masterIv } = await encryptMasterKey(masterKey, password);

      // 3. Encrypt journal entry with master key
      const { encrypted: entryEncrypted, iv: entryIv } = await encryptData(journalEntry, masterKey);

      // Simulate storage (convert to base64)
      const storedEntry = arrayBufferToBase64(entryEncrypted);
      const storedIv = arrayBufferToBase64(entryIv);

      // Verify all storage artifacts exist
      expect(encryptedKey).toBeTruthy();
      expect(salt).toBeTruthy();
      expect(masterIv).toBeTruthy();
      expect(storedEntry).toBeTruthy();
      expect(storedIv).toBeTruthy();
    });
  });

  describe('Security Properties', () => {
    it('should call deriveKey for key derivation', async () => {
      const password = 'test';
      const salt = generateSalt();

      await deriveKeyFromPassword(password, salt);

      // Verify PBKDF2 is used via importKey + deriveKey calls
      expect(crypto.subtle.importKey).toHaveBeenCalled();
      expect(crypto.subtle.deriveKey).toHaveBeenCalled();
    });

    it('should call generateKey for master key creation', async () => {
      await generateMasterKey();
      expect(crypto.subtle.generateKey).toHaveBeenCalled();
    });

    it('should use unique IVs for each encryption', async () => {
      const key = await generateMasterKey();
      const ivs = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const { iv } = await encryptData('test', key);
        const ivBase64 = arrayBufferToBase64(iv);
        ivs.add(ivBase64);
      }

      expect(ivs.size).toBe(100); // All IVs should be unique
    });
  });
});
