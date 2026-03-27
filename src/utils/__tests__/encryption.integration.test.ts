/**
 * Integration tests for Encryption utilities
 * Tests end-to-end encryption workflows including key generation, derivation, and data encryption
 *
 * NOTE: These tests run against the mocked crypto.subtle from test/setup.ts.
 * The mock returns static values, so tests verify function call flow and
 * data structures rather than actual cryptographic correctness.
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

    it('should encrypt master key and produce required fields', async () => {
      const password = 'test-password-123';
      const masterKey = await generateMasterKey();

      const encrypted = await encryptMasterKey(masterKey, password);

      expect(encrypted.encryptedKey).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(typeof encrypted.encryptedKey).toBe('string');
      expect(typeof encrypted.salt).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
    });

    it('should decrypt master key without throwing', async () => {
      const password = 'test-password-123';
      const masterKey = await generateMasterKey();

      const encrypted = await encryptMasterKey(masterKey, password);

      // With mock crypto, decryptMasterKey should complete without error
      const decryptedKey = await decryptMasterKey(
        encrypted.encryptedKey,
        encrypted.salt,
        encrypted.iv,
        password
      );

      expect(decryptedKey).toBeDefined();
      expect(decryptedKey.type).toBe('secret');
    });

    it('should generate different encrypted keys with same password', async () => {
      const password = 'same-password';
      const masterKey = await generateMasterKey();

      const encrypted1 = await encryptMasterKey(masterKey, password);
      const encrypted2 = await encryptMasterKey(masterKey, password);

      // Different salts and IVs should produce different base64 strings
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });
  });

  describe('Password-Based Key Derivation', () => {
    it('should derive a key from password and salt', async () => {
      const password = 'test-password';
      const salt = generateSalt();

      const key = await deriveKeyFromPassword(password, salt);

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('should call importKey and deriveKey', async () => {
      const salt = generateSalt();
      await deriveKeyFromPassword('password1', salt);

      expect(crypto.subtle.importKey).toHaveBeenCalled();
      expect(crypto.subtle.deriveKey).toHaveBeenCalled();
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

    it('should encrypt data and return ArrayBuffers', async () => {
      const originalData = 'This is sensitive journal entry content';

      const { encrypted, iv } = await encryptData(originalData, masterKey);

      expect(encrypted).toBeInstanceOf(ArrayBuffer);
      expect(iv).toBeInstanceOf(ArrayBuffer);
    });

    it('should produce different ciphertext for same data (different IVs)', async () => {
      const originalData = 'Same data';

      const result1 = await encryptData(originalData, masterKey);
      const result2 = await encryptData(originalData, masterKey);

      // Different IVs
      expect(new Uint8Array(result1.iv)).not.toEqual(new Uint8Array(result2.iv));
    });

    it('should call decrypt for decryption', async () => {
      const { encrypted, iv } = await encryptData('test', masterKey);
      await decryptData(encrypted, masterKey, iv);

      expect(crypto.subtle.decrypt).toHaveBeenCalled();
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
    it('should complete full encryption workflow without errors', async () => {
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

      // Verify all storage artifacts exist
      expect(storedData.encryptedMasterKey).toBeTruthy();
      expect(storedData.masterKeySalt).toBeTruthy();
      expect(storedData.masterKeyIV).toBeTruthy();
      expect(storedData.encryptedEntry).toBeTruthy();
      expect(storedData.entryIV).toBeTruthy();
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

      // Verify new password produces a result
      const finalKey = await decryptMasterKey(
        newEncrypted.encryptedKey,
        newEncrypted.salt,
        newEncrypted.iv,
        newPassword
      );

      expect(finalKey).toBeDefined();
      expect(finalKey.type).toBe('secret');
    });
  });

  describe('Security Properties', () => {
    it('should call PBKDF2 key derivation', async () => {
      const password = 'test';
      const salt = generateSalt();

      await deriveKeyFromPassword(password, salt);

      expect(crypto.subtle.importKey).toHaveBeenCalled();
      expect(crypto.subtle.deriveKey).toHaveBeenCalled();
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
