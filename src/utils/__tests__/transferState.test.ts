import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransferStateManager, type TransferProgress } from '../transferState';

describe('TransferStateManager', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('save', () => {
    it('should save transfer progress to sessionStorage', () => {
      const progress: TransferProgress = {
        id: 'transfer_123',
        sourceProvider: 'google-drive',
        targetProvider: 'nextcloud',
        totalFiles: 100,
        completedFiles: 50,
        failedFiles: ['file1.txt', 'file2.txt'],
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'running',
        phase: 'copying',
      };

      TransferStateManager.save(progress);

      const stored = sessionStorage.getItem('transfer_progress');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(progress);
    });

    it('should handle sessionStorage errors gracefully', () => {
      const saveSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage full');
      });

      const progress: TransferProgress = {
        id: 'transfer_123',
        sourceProvider: 'google-drive',
        targetProvider: 'nextcloud',
        totalFiles: 100,
        completedFiles: 50,
        failedFiles: [],
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'running',
        phase: 'copying',
      };

      // Should not throw
      expect(() => TransferStateManager.save(progress)).not.toThrow();

      saveSpy.mockRestore();
    });
  });

  describe('load', () => {
    it('should load transfer progress from sessionStorage', () => {
      const progress: TransferProgress = {
        id: 'transfer_123',
        sourceProvider: 'google-drive',
        targetProvider: 'nextcloud',
        totalFiles: 100,
        completedFiles: 50,
        failedFiles: [],
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'running',
        phase: 'copying',
      };

      sessionStorage.setItem('transfer_progress', JSON.stringify(progress));

      const loaded = TransferStateManager.load();
      expect(loaded).toEqual(progress);
    });

    it('should return null if no progress is stored', () => {
      const loaded = TransferStateManager.load();
      expect(loaded).toBeNull();
    });

    it('should return null and clear stale transfers', () => {
      const staleProgress: TransferProgress = {
        id: 'transfer_123',
        sourceProvider: 'google-drive',
        targetProvider: 'nextcloud',
        totalFiles: 100,
        completedFiles: 50,
        failedFiles: [],
        startedAt: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        lastUpdatedAt: Date.now() - (25 * 60 * 60 * 1000),
        status: 'running',
        phase: 'copying',
      };

      sessionStorage.setItem('transfer_progress', JSON.stringify(staleProgress));

      const loaded = TransferStateManager.load();
      expect(loaded).toBeNull();
      expect(sessionStorage.getItem('transfer_progress')).toBeNull();
    });

    it('should return null on parse error', () => {
      sessionStorage.setItem('transfer_progress', 'invalid json');

      const loaded = TransferStateManager.load();
      expect(loaded).toBeNull();
    });

    it('should not expire fresh transfers', () => {
      const freshProgress: TransferProgress = {
        id: 'transfer_123',
        sourceProvider: 'google-drive',
        targetProvider: 'nextcloud',
        totalFiles: 100,
        completedFiles: 50,
        failedFiles: [],
        startedAt: Date.now() - (1 * 60 * 60 * 1000), // 1 hour ago
        lastUpdatedAt: Date.now(),
        status: 'running',
        phase: 'copying',
      };

      sessionStorage.setItem('transfer_progress', JSON.stringify(freshProgress));

      const loaded = TransferStateManager.load();
      expect(loaded).toEqual(freshProgress);
    });
  });

  describe('clear', () => {
    it('should remove transfer progress from sessionStorage', () => {
      const progress: TransferProgress = {
        id: 'transfer_123',
        sourceProvider: 'google-drive',
        targetProvider: 'nextcloud',
        totalFiles: 100,
        completedFiles: 50,
        failedFiles: [],
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'running',
        phase: 'copying',
      };

      sessionStorage.setItem('transfer_progress', JSON.stringify(progress));
      expect(sessionStorage.getItem('transfer_progress')).toBeTruthy();

      TransferStateManager.clear();
      expect(sessionStorage.getItem('transfer_progress')).toBeNull();
    });
  });

  describe('generateId', () => {
    it('should generate unique transfer IDs', () => {
      const id1 = TransferStateManager.generateId();
      const id2 = TransferStateManager.generateId();

      expect(id1).toMatch(/^transfer_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^transfer_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp in ID', () => {
      const id = TransferStateManager.generateId();
      const timestamp = id.split('_')[1];

      expect(parseInt(timestamp)).toBeGreaterThan(Date.now() - 1000);
      expect(parseInt(timestamp)).toBeLessThanOrEqual(Date.now());
    });
  });
});
