import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DropboxService } from '../dropboxService';
import type { DropboxCredentials } from '@/utils/cloudCredentialStorage';

// Mock the dependencies
vi.mock('@/utils/cloudCredentialStorage', () => ({
  CloudCredentialStorage: {
    saveCredentials: vi.fn().mockResolvedValue(undefined),
    loadCredentials: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/utils/cloudRetry', () => ({
  retryWithBackoff: vi.fn((fn) => fn()),
  sanitizeFileName: vi.fn((name) => name),
  getApiErrorDetails: vi.fn().mockResolvedValue('Error details'),
}));

describe('DropboxService', () => {
  let service: DropboxService;
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockMasterKey: CryptoKey;

  beforeEach(() => {
    service = new DropboxService();
    mockMasterKey = {} as CryptoKey;
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect with valid credentials', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      expect(service.isConnected).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clear credentials', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);
      service.disconnect();

      expect(service.isConnected).toBe(false);
    });
  });

  describe('token refresh', () => {
    it('should refresh token when expired', async () => {
      const expiredCredentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000, // Expired
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600,
        }),
      });

      await service.connect(expiredCredentials, mockMasterKey);

      // Trigger an operation that requires a valid token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: [] }),
      });

      await service.listFiles('');

      // Should have called refresh endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dropboxapi.com/oauth2/token',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle refresh token failure', async () => {
      const expiredCredentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'old-token',
        refreshToken: 'invalid-refresh',
        expiresAt: Date.now() - 1000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant' }),
      });

      await service.connect(expiredCredentials, mockMasterKey);

      await expect(service.listFiles('')).rejects.toThrow();
    });

    it('should handle concurrent refresh requests', async () => {
      const expiredCredentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000,
      };

      let refreshCallCount = 0;
      mockFetch.mockImplementation(async (url) => {
        if (url === 'https://api.dropboxapi.com/oauth2/token') {
          refreshCallCount++;
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            ok: true,
            json: async () => ({
              access_token: 'new-token',
              expires_in: 3600,
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ entries: [] }),
        };
      });

      await service.connect(expiredCredentials, mockMasterKey);

      // Make multiple concurrent requests
      await Promise.all([
        service.listFiles(''),
        service.listFiles(''),
        service.listFiles(''),
      ]);

      // Should only refresh once despite concurrent requests
      expect(refreshCallCount).toBe(1);
    });
  });

  describe('upload', () => {
    it('should upload file successfully', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'file-id' }),
      });

      await service.upload('test.json', '{"data": "test"}');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://content.dropboxapi.com/2/files/upload',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Dropbox-API-Arg': expect.stringContaining('/OwnJournal/test.json'),
          }),
        })
      );
    });

    it('should handle upload errors', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(service.upload('test.json', '{"data": "test"}')).rejects.toThrow();
    });
  });

  describe('download', () => {
    it('should download file successfully', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '{"data": "test"}',
      });

      const content = await service.download('test.json');

      expect(content).toBe('{"data": "test"}');
    });

    it('should return null for non-existent file', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409, // File not found
      });

      const content = await service.download('nonexistent.json');

      expect(content).toBeNull();
    });
  });

  describe('401 handling', () => {
    it('should refresh token on 401 and retry', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      // First call returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      // Refresh token call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600,
        }),
      });

      // Retry with new token succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: [] }),
      });

      await service.listFiles('');

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('listFiles', () => {
    it('should list files successfully', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [
            {
              '.tag': 'file',
              name: 'test1.json',
              path_display: '/OwnJournal/test1.json',
              server_modified: '2024-01-01T00:00:00Z',
              size: 100,
            },
            {
              '.tag': 'folder',
              name: 'folder',
            },
            {
              '.tag': 'file',
              name: 'test2.json',
              path_display: '/OwnJournal/test2.json',
              server_modified: '2024-01-02T00:00:00Z',
              size: 200,
            },
          ],
        }),
      });

      const files = await service.listFiles('');

      expect(files).toHaveLength(2); // Should filter out folders
      expect(files[0].name).toBe('test1.json');
      expect(files[0].size).toBe(100);
    });

    it('should return empty array for non-existent folder', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
      });

      const files = await service.listFiles('nonexistent');

      expect(files).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete file successfully', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await service.delete('test.json');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.dropboxapi.com/2/files/delete_v2',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('/OwnJournal/test.json'),
        })
      );
    });

    it('should handle delete of non-existent file', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409, // File not found
      });

      // Should not throw
      await service.delete('nonexistent.json');
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const exists = await service.exists('test.json');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const exists = await service.exists('nonexistent.json');

      expect(exists).toBe(false);
    });

    it('should return false on error', async () => {
      const credentials: DropboxCredentials = {
        provider: 'dropbox',
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
      };

      await service.connect(credentials, mockMasterKey);

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const exists = await service.exists('test.json');

      expect(exists).toBe(false);
    });
  });
});
