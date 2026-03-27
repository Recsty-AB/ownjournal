import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storePassword, retrievePassword, clearPassword, hasStoredPassword } from '../passwordStorage';

/**
 * NOTE: These tests run against the mocked crypto.subtle from test/setup.ts.
 * The mock encrypt/decrypt return static values, so round-trip tests verify
 * function flow and storage behavior rather than actual crypto correctness.
 */
describe('passwordStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should store password and mark as stored', async () => {
    const testPassword = 'test-password-123';

    await storePassword(testPassword);
    expect(hasStoredPassword()).toBe(true);
  });

  it('should return null when no password is stored', async () => {
    const retrieved = await retrievePassword();
    expect(retrieved).toBeNull();
    expect(hasStoredPassword()).toBe(false);
  });

  it('should clear stored password', async () => {
    const testPassword = 'test-password-123';

    await storePassword(testPassword);
    expect(hasStoredPassword()).toBe(true);

    clearPassword();
    expect(hasStoredPassword()).toBe(false);

    const retrieved = await retrievePassword();
    expect(retrieved).toBeNull();
  });

  it('should encrypt password (not store in plain text)', async () => {
    const testPassword = 'test-password-123';

    await storePassword(testPassword);

    // Check that localStorage doesn't contain plain text password
    let foundPlainText = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value && value.includes(testPassword)) {
          foundPlainText = true;
        }
      }
    }
    expect(foundPlainText).toBe(false);
  });

  it('should handle corrupted data gracefully', async () => {
    // Store corrupted data
    localStorage.setItem('ownjournal_encrypted_password', 'corrupted-data');

    const retrieved = await retrievePassword();
    expect(retrieved).toBeNull();
    expect(hasStoredPassword()).toBe(false); // Should auto-clear corrupted data
  });

  it('should store device key in localStorage', async () => {
    await storePassword('test-password');

    // Should have created a device key
    const deviceKey = localStorage.getItem('ownjournal_device_key');
    expect(deviceKey).toBeTruthy();
  });

  it('should call crypto.subtle.encrypt when storing', async () => {
    await storePassword('test');
    expect(crypto.subtle.encrypt).toHaveBeenCalled();
  });

  it('should call crypto.subtle.decrypt when retrieving', async () => {
    await storePassword('test');
    await retrievePassword();
    expect(crypto.subtle.decrypt).toHaveBeenCalled();
  });
});
