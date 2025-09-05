/**
 * Integration tests for CloudStorageService
 * Tests the unified abstraction layer for all cloud storage providers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudStorageService } from '../cloudStorageService';
import type { CloudProvider, CloudFile } from '@/types/cloudProvider';

// Mock connectionStateManager
vi.mock('@/services/connectionStateManager', () => ({
  connectionStateManager: {
    getConnectedProviderNames: vi.fn(),
    getCachedProviderNames: vi.fn(),
    getPrimaryProvider: vi.fn(),
    getConnectedProviders: vi.fn(),
    getConnectedCount: vi.fn(),
    isPrimaryProvider: vi.fn(),
    shouldDelaySync: vi.fn().mockReturnValue(false),
  },
}));

// Mock connectionMonitor
vi.mock('@/utils/connectionMonitor', () => ({
  connectionMonitor: {
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    getAllHealth: vi.fn().mockReturnValue({}),
  },
}));

// Mock uploadQueue
vi.mock('@/services/uploadQueue', () => ({
  uploadQueue: {
    queueUpload: vi.fn().mockResolvedValue(undefined),
    getQueueSize: vi.fn().mockReturnValue(0),
    getPendingFiles: vi.fn().mockReturnValue([]),
  },
}));

import { connectionStateManager } from '@/services/connectionStateManager';
import { uploadQueue } from '@/services/uploadQueue';

// Create mock provider
const createMockProvider = (name: string, isConnected = true): CloudProvider => ({
  name,
  isConnected,
  upload: vi.fn().mockResolvedValue(undefined),
  download: vi.fn().mockResolvedValue('mock-content'),
  listFiles: vi.fn().mockResolvedValue([
    { name: 'entry1.json', path: '/OwnJournal/entries/entry1.json', modifiedAt: new Date('2024-01-01') },
    { name: 'entry2.json', path: '/OwnJournal/entries/entry2.json', modifiedAt: new Date('2024-01-02') },
  ] as CloudFile[]),
  delete: vi.fn().mockResolvedValue(undefined),
  exists: vi.fn().mockResolvedValue(true),
});

describe('CloudStorageService - Integration', () => {
  let service: CloudStorageService;
  let mockGoogleDrive: CloudProvider;
  let mockDropbox: CloudProvider;
  let mockNextcloud: CloudProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    
    service = new CloudStorageService();
    
    mockGoogleDrive = createMockProvider('Google Drive');
    mockDropbox = createMockProvider('Dropbox');
    mockNextcloud = createMockProvider('Nextcloud');

    // Setup default mock returns
    vi.mocked(connectionStateManager.getConnectedProviderNames).mockReturnValue(['Google Drive', 'Dropbox', 'Nextcloud']);
    vi.mocked(connectionStateManager.getCachedProviderNames).mockReturnValue(['Google Drive', 'Dropbox', 'Nextcloud']);
    vi.mocked(connectionStateManager.getPrimaryProvider).mockReturnValue(mockGoogleDrive);
    vi.mocked(connectionStateManager.getConnectedProviders).mockReturnValue([mockGoogleDrive, mockDropbox, mockNextcloud]);
    vi.mocked(connectionStateManager.getConnectedCount).mockReturnValue(3);
    vi.mocked(connectionStateManager.isPrimaryProvider).mockImplementation((name) => name === 'Google Drive');
    vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(false);
  });

  describe('Provider Discovery', () => {
    it('should discover all connected providers', async () => {
      const names = service.getConnectedProviderNames();

      expect(names).toHaveLength(3);
      expect(names).toEqual(['Google Drive', 'Dropbox', 'Nextcloud']);
    });

    it('should filter out disconnected providers', async () => {
      vi.mocked(connectionStateManager.getConnectedProviderNames).mockReturnValue(['Google Drive', 'Nextcloud']);

      const names = service.getConnectedProviderNames();

      expect(names).toHaveLength(2);
      expect(names).toEqual(['Google Drive', 'Nextcloud']);
    });

    it('should handle no connected providers', async () => {
      vi.mocked(connectionStateManager.getConnectedProviderNames).mockReturnValue([]);

      const names = service.getConnectedProviderNames();

      expect(names).toHaveLength(0);
    });

    it('should return cached provider names', async () => {
      vi.mocked(connectionStateManager.getCachedProviderNames).mockReturnValue(['Google Drive', 'Dropbox']);

      const cached = service.getCachedProviderNames();
      
      expect(cached).toEqual(['Google Drive', 'Dropbox']);
    });
  });

  describe('Upload Operations', () => {
    it('should upload to primary provider', async () => {
      await service.uploadToAll('/entries/test.json', 'test-content');

      expect(mockGoogleDrive.upload).toHaveBeenCalledWith(
        '/OwnJournal/entries/test.json',
        'test-content'
      );
    });

    it('should normalize paths before uploading', async () => {
      await service.uploadToAll('entries/test.json', 'test-content');

      expect(mockGoogleDrive.upload).toHaveBeenCalledWith(
        '/OwnJournal/entries/test.json',
        'test-content'
      );
    });

    it('should handle upload failures', async () => {
      vi.mocked(mockGoogleDrive.upload).mockRejectedValue(new Error('Upload failed'));

      await expect(service.uploadToAll('/entries/test.json', 'test-content'))
        .rejects.toThrow('Upload failed');
    });

    it('should throw error if no providers are connected', async () => {
      vi.mocked(connectionStateManager.getPrimaryProvider).mockReturnValue(null);

      await expect(service.uploadToAll('/entries/test.json', 'test-content'))
        .rejects.toThrow('No cloud storage connected');

      expect(mockGoogleDrive.upload).not.toHaveBeenCalled();
    });

    it('should queue upload when rate limit is active', async () => {
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(true);

      await service.uploadToAll('test.json', 'content');

      expect(uploadQueue.queueUpload).toHaveBeenCalledWith('test.json', 'content');
      expect(mockGoogleDrive.upload).not.toHaveBeenCalled();
    });
  });

  describe('Download Operations', () => {
    it('should download from primary provider', async () => {
      const content = await service.downloadFromPrimary('/entries/test.json');

      expect(content).toBe('mock-content');
      expect(mockGoogleDrive.download).toHaveBeenCalledWith('/OwnJournal/entries/test.json');
    });

    it('should normalize paths before downloading', async () => {
      await service.downloadFromPrimary('entries/test.json');

      expect(mockGoogleDrive.download).toHaveBeenCalledWith('/OwnJournal/entries/test.json');
    });

    it('should handle download failures', async () => {
      vi.mocked(mockGoogleDrive.download).mockRejectedValue(new Error('Download failed'));

      await expect(service.downloadFromPrimary('/entries/test.json'))
        .rejects.toThrow('Download failed');
    });

    it('should return null when no providers are connected', async () => {
      vi.mocked(connectionStateManager.getPrimaryProvider).mockReturnValue(null);

      const content = await service.downloadFromPrimary('/entries/test.json');

      expect(content).toBeNull();
    });
  });

  describe('List Operations', () => {
    it('should list files from primary provider', async () => {
      const files = await service.listFiles('/entries');

      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('entry1.json');
      expect(mockGoogleDrive.listFiles).toHaveBeenCalledWith('/OwnJournal/entries');
    });

    it('should normalize paths before listing', async () => {
      await service.listFiles('entries');

      expect(mockGoogleDrive.listFiles).toHaveBeenCalledWith('/OwnJournal/entries');
    });

    it('should return empty array when no provider connected', async () => {
      vi.mocked(connectionStateManager.getPrimaryProvider).mockReturnValue(null);

      const files = await service.listFiles('/entries');

      expect(files).toEqual([]);
    });
  });

  describe('Delete Operations', () => {
    it('should delete from primary provider', async () => {
      await service.deleteFromAll('/entries/test.json');

      expect(mockGoogleDrive.delete).toHaveBeenCalledWith('/OwnJournal/entries/test.json');
    });

    it('should normalize paths before deleting', async () => {
      await service.deleteFromAll('entries/test.json');

      expect(mockGoogleDrive.delete).toHaveBeenCalledWith('/OwnJournal/entries/test.json');
    });

    it('should handle delete failures gracefully', async () => {
      vi.mocked(mockGoogleDrive.delete).mockRejectedValue(new Error('Delete failed'));

      // Should not throw
      await service.deleteFromAll('/entries/test.json');
    });
  });

  describe('Existence Check', () => {
    it('should check if file exists on primary provider', async () => {
      const exists = await service.fileExists('/entries/test.json');

      expect(exists).toBe(true);
      expect(mockGoogleDrive.exists).toHaveBeenCalledWith('/OwnJournal/entries/test.json');
    });

    it('should return false if file does not exist', async () => {
      vi.mocked(mockGoogleDrive.exists).mockResolvedValue(false);

      const exists = await service.fileExists('/entries/test.json');

      expect(exists).toBe(false);
    });

    it('should return false when no provider connected', async () => {
      vi.mocked(connectionStateManager.getPrimaryProvider).mockReturnValue(null);

      const exists = await service.fileExists('/entries/test.json');

      expect(exists).toBe(false);
    });
  });

  describe('Path Normalization', () => {
    it('should handle various path formats', async () => {
      const testPaths = [
        ['entries/test.json', '/OwnJournal/entries/test.json'],
        ['/entries/test.json', '/OwnJournal/entries/test.json'],
        ['OwnJournal/entries/test.json', '/OwnJournal/entries/test.json'],
        ['/OwnJournal/entries/test.json', '/OwnJournal/entries/test.json'],
      ];

      for (const [input, expected] of testPaths) {
        await service.uploadToAll(input, 'content');
        expect(mockGoogleDrive.upload).toHaveBeenCalledWith(expected, 'content');
        vi.clearAllMocks();
        vi.mocked(connectionStateManager.getPrimaryProvider).mockReturnValue(mockGoogleDrive);
        vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(false);
      }
    });
  });

  describe('Queue Status', () => {
    it('should return queue size', () => {
      vi.mocked(uploadQueue.getQueueSize).mockReturnValue(5);
      
      expect(service.getUploadQueueSize()).toBe(5);
    });

    it('should return pending files', () => {
      vi.mocked(uploadQueue.getPendingFiles).mockReturnValue(['file1.json', 'file2.json']);
      
      expect(service.getPendingUploadFiles()).toEqual(['file1.json', 'file2.json']);
    });
  });
});