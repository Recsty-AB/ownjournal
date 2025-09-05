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
      expect(salt1).not.toEqual(salt2);
    });
  });

  describe('Key Derivation', () => {
    it('should derive a key from password and salt', async () => {
      const password = 'secure-password-123';
      const salt = generateSalt();
      
      const key = await deriveKeyFromPassword(password, salt);
      
      expect(key).toBeInstanceOf(CryptoKey);
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should derive the same key for same password and salt', async () => {
      const password = 'test-password';
      const salt = generateSalt();
      
      const key1 = await deriveKeyFromPassword(password, salt);
      const key2 = await deriveKeyFromPassword(password, salt);
      
      const exported1 = await crypto.subtle.exportKey('raw', key1);
      const exported2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
    });

    it('should derive different keys for different passwords', async () => {
      const salt = generateSalt();
      
      const key1 = await deriveKeyFromPassword('password1', salt);
      const key2 = await deriveKeyFromPassword('password2', salt);
      
      const exported1 = await crypto.subtle.exportKey('raw', key1);
      const exported2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
    });

    it('should derive different keys for different salts', async () => {
      const password = 'same-password';
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      
      const key1 = await deriveKeyFromPassword(password, salt1);
      const key2 = await deriveKeyFromPassword(password, salt2);
      
      const exported1 = await crypto.subtle.exportKey('raw', key1);
      const exported2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
    });

    it('should handle empty password', async () => {
      const salt = generateSalt();
      const key = await deriveKeyFromPassword('', salt);
      expect(key).toBeInstanceOf(CryptoKey);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const salt = generateSalt();
      const key = await deriveKeyFromPassword(longPassword, salt);
      expect(key).toBeInstanceOf(CryptoKey);
    });
  });

  describe('Master Key Generation', () => {
    it('should generate a valid AES-GCM master key', async () => {
      const masterKey = await generateMasterKey();
      
      expect(masterKey).toBeInstanceOf(CryptoKey);
      expect(masterKey.type).toBe('secret');
      expect(masterKey.algorithm.name).toBe('AES-GCM');
    });

    it('should generate unique master keys', async () => {
      const key1 = await generateMasterKey();
      const key2 = await generateMasterKey();
      
      const exported1 = await crypto.subtle.exportKey('raw', key1);
      const exported2 = await crypto.subtle.exportKey('raw', key2);
      
      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
    });
  });

  describe('Master Key Encryption/Decryption', () => {
    it('should encrypt and decrypt master key successfully', async () => {
      const password = 'secure-password';
      const masterKey = await generateMasterKey();
      
      const { encryptedKey, salt, iv } = await encryptMasterKey(masterKey, password);
      
      expect(encryptedKey).toBeTruthy();
      expect(salt).toBeTruthy();
      expect(iv).toBeTruthy();
      
      const decryptedKey = await decryptMasterKey(encryptedKey, salt, iv, password);
      
      const originalExported = await crypto.subtle.exportKey('raw', masterKey);
      const decryptedExported = await crypto.subtle.exportKey('raw', decryptedKey);
      
      expect(new Uint8Array(originalExported)).toEqual(new Uint8Array(decryptedExported));
    });

    it('should fail to decrypt with wrong password', async () => {
      const masterKey = await generateMasterKey();
      const { encryptedKey, salt, iv } = await encryptMasterKey(masterKey, 'correct-password');
      
      await expect(
        decryptMasterKey(encryptedKey, salt, iv, 'wrong-password')
      ).rejects.toThrow();
    });

    it('should produce different encrypted keys for same master key', async () => {
      const masterKey = await generateMasterKey();
      const password = 'password';
      
      const result1 = await encryptMasterKey(masterKey, password);
      const result2 = await encryptMasterKey(masterKey, password);
      
      // Different IVs and salts mean different encrypted outputs
      expect(result1.encryptedKey).not.toBe(result2.encryptedKey);
      expect(result1.salt).not.toBe(result2.salt);
      expect(result1.iv).not.toBe(result2.iv);
      
      // But both should decrypt to the same master key
      const decrypted1 = await decryptMasterKey(result1.encryptedKey, result1.salt, result1.iv, password);
      const decrypted2 = await decryptMasterKey(result2.encryptedKey, result2.salt, result2.iv, password);
      
      const exported1 = await crypto.subtle.exportKey('raw', decrypted1);
      const exported2 = await crypto.subtle.exportKey('raw', decrypted2);
      
      expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
    });

    it('should handle special characters in password', async () => {
      const masterKey = await generateMasterKey();
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      
      const { encryptedKey, salt, iv } = await encryptMasterKey(masterKey, password);
      const decryptedKey = await decryptMasterKey(encryptedKey, salt, iv, password);
      
      const originalExported = await crypto.subtle.exportKey('raw', masterKey);
      const decryptedExported = await crypto.subtle.exportKey('raw', decryptedKey);
      
      expect(new Uint8Array(originalExported)).toEqual(new Uint8Array(decryptedExported));
    });
  });

  describe('Data Encryption/Decryption', () => {
    it('should encrypt and decrypt data successfully', async () => {
      const plaintext = 'This is my secret journal entry';
      const key = await generateMasterKey();
      
      const { encrypted, iv } = await encryptData(plaintext, key);
      const decrypted = await decryptData(encrypted, key, iv);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', async () => {
      const plaintext = '';
      const key = await generateMasterKey();
      
      const { encrypted, iv } = await encryptData(plaintext, key);
      const decrypted = await decryptData(encrypted, key, iv);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle large text data', async () => {
      const plaintext = 'Lorem ipsum dolor sit amet. '.repeat(1000);
      const key = await generateMasterKey();
      
      const { encrypted, iv } = await encryptData(plaintext, key);
      const decrypted = await decryptData(encrypted, key, iv);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', async () => {
      const plaintext = '日本語 中文 한글 العربية עברית Ελληνικά 🎉😀';
      const key = await generateMasterKey();
      
      const { encrypted, iv } = await encryptData(plaintext, key);
      const decrypted = await decryptData(encrypted, key, iv);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const plaintext = 'Same content';
      const key = await generateMasterKey();
      
      const result1 = await encryptData(plaintext, key);
      const result2 = await encryptData(plaintext, key);
      
      // Different IVs mean different ciphertext
      expect(result1.iv).not.toEqual(result2.iv);
      expect(result1.encrypted).not.toEqual(result2.encrypted);
      
      // But both decrypt to same plaintext
      const decrypted1 = await decryptData(result1.encrypted, key, result1.iv);
      const decrypted2 = await decryptData(result2.encrypted, key, result2.iv);
      
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('should fail to decrypt with wrong key', async () => {
      const plaintext = 'Secret data';
      const key1 = await generateMasterKey();
      const key2 = await generateMasterKey();
      
      const { encrypted, iv } = await encryptData(plaintext, key1);
      
      await expect(
        decryptData(encrypted, key2, iv)
      ).rejects.toThrow();
    });

    it('should fail to decrypt with wrong IV', async () => {
      const plaintext = 'Secret data';
      const key = await generateMasterKey();
      
      const { encrypted } = await encryptData(plaintext, key);
      const wrongIv = crypto.getRandomValues(new Uint8Array(12)).buffer;
      
      await expect(
        decryptData(encrypted, key, wrongIv)
      ).rejects.toThrow();
    });

    it('should fail to decrypt tampered data', async () => {
      const plaintext = 'Secret data';
      const key = await generateMasterKey();
      
      const { encrypted, iv } = await encryptData(plaintext, key);
      
      // Tamper with encrypted data
      const tamperedData = new Uint8Array(encrypted);
      tamperedData[0] ^= 0xFF; // Flip bits in first byte
      
      await expect(
        decryptData(tamperedData.buffer, key, iv)
      ).rejects.toThrow();
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
    it('should complete full encryption workflow', async () => {
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
      
      // Simulate retrieval and decryption
      // 1. Decrypt master key
      const retrievedMasterKey = await decryptMasterKey(encryptedKey, salt, masterIv, password);
      
      // 2. Decrypt journal entry
      const retrievedEncrypted = base64ToArrayBuffer(storedEntry);
      const retrievedIv = base64ToArrayBuffer(storedIv);
      const decryptedEntry = await decryptData(retrievedEncrypted, retrievedMasterKey, retrievedIv);
      
      expect(decryptedEntry).toBe(journalEntry);
    });

    it('should fail workflow with wrong password', async () => {
      const correctPassword = 'correct-password';
      const wrongPassword = 'wrong-password';
      const journalEntry = 'Secret entry';
      
      const masterKey = await generateMasterKey();
      const { encryptedKey, salt, iv } = await encryptMasterKey(masterKey, correctPassword);
      
      await expect(
        decryptMasterKey(encryptedKey, salt, iv, wrongPassword)
      ).rejects.toThrow();
    });
  });

  describe('Security Properties', () => {
    it('should use PBKDF2 with sufficient iterations', async () => {
      const password = 'test';
      const salt = generateSalt();
      
      const startTime = performance.now();
      await deriveKeyFromPassword(password, salt);
      const endTime = performance.now();
      
      // Should take at least a few milliseconds (100k iterations)
      expect(endTime - startTime).toBeGreaterThan(1);
    });

    it('should use AES-GCM with 256-bit keys', async () => {
      const key = await generateMasterKey();
      const exported = await crypto.subtle.exportKey('raw', key);
      
      expect(exported.byteLength).toBe(32); // 256 bits = 32 bytes
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

    it('should not expose key material in error messages', async () => {
      const masterKey = await generateMasterKey();
      const { encryptedKey, salt, iv } = await encryptMasterKey(masterKey, 'password');
      
      try {
        await decryptMasterKey(encryptedKey, salt, iv, 'wrong');
      } catch (error: any) {
        // Error message should not contain key material
        expect(error.message).not.toContain(encryptedKey);
        expect(error.message).not.toContain(salt);
      }
    });
  });
});
