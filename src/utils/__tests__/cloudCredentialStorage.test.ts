import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudCredentialStorage } from '../cloudCredentialStorage';
import type { NextcloudCredentials, GoogleDriveCredentials, DropboxCredentials } from '../cloudCredentialStorage';

// Mock encryption functions
vi.mock('../encryption', () => ({
  encryptData: vi.fn(async (plaintext: string) => ({
    encrypted: new TextEncoder().encode(plaintext).buffer,
    iv: new Uint8Array(12).buffer,
  })),
  decryptData: vi.fn(async (encrypted: ArrayBuffer) => {
    return new TextDecoder().decode(encrypted);
  }),
  arrayBufferToBase64: vi.fn((buffer: ArrayBuffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }),
  base64ToArrayBuffer: vi.fn((base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }),
}));

describe('CloudCredentialStorage', () => {
  let mockMasterKey: CryptoKey;

  beforeEach(() => {
    localStorage.clear();
    mockMasterKey = {} as CryptoKey;
  });

  describe('saveCredentials', () => {
    it('should save Nextcloud credentials', async () => {
      const credentials: NextcloudCredentials = {
        provider: 'nextcloud',
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'password123',
      };

      await CloudCredentialStorage.saveCredentials(credentials, mockMasterKey);

      const stored = localStorage.getItem('cloud_credentials_nextcloud_encrypted');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toHaveProperty('data');
      expect(JSON.parse(stored!)).toHaveProperty('iv');
    });

    it('should save Google Drive credentials', async () => {
      const credentials: GoogleDriveCredentials = {
        provider: 'google-drive',
        accessToken: 'access123',
        refreshToken: 'refresh123',
        expiresAt: Date.now() + 3600000,
      };

      await CloudCredentialStorage.saveCredentials(credentials, mockMasterKey);

      const stored = localStorage.getItem('cloud_credentials_google-drive_encrypted');
      expect(stored).toBeTruthy();
    });

    it('should save Dropbox credentials', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'dbx_access',
        refreshToken: 'dbx_refresh',
        expiresAt: Date.now() + 3600000,
      };

      await CloudCredentialStorage.saveCredentials(credentials, mockMasterKey);

      const stored = localStorage.getItem('cloud_credentials_dropbox_encrypted');
      expect(stored).toBeTruthy();
    });
  });

  describe('loadCredentials', () => {
    it('should load and decrypt Nextcloud credentials', async () => {
      const credentials: NextcloudCredentials = {
        provider: 'nextcloud',
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'password123',
      };

      await CloudCredentialStorage.saveCredentials(credentials, mockMasterKey);
      const loaded = await CloudCredentialStorage.loadCredentials<NextcloudCredentials>('nextcloud', mockMasterKey);

      expect(loaded).toBeTruthy();
      expect(loaded?.provider).toBe('nextcloud');
      expect(loaded?.serverUrl).toBe('https://cloud.example.com');
    });

    it('should return null if credentials do not exist', async () => {
      const loaded = await CloudCredentialStorage.loadCredentials('nextcloud', mockMasterKey);
      expect(loaded).toBeNull();
    });

    it('should return null and clean up on decryption error', async () => {
      // Store invalid encrypted data
      localStorage.setItem('cloud_credentials_nextcloud_encrypted', JSON.stringify({
        data: 'invalid_base64',
        iv: 'invalid_iv',
      }));

      const loaded = await CloudCredentialStorage.loadCredentials('nextcloud', mockMasterKey);
      
      expect(loaded).toBeNull();
      expect(localStorage.getItem('cloud_credentials_nextcloud_encrypted')).toBeNull();
    });
  });

  describe('removeCredentials', () => {
    it('should remove credentials for a provider', async () => {
      const credentials: NextcloudCredentials = {
        provider: 'nextcloud',
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'password123',
      };

      await CloudCredentialStorage.saveCredentials(credentials, mockMasterKey);
      expect(localStorage.getItem('cloud_credentials_nextcloud_encrypted')).toBeTruthy();

      await CloudCredentialStorage.removeCredentials('nextcloud', mockMasterKey);
      expect(localStorage.getItem('cloud_credentials_nextcloud_encrypted')).toBeNull();
    });

    it('should throw error if removal fails', async () => {
      // Mock localStorage to simulate removal failure
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        // Simulate failure by not actually removing
      });
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('still_here');

      await expect(
        CloudCredentialStorage.removeCredentials('nextcloud', mockMasterKey)
      ).rejects.toThrow('Failed to remove credentials from storage');

      setItemSpy.mockRestore();
      removeItemSpy.mockRestore();
      getItemSpy.mockRestore();
    });
  });

  describe('clearCredentials', () => {
    it('should clear credentials for a provider', async () => {
      const credentials: NextcloudCredentials = {
        provider: 'nextcloud',
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'password123',
      };

      await CloudCredentialStorage.saveCredentials(credentials, mockMasterKey);
      expect(localStorage.getItem('cloud_credentials_nextcloud_encrypted')).toBeTruthy();

      CloudCredentialStorage.clearCredentials('nextcloud');
      expect(localStorage.getItem('cloud_credentials_nextcloud_encrypted')).toBeNull();
    });
  });

  describe('hasCredentials', () => {
    it('should return true if credentials exist', async () => {
      const credentials: NextcloudCredentials = {
        provider: 'nextcloud',
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'password123',
      };

      await CloudCredentialStorage.saveCredentials(credentials, mockMasterKey);
      expect(CloudCredentialStorage.hasCredentials('nextcloud')).toBe(true);
    });

    it('should return false if credentials do not exist', () => {
      expect(CloudCredentialStorage.hasCredentials('nextcloud')).toBe(false);
    });
  });
});
