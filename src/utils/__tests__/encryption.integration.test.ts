/**
 * Integration tests for Encryption utilities
 * Tests end-to-end encryption workflows including key generation, derivation, and data encryption
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateMasterKey,
  encryptMasterKey,
  decryptMasterKey,
  encryptData,
  decryptData,
  deriveKeyFromPassword,
  generateSalt,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '../encryption';

describe('Encryption - Integration', () => {
  describe('Master Key Lifecycle', () => {
    it('should generate a valid master key', async () => {
      const masterKey = await generateMasterKey();

      expect(masterKey).toBeDefined();
      expect(masterKey.type).toBe('secret');
      expect(masterKey.algorithm.name).toBe('AES-GCM');
    });

    it('should encrypt and decrypt master key with password', async () => {
      const password = 'test-password-123';
      const masterKey = await generateMasterKey();

      // Encrypt the master key
      const encrypted = await encryptMasterKey(masterKey, password);

      expect(encrypted.encryptedKey).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.iv).toBeDefined();

      // Decrypt the master key
      const decryptedKey = await decryptMasterKey(
        encrypted.encryptedKey,
        encrypted.salt,
        encrypted.iv,
        password
      );

      // Keys should be functionally equivalent
      const testData = 'test data to verify keys are the same';
      const encoded = new TextEncoder().encode(testData);

      const originalIV = crypto.getRandomValues(new Uint8Array(12));
      const encryptedWithOriginal = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: originalIV },
        masterKey,
        encoded
      );

      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: originalIV },
        decryptedKey,
        encryptedWithOriginal
      );

      expect(new TextDecoder().decode(decryptedData)).toBe(testData);
    });

    it('should fail to decrypt with wrong password', async () => {
      const correctPassword = 'correct-password';
      const wrongPassword = 'wrong-password';
      const masterKey = await generateMasterKey();

      const encrypted = await encryptMasterKey(masterKey, correctPassword);

      await expect(
        decryptMasterKey(
          encrypted.encryptedKey,
          encrypted.salt,
          encrypted.iv,
          wrongPassword
        )
      ).rejects.toThrow();
    });

    it('should generate different encrypted keys with same password', async () => {
      const password = 'same-password';
      const masterKey = await generateMasterKey();

      const encrypted1 = await encryptMasterKey(masterKey, password);
      const encrypted2 = await encryptMasterKey(masterKey, password);

      // Different salts and IVs should produce different encrypted keys
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encryptedKey).not.toBe(encrypted2.encryptedKey);
    });
  });

  describe('Password-Based Key Derivation', () => {
    it('should derive consistent keys from same password and salt', async () => {
      const password = 'test-password';
      const salt = generateSalt();

      const key1 = await deriveKeyFromPassword(password, salt);
      const key2 = await deriveKeyFromPassword(password, salt);

      // Export keys to compare
      const exported1 = await crypto.subtle.exportKey('raw', key1);
      const exported2 = await crypto.subtle.exportKey('raw', key2);

      expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
    });

    it('should derive different keys from different passwords', async () => {
      const salt = generateSalt();

      const key1 = await deriveKeyFromPassword('password1', salt);
      const key2 = await deriveKeyFromPassword('password2', salt);

      const exported1 = await crypto.subtle.exportKey('raw', key1);
      const exported2 = await crypto.subtle.exportKey('raw', key2);

      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
    });

    it('should derive different keys from different salts', async () => {
      const password = 'same-password';
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const key1 = await deriveKeyFromPassword(password, salt1);
      const key2 = await deriveKeyFromPassword(password, salt2);

      const exported1 = await crypto.subtle.exportKey('raw', key1);
      const exported2 = await crypto.subtle.exportKey('raw', key2);

      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
    });

    it('should generate random salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      expect(salt1).toHaveLength(16);
      expect(salt2).toHaveLength(16);
      expect(salt1).not.toEqual(salt2);
    });
  });

  describe('Data Encryption and Decryption', () => {
    let masterKey: CryptoKey;

    beforeEach(async () => {
      masterKey = await generateMasterKey();
    });

    it('should encrypt and decrypt text data', async () => {
      const originalData = 'This is sensitive journal entry content';

      const { encrypted, iv } = await encryptData(originalData, masterKey);

      expect(encrypted).toBeInstanceOf(ArrayBuffer);
      expect(iv).toBeInstanceOf(ArrayBuffer);

      const decrypted = await decryptData(encrypted, masterKey, iv);

      expect(decrypted).toBe(originalData);
    });

    it('should handle empty strings', async () => {
      const originalData = '';

      const { encrypted, iv } = await encryptData(originalData, masterKey);
      const decrypted = await decryptData(encrypted, masterKey, iv);

      expect(decrypted).toBe(originalData);
    });

    it('should handle unicode characters', async () => {
      const originalData = '🎉 Unicode test: こんにちは 世界 🌍';

      const { encrypted, iv } = await encryptData(originalData, masterKey);
      const decrypted = await decryptData(encrypted, masterKey, iv);

      expect(decrypted).toBe(originalData);
    });

    it('should handle large data', async () => {
      const originalData = 'x'.repeat(1024 * 100); // 100KB of data

      const { encrypted, iv } = await encryptData(originalData, masterKey);
      const decrypted = await decryptData(encrypted, masterKey, iv);

      expect(decrypted).toBe(originalData);
      expect(decrypted.length).toBe(originalData.length);
    });

    it('should fail to decrypt with wrong key', async () => {
      const originalData = 'Secret data';
      const wrongKey = await generateMasterKey();

      const { encrypted, iv } = await encryptData(originalData, masterKey);

      await expect(
        decryptData(encrypted, wrongKey, iv)
      ).rejects.toThrow();
    });

    it('should fail to decrypt with wrong IV', async () => {
      const originalData = 'Secret data';

      const { encrypted } = await encryptData(originalData, masterKey);
      const wrongIV = crypto.getRandomValues(new Uint8Array(12)).buffer;

      await expect(
        decryptData(encrypted, masterKey, wrongIV)
      ).rejects.toThrow();
    });

    it('should produce different ciphertext for same data', async () => {
      const originalData = 'Same data';

      const result1 = await encryptData(originalData, masterKey);
      const result2 = await encryptData(originalData, masterKey);

      // Different IVs should produce different ciphertext
      expect(new Uint8Array(result1.iv)).not.toEqual(new Uint8Array(result2.iv));
      expect(new Uint8Array(result1.encrypted)).not.toEqual(new Uint8Array(result2.encrypted));
    });
  });

  describe('Base64 Encoding/Decoding', () => {
    it('should convert ArrayBuffer to Base64 and back', () => {
      const original = crypto.getRandomValues(new Uint8Array(32)).buffer;

      const base64 = arrayBufferToBase64(original);
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);

      const decoded = base64ToArrayBuffer(base64);
      expect(new Uint8Array(decoded)).toEqual(new Uint8Array(original));
    });

    it('should handle empty buffers', () => {
      const empty = new ArrayBuffer(0);

      const base64 = arrayBufferToBase64(empty);
      const decoded = base64ToArrayBuffer(base64);

      expect(decoded.byteLength).toBe(0);
    });

    it('should handle large buffers', () => {
      const large = crypto.getRandomValues(new Uint8Array(1024 * 10)).buffer; // 10KB

      const base64 = arrayBufferToBase64(large);
      const decoded = base64ToArrayBuffer(base64);

      expect(new Uint8Array(decoded)).toEqual(new Uint8Array(large));
    });
  });

  describe('End-to-End Encryption Workflow', () => {
    it('should complete full encryption workflow for journal entry', async () => {
      // User password
      const userPassword = 'my-secure-password-123';

      // Step 1: Generate master key
      const masterKey = await generateMasterKey();

      // Step 2: Encrypt master key with password
      const encryptedMasterKey = await encryptMasterKey(masterKey, userPassword);

      // Step 3: Encrypt journal entry with master key
      const journalEntry = JSON.stringify({
        title: 'My Private Journal',
        body: 'This is my secret journal entry content',
        date: new Date().toISOString(),
        mood: 'happy',
        tags: ['personal', 'private'],
      });

      const { encrypted, iv } = await encryptData(journalEntry, masterKey);

      // Simulate storage
      const storedData = {
        encryptedMasterKey: encryptedMasterKey.encryptedKey,
        masterKeySalt: encryptedMasterKey.salt,
        masterKeyIV: encryptedMasterKey.iv,
        encryptedEntry: arrayBufferToBase64(encrypted),
        entryIV: arrayBufferToBase64(iv),
      };

      // Step 4: Decrypt workflow (simulating app restart)
      const recoveredMasterKey = await decryptMasterKey(
        storedData.encryptedMasterKey,
        storedData.masterKeySalt,
        storedData.masterKeyIV,
        userPassword
      );

      const decryptedEntry = await decryptData(
        base64ToArrayBuffer(storedData.encryptedEntry),
        recoveredMasterKey,
        base64ToArrayBuffer(storedData.entryIV)
      );

      const parsedEntry = JSON.parse(decryptedEntry);

      expect(parsedEntry.title).toBe('My Private Journal');
      expect(parsedEntry.body).toBe('This is my secret journal entry content');
      expect(parsedEntry.mood).toBe('happy');
    });

    it('should handle password change workflow', async () => {
      const oldPassword = 'old-password';
      const newPassword = 'new-password';

      // Create and encrypt master key with old password
      const masterKey = await generateMasterKey();
      const oldEncrypted = await encryptMasterKey(masterKey, oldPassword);

      // Decrypt with old password
      const recoveredKey = await decryptMasterKey(
        oldEncrypted.encryptedKey,
        oldEncrypted.salt,
        oldEncrypted.iv,
        oldPassword
      );

      // Re-encrypt with new password
      const newEncrypted = await encryptMasterKey(recoveredKey, newPassword);

      // Verify new password works
      const finalKey = await decryptMasterKey(
        newEncrypted.encryptedKey,
        newEncrypted.salt,
        newEncrypted.iv,
        newPassword
      );

      // Verify key is still functional
      const testData = 'test data';
      const { encrypted, iv } = await encryptData(testData, finalKey);
      const decrypted = await decryptData(encrypted, finalKey, iv);

      expect(decrypted).toBe(testData);

      // Old password should no longer work
      await expect(
        decryptMasterKey(
          newEncrypted.encryptedKey,
          newEncrypted.salt,
          newEncrypted.iv,
          oldPassword
        )
      ).rejects.toThrow();
    });
  });

  describe('Security Properties', () => {
    it('should use strong key derivation (100k iterations)', async () => {
      const password = 'test';
      const salt = generateSalt();

      const startTime = performance.now();
      await deriveKeyFromPassword(password, salt);
      const endTime = performance.now();

      // PBKDF2 with 100k iterations should take noticeable time
      // This helps prevent brute force attacks
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(10); // At least 10ms
    });

    it('should generate cryptographically random IVs', async () => {
      const masterKey = await generateMasterKey();
      const data = 'same data';

      const results = await Promise.all(
        Array.from({ length: 10 }, () => encryptData(data, masterKey))
      );

      // All IVs should be unique
      const ivs = results.map(r => arrayBufferToBase64(r.iv));
      const uniqueIVs = new Set(ivs);
      expect(uniqueIVs.size).toBe(10);
    });

    it('should use AES-GCM for authenticated encryption', async () => {
      const masterKey = await generateMasterKey();

      expect(masterKey.algorithm.name).toBe('AES-GCM');
      // AES-GCM provides both confidentiality and authenticity
    });

    it('should detect tampering of encrypted data', async () => {
      const masterKey = await generateMasterKey();
      const originalData = 'Original data';

      const { encrypted, iv } = await encryptData(originalData, masterKey);

      // Tamper with encrypted data
      const tamperedEncrypted = new Uint8Array(encrypted);
      tamperedEncrypted[0] ^= 1; // Flip one bit

      // Decryption should fail due to authentication failure
      await expect(
        decryptData(tamperedEncrypted.buffer, masterKey, iv)
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should encrypt data efficiently', async () => {
      const masterKey = await generateMasterKey();
      const data = 'x'.repeat(1024 * 10); // 10KB

      const startTime = performance.now();
      await encryptData(data, masterKey);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast (<100ms)
    });

    it('should decrypt data efficiently', async () => {
      const masterKey = await generateMasterKey();
      const data = 'x'.repeat(1024 * 10); // 10KB

      const { encrypted, iv } = await encryptData(data, masterKey);

      const startTime = performance.now();
      await decryptData(encrypted, masterKey, iv);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast (<100ms)
    });
  });
});
