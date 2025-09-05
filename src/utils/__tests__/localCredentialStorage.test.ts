import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalCredentialStorage } from '../localCredentialStorage';
import { CloudCredentialStorage } from '../cloudCredentialStorage';

// Mock CloudCredentialStorage
vi.mock('../cloudCredentialStorage', () => ({
  CloudCredentialStorage: {
    saveCredentials: vi.fn(),
    loadCredentials: vi.fn(),
    clearCredentials: vi.fn(),
    hasCredentials: vi.fn(),
  },
}));

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

describe('LocalCredentialStorage', () => {
  let mockMasterKey: CryptoKey;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockMasterKey = {} as CryptoKey;
  });

  describe('saveCredentials', () => {
    it('should redirect to CloudCredentialStorage', async () => {
      const credentials = {
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'password123',
      };

      await LocalCredentialStorage.saveCredentials(credentials, mockMasterKey);

      expect(CloudCredentialStorage.saveCredentials).toHaveBeenCalledWith(
        {
          provider: 'nextcloud',
          ...credentials,
        },
        mockMasterKey
      );
    });

    it('should clean up legacy storage after save', async () => {
      localStorage.setItem('nextcloud_credentials_encrypted', 'legacy_data');

      const credentials = {
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'password123',
      };

      await LocalCredentialStorage.saveCredentials(credentials, mockMasterKey);

      expect(localStorage.getItem('nextcloud_credentials_encrypted')).toBeNull();
    });
  });

  describe('loadCredentials', () => {
    it('should load from new CloudCredentialStorage first', async () => {
      const mockCredentials = {
        provider: 'nextcloud' as const,
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'password123',
      };

      vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockCredentials);

      const result = await LocalCredentialStorage.loadCredentials(mockMasterKey);

      expect(result).toEqual({
        serverUrl: mockCredentials.serverUrl,
        username: mockCredentials.username,
        appPassword: mockCredentials.appPassword,
      });
    });

    it('should migrate from legacy storage if new storage is empty', async () => {
      vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(null);

      // Store legacy credentials
      const legacyData = {
        serverUrl: 'https://legacy.example.com',
        username: 'legacyuser',
        appPassword: 'legacypass',
      };
      const encrypted = new TextEncoder().encode(JSON.stringify(legacyData));
      const iv = new Uint8Array(12);
      
      localStorage.setItem('nextcloud_credentials_encrypted', JSON.stringify({
        data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv)),
      }));

      const result = await LocalCredentialStorage.loadCredentials(mockMasterKey);

      expect(CloudCredentialStorage.saveCredentials).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('should return null if no credentials exist', async () => {
      vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(null);

      const result = await LocalCredentialStorage.loadCredentials(mockMasterKey);

      expect(result).toBeNull();
    });

    it('should clean up on error', async () => {
      vi.mocked(CloudCredentialStorage.loadCredentials).mockRejectedValue(new Error('Decryption failed'));

      localStorage.setItem('nextcloud_credentials_encrypted', 'corrupted_data');

      const result = await LocalCredentialStorage.loadCredentials(mockMasterKey);

      expect(result).toBeNull();
      expect(CloudCredentialStorage.clearCredentials).toHaveBeenCalledWith('nextcloud');
    });
  });

  describe('clearCredentials', () => {
    it('should clear both new and legacy storage', () => {
      localStorage.setItem('nextcloud_credentials_encrypted', 'legacy_data');

      LocalCredentialStorage.clearCredentials();

      expect(CloudCredentialStorage.clearCredentials).toHaveBeenCalledWith('nextcloud');
      expect(localStorage.getItem('nextcloud_credentials_encrypted')).toBeNull();
    });
  });

  describe('hasCredentials', () => {
    it('should return true if credentials exist in new storage', () => {
      vi.mocked(CloudCredentialStorage.hasCredentials).mockReturnValue(true);

      const result = LocalCredentialStorage.hasCredentials();

      expect(result).toBe(true);
    });

    it('should return true if credentials exist in legacy storage', () => {
      vi.mocked(CloudCredentialStorage.hasCredentials).mockReturnValue(false);
      localStorage.setItem('nextcloud_credentials_encrypted', 'legacy_data');

      const result = LocalCredentialStorage.hasCredentials();

      expect(result).toBe(true);
    });

    it('should return false if no credentials exist', () => {
      vi.mocked(CloudCredentialStorage.hasCredentials).mockReturnValue(false);

      const result = LocalCredentialStorage.hasCredentials();

      expect(result).toBe(false);
    });
  });
});
