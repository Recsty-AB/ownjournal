import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storePassword, retrievePassword, clearPassword, hasStoredPassword } from '../passwordStorage';

describe('passwordStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should store and retrieve password', async () => {
    const testPassword = 'test-password-123';
    
    await storePassword(testPassword);
    expect(hasStoredPassword()).toBe(true);
    
    const retrieved = await retrievePassword();
    expect(retrieved).toBe(testPassword);
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
    const allValues = Object.values(localStorage);
    const plainTextFound = allValues.some(value => value.includes(testPassword));
    expect(plainTextFound).toBe(false);
  });

  it('should handle corrupted data gracefully', async () => {
    // Store corrupted data
    localStorage.setItem('ownjournal_encrypted_password', 'corrupted-data');
    
    const retrieved = await retrievePassword();
    expect(retrieved).toBeNull();
    expect(hasStoredPassword()).toBe(false); // Should auto-clear corrupted data
  });

  it('should use unique encryption for each storage', async () => {
    const testPassword = 'test-password-123';
    
    // Store password first time
    await storePassword(testPassword);
    const stored1 = localStorage.getItem('ownjournal_encrypted_password');
    
    // Clear and store again
    clearPassword();
    await storePassword(testPassword);
    const stored2 = localStorage.getItem('ownjournal_encrypted_password');
    
    // Encrypted data should be different (different IV)
    expect(stored1).not.toBe(stored2);
    
    // But decrypted password should be same
    const retrieved = await retrievePassword();
    expect(retrieved).toBe(testPassword);
  });

  it('should handle special characters in password', async () => {
    const specialPassword = 'p@$$w0rd!#%&*()[]{}|\\/<>?~`';
    
    await storePassword(specialPassword);
    const retrieved = await retrievePassword();
    expect(retrieved).toBe(specialPassword);
  });

  it('should handle unicode characters in password', async () => {
    const unicodePassword = 'пароль密码🔐';
    
    await storePassword(unicodePassword);
    const retrieved = await retrievePassword();
    expect(retrieved).toBe(unicodePassword);
  });

  it('should handle empty password', async () => {
    const emptyPassword = '';
    
    await storePassword(emptyPassword);
    const retrieved = await retrievePassword();
    expect(retrieved).toBe(emptyPassword);
  });
});
