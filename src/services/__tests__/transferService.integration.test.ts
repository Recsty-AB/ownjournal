/**
 * Integration tests for TransferService
 * Tests provider-to-provider transfer workflows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransferService } from '../transferService';
import type { CloudProvider, CloudFile } from '@/types/cloudProvider';

// Mock transfer state manager
const mockStateManager = {
  saveProgress: vi.fn(),
  loadProgress: vi.fn(() => null),
  clearProgress: vi.fn(),
  isInProgress: vi.fn(() => false),
};

vi.mock('@/utils/transferState', () => ({
  TransferStateManager: vi.fn().mockImplementation(() => mockStateManager),
}));

const createMockProvider = (name: string, files: CloudFile[] = []): CloudProvider => ({
  name,
  isConnected: true,
  upload: vi.fn().mockResolvedValue(undefined),
  download: vi.fn((path: string) => {
    const file = files.find(f => f.path === path);
    return Promise.resolve(file ? `content-of-${file.name}` : null);
  }),
  listFiles: vi.fn().mockResolvedValue(files),
  delete: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn((path: string) => {
    return Promise.resolve(files.some(f => f.path === path));
  }),
});

describe('TransferService - Integration', () => {
  let transferService: TransferService;
  let sourceProvider: CloudProvider;
  let targetProvider: CloudProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    transferService = new TransferService();

    const mockFiles: CloudFile[] = [
      { name: 'entry1.json', path: '/OwnJournal/entries/entry1.json', modifiedAt: new Date('2024-01-01') },
      { name: 'entry2.json', path: '/OwnJournal/entries/entry2.json', modifiedAt: new Date('2024-01-02') },
      { name: 'entry3.json', path: '/OwnJournal/entries/entry3.json', modifiedAt: new Date('2024-01-03') },
    ];

    sourceProvider = createMockProvider('Google Drive', mockFiles);
    targetProvider = createMockProvider('Dropbox', []);
  });

  describe('Basic Transfer', () => {
    it('should transfer all files from source to target', async () => {
      const result = await transferService.transfer(sourceProvider, targetProvider);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(3);
      expect(result.transferredFiles).toBe(3);
      expect(result.skippedFiles).toBe(0);
      expect(result.failedFiles).toHaveLength(0);

      // Verify all files were uploaded
      expect(targetProvider.upload).toHaveBeenCalledTimes(3);
      expect(targetProvider.upload).toHaveBeenCalledWith(
        '/OwnJournal/entries/entry1.json',
        'content-of-entry1.json'
      );
    });

    it('should report progress during transfer', async () => {
      const progressCallback = vi.fn();

      await transferService.transfer(sourceProvider, targetProvider, {
        onProgress: progressCallback,
      });

      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenCalledWith(1, 3, 'entry1.json');
      expect(progressCallback).toHaveBeenCalledWith(2, 3, 'entry2.json');
      expect(progressCallback).toHaveBeenCalledWith(3, 3, 'entry3.json');
    });

    it('should handle empty source', async () => {
      vi.mocked(sourceProvider.listFiles).mockResolvedValue([]);

      const result = await transferService.transfer(sourceProvider, targetProvider);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(0);
      expect(result.transferredFiles).toBe(0);
    });
  });

  describe('Conflict Resolution', () => {
    it('should skip files when conflict resolution returns skip', async () => {
      // Target already has some files
      vi.mocked(targetProvider.exists).mockResolvedValue(true);

      const result = await transferService.transfer(sourceProvider, targetProvider, {
        onConflict: () => 'skip',
      });

      expect(result.success).toBe(true);
      expect(result.skippedFiles).toBe(3);
      expect(result.transferredFiles).toBe(0);
      expect(targetProvider.upload).not.toHaveBeenCalled();
    });

    it('should overwrite files when conflict resolution returns overwrite', async () => {
      vi.mocked(targetProvider.exists).mockResolvedValue(true);

      const result = await transferService.transfer(sourceProvider, targetProvider, {
        onConflict: () => 'overwrite',
      });

      expect(result.success).toBe(true);
      expect(result.transferredFiles).toBe(3);
      expect(result.skippedFiles).toBe(0);
      expect(targetProvider.upload).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed conflict resolutions', async () => {
      vi.mocked(targetProvider.exists).mockResolvedValue(true);

      let callCount = 0;
      const result = await transferService.transfer(sourceProvider, targetProvider, {
        onConflict: (fileName) => {
          callCount++;
          return callCount === 1 ? 'skip' : 'overwrite';
        },
      });

      expect(result.success).toBe(true);
      expect(result.skippedFiles).toBe(1);
      expect(result.transferredFiles).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should continue transfer when individual files fail', async () => {
      // Make second file fail
      vi.mocked(sourceProvider.download).mockImplementation((path: string) => {
        if (path.includes('entry2')) {
          return Promise.reject(new Error('Download failed'));
        }
        return Promise.resolve(`content-of-${path.split('/').pop()}`);
      });

      const result = await transferService.transfer(sourceProvider, targetProvider, {
        maxRetries: 1,
      });

      expect(result.success).toBe(true); // Overall success despite one failure
      expect(result.transferredFiles).toBe(2);
      expect(result.failedFiles).toHaveLength(1);
      expect(result.failedFiles[0]).toBe('entry2.json');
    });

    it('should retry failed operations', async () => {
      let attempts = 0;
      vi.mocked(targetProvider.upload).mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve();
      });

      const result = await transferService.transfer(sourceProvider, targetProvider, {
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(targetProvider.upload).toHaveBeenCalled();
    });

    it('should handle source listing failures', async () => {
      vi.mocked(sourceProvider.listFiles).mockRejectedValue(new Error('Cannot list files'));

      const result = await transferService.transfer(sourceProvider, targetProvider);

      expect(result.success).toBe(false);
      expect(result.totalFiles).toBe(0);
    });
  });

  describe('Checksum Verification', () => {
    it('should verify file integrity when enabled', async () => {
      const result = await transferService.transfer(sourceProvider, targetProvider, {
        verifyChecksums: true,
      });

      expect(result.success).toBe(true);
      expect(result.transferredFiles).toBe(3);

      // Verify downloads happened for verification
      expect(sourceProvider.download).toHaveBeenCalled();
      expect(targetProvider.download).toHaveBeenCalled();
    });

    it('should fail transfer if checksum verification fails', async () => {
      // Make target return different content
      vi.mocked(targetProvider.download).mockResolvedValue('corrupted-content');

      const result = await transferService.transfer(sourceProvider, targetProvider, {
        verifyChecksums: true,
      });

      expect(result.success).toBe(true);
      expect(result.failedFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Transfer Control', () => {
    it('should allow stopping transfer mid-process', async () => {
      const progressCallback = vi.fn((current) => {
        if (current === 2) {
          transferService.stop();
        }
      });

      const result = await transferService.transfer(sourceProvider, targetProvider, {
        onProgress: progressCallback,
      });

      expect(result.success).toBe(false);
      expect(result.transferredFiles).toBeLessThan(3);
    });

    it('should prevent concurrent transfers', async () => {
      const transfer1 = transferService.transfer(sourceProvider, targetProvider);
      const transfer2 = transferService.transfer(sourceProvider, targetProvider);

      const [result1, result2] = await Promise.all([transfer1, transfer2]);

      // One should succeed, one should fail with concurrent error
      const results = [result1, result2];
      expect(results.filter(r => !r.success).length).toBe(1);
    });
  });

  describe('Progress Persistence', () => {
    it('should save progress during transfer', async () => {
      await transferService.transfer(sourceProvider, targetProvider);

      expect(mockStateManager.saveProgress).toHaveBeenCalled();
    });

    it('should clear progress on successful completion', async () => {
      await transferService.transfer(sourceProvider, targetProvider);

      expect(mockStateManager.clearProgress).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should complete transfer within reasonable time', async () => {
      const start = Date.now();
      await transferService.transfer(sourceProvider, targetProvider);
      const duration = Date.now() - start;

      // Should complete in less than 1 second for 3 files
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large file sets efficiently', async () => {
      const largeFileSet: CloudFile[] = Array.from({ length: 100 }, (_, i) => ({
        name: `entry${i}.json`,
        path: `/OwnJournal/entries/entry${i}.json`,
        modifiedAt: new Date(),
      }));

      vi.mocked(sourceProvider.listFiles).mockResolvedValue(largeFileSet);

      const start = Date.now();
      const result = await transferService.transfer(sourceProvider, targetProvider);
      const duration = Date.now() - start;

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(100);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle files with special characters in names', async () => {
      const specialFiles: CloudFile[] = [
        { name: 'entry with spaces.json', path: '/OwnJournal/entries/entry with spaces.json', modifiedAt: new Date() },
        { name: 'entry-with-dashes.json', path: '/OwnJournal/entries/entry-with-dashes.json', modifiedAt: new Date() },
      ];

      vi.mocked(sourceProvider.listFiles).mockResolvedValue(specialFiles);

      const result = await transferService.transfer(sourceProvider, targetProvider);

      expect(result.success).toBe(true);
      expect(result.transferredFiles).toBe(2);
    });

    it('should handle empty files', async () => {
      vi.mocked(sourceProvider.download).mockResolvedValue('');

      const result = await transferService.transfer(sourceProvider, targetProvider);

      expect(result.success).toBe(true);
      expect(targetProvider.upload).toHaveBeenCalledWith(
        expect.any(String),
        ''
      );
    });

    it('should handle very large files', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      vi.mocked(sourceProvider.download).mockResolvedValue(largeContent);

      const result = await transferService.transfer(sourceProvider, targetProvider);

      expect(result.success).toBe(true);
      expect(targetProvider.upload).toHaveBeenCalledWith(
        expect.any(String),
        largeContent
      );
    });
  });
});
