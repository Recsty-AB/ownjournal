import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiCacheService } from '../aiCacheService';
import * as pwa from '@/utils/pwa';

vi.mock('@/utils/pwa', () => ({
  openDB: vi.fn(),
}));

// TODO: fix - tests manually trigger IndexedDB request.onsuccess callbacks but fake-indexeddb handles these internally.
// Needs rewrite to use fake-indexeddb properly or restructure mocks.
describe.skip('AICacheService', () => {
  let mockDB: {
    transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDB = {
      transaction: vi.fn(),
    };

    vi.mocked(pwa.openDB).mockResolvedValue(mockDB as unknown as IDBDatabase);
    
    // Mock crypto.subtle.digest for cache key generation
    Object.defineProperty(global, 'crypto', {
      value: {
        subtle: {
          digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        },
      },
      writable: true,
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys', async () => {
      const mockStore = {
        get: vi.fn(() => ({
          onsuccess: null,
          onerror: null,
          result: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        const request = mockStore.get();
        request.onsuccess();
      }, 0);

      const result = await aiCacheService.getCached('test content', 'entry');
      
      expect(mockTransaction.objectStore).toHaveBeenCalledWith('ai_cache');
    });
  });

  describe('getCached', () => {
    it('should return cached data if not expired', async () => {
      const cachedData = {
        key: 'test-key',
        data: { summary: 'Test summary' },
        timestamp: Date.now(),
        type: 'entry',
      };

      const mockStore = {
        get: vi.fn(() => ({
          result: cachedData,
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        const request = mockStore.get();
        request.onsuccess();
      }, 0);

      const result = await aiCacheService.getCached('test', 'entry');

      expect(result).toEqual({ summary: 'Test summary' });
    });

    it('should return null for expired cache', async () => {
      const expiredData = {
        key: 'test-key',
        data: { summary: 'Old data' },
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days old
        type: 'entry',
      };

      const mockStore = {
        get: vi.fn(() => ({
          result: expiredData,
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        const request = mockStore.get();
        request.onsuccess();
      }, 0);

      const result = await aiCacheService.getCached('test', 'entry');

      expect(result).toBeNull();
    });

    it('should return null if cache miss', async () => {
      const mockStore = {
        get: vi.fn(() => ({
          result: undefined,
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        const request = mockStore.get();
        request.onsuccess();
      }, 0);

      const result = await aiCacheService.getCached('test', 'entry');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(pwa.openDB).mockRejectedValue(new Error('DB error'));

      const result = await aiCacheService.getCached('test', 'entry');

      expect(result).toBeNull();
    });
  });

  describe('setCached', () => {
    it('should store analysis result', async () => {
      const mockStore = {
        put: vi.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        const request = mockStore.put();
        request.onsuccess();
      }, 0);

      await aiCacheService.setCached('test content', 'entry', { summary: 'Test' });

      expect(mockTransaction.objectStore).toHaveBeenCalledWith('ai_cache');
      expect(mockStore.put).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      const mockStore = {
        put: vi.fn(() => ({
          error: new Error('Storage error'),
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        const request = mockStore.put();
        request.onerror();
      }, 0);

      await expect(
        aiCacheService.setCached('test', 'entry', { data: 'test' })
      ).resolves.toBeUndefined();
    });
  });

  describe('clearExpired', () => {
    it('should clear expired cache entries', async () => {
      const mockStore = {
        openCursor: vi.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
        delete: vi.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      const expiredEntry = {
        value: {
          key: 'old-key',
          timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000),
        },
        continue: vi.fn(),
      };

      setTimeout(() => {
        const cursor = mockStore.openCursor();
        cursor.onsuccess({ target: { result: expiredEntry } });
        setTimeout(() => {
          cursor.onsuccess({ target: { result: null } });
        }, 10);
      }, 0);

      await aiCacheService.cleanupExpired();

      expect(mockStore.openCursor).toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should clear all cache entries', async () => {
      const mockStore = {
        clear: vi.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      setTimeout(() => {
        const request = mockStore.clear();
        request.onsuccess();
      }, 0);

      await aiCacheService.clearAll();

      expect(mockStore.clear).toHaveBeenCalled();
    });

    it('should handle clear errors', async () => {
      vi.mocked(pwa.openDB).mockRejectedValue(new Error('DB error'));

      await expect(aiCacheService.clearAll()).resolves.toBeUndefined();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const mockStore = {
        openCursor: vi.fn(() => ({
          onsuccess: null,
          onerror: null,
        })),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockStore),
      };

      mockDB.transaction.mockReturnValue(mockTransaction);

      const entries = [
        { value: { key: '1', type: 'entry', timestamp: Date.now() }, continue: vi.fn() },
        { value: { key: '2', type: 'title', timestamp: Date.now() }, continue: vi.fn() },
      ];

      setTimeout(() => {
        const cursor = mockStore.openCursor();
        cursor.onsuccess({ target: { result: entries[0] } });
        setTimeout(() => {
          cursor.onsuccess({ target: { result: entries[1] } });
          setTimeout(() => {
            cursor.onsuccess({ target: { result: null } });
          }, 10);
        }, 10);
      }, 0);

      // Test that cache operations work
      await aiCacheService.setCached('test', 'entry', { data: 'test' });
      const cached = await aiCacheService.getCached('test', 'entry');
      expect(cached).toEqual({ data: 'test' });
    });
  });
});
