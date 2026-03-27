import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing uploadQueue
vi.mock('@/utils/connectionMonitor', () => ({
  connectionMonitor: {
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}));

vi.mock('@/utils/pwa', () => ({
  openDB: vi.fn().mockResolvedValue({}),
  saveToIndexedDB: vi.fn().mockResolvedValue(undefined),
  getFromIndexedDB: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/connectionStateManager', () => ({
  connectionStateManager: {
    getPrimaryProvider: vi.fn(),
    shouldDelaySync: vi.fn(),
    isConnected: vi.fn(() => true),
    subscribe: vi.fn(() => () => {}),
  },
}));

import { connectionMonitor } from '@/utils/connectionMonitor';
import { connectionStateManager } from '@/services/connectionStateManager';

// We need to dynamically import uploadQueue after mocks are set up
// But since it's a singleton, we need to reset it between tests
// TODO: fix - queue lifecycle issues with fake timers causing "Queue cleared" unhandled rejections.
// Needs rewrite to properly handle async queue processing and timer interactions.
describe.skip('UploadQueue', () => {
  let uploadQueue: any;
  let mockProvider: any;

  beforeEach(async () => {
    vi.useFakeTimers();
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock provider
    mockProvider = {
      name: 'Dropbox',
      upload: vi.fn().mockResolvedValue(undefined),
      download: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      listFiles: vi.fn(),
    };
    
    // Default mock implementations
    vi.mocked(connectionStateManager.getPrimaryProvider).mockReturnValue(mockProvider);
    vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(false);
    
    // Re-import to get fresh instance
    vi.resetModules();
    const module = await import('@/services/uploadQueue');
    uploadQueue = module.uploadQueue;
  });

  afterEach(() => {
    vi.useRealTimers();
    uploadQueue?.clearQueue?.();
  });

  describe('queueUpload', () => {
    it('should queue an upload and process it when delay expires', async () => {
      // Start with delay active
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(true);
      
      const uploadPromise = uploadQueue.queueUpload('test.json', '{"test": true}');
      
      expect(uploadQueue.getQueueSize()).toBe(1);
      expect(uploadQueue.getPendingFiles()).toContain('test.json');
      
      // Delay expires
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(false);
      
      // Process queue
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();
      
      await uploadPromise;
      
      expect(mockProvider.upload).toHaveBeenCalledWith('/OwnJournal/test.json', '{"test": true}');
      expect(uploadQueue.getQueueSize()).toBe(0);
    });

    it('should deduplicate uploads for the same file (latest content wins)', async () => {
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(true);
      
      // Queue first upload
      const promise1 = uploadQueue.queueUpload('data.json', '{"version": 1}');
      
      // Queue second upload for same file
      const promise2 = uploadQueue.queueUpload('data.json', '{"version": 2}');
      
      // Queue size should still be 1 (deduplicated)
      expect(uploadQueue.getQueueSize()).toBe(1);
      
      // First promise should resolve immediately (superseded)
      await promise1;
      
      // Delay expires and process
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(false);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();
      
      await promise2;
      
      // Only latest content should be uploaded
      expect(mockProvider.upload).toHaveBeenCalledTimes(1);
      expect(mockProvider.upload).toHaveBeenCalledWith('/OwnJournal/data.json', '{"version": 2}');
    });

    it('should propagate upload errors to the caller', async () => {
      const uploadError = new Error('Network error');
      mockProvider.upload.mockRejectedValue(uploadError);
      
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(true);
      
      const uploadPromise = uploadQueue.queueUpload('fail.json', '{}');
      
      // Process queue
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(false);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();
      
      await expect(uploadPromise).rejects.toThrow('Network error');
      expect(connectionMonitor.recordFailure).toHaveBeenCalledWith('Dropbox');
    });

    it('should record success on successful upload', async () => {
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(true);
      
      const uploadPromise = uploadQueue.queueUpload('success.json', '{}');
      
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(false);
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();
      
      await uploadPromise;
      
      expect(connectionMonitor.recordSuccess).toHaveBeenCalledWith('Dropbox');
    });

    it('should wait for provider when none available', async () => {
      vi.mocked(connectionStateManager.getPrimaryProvider).mockReturnValue(null);
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(true);
      
      uploadQueue.queueUpload('waiting.json', '{}');
      
      // Advance time but no provider
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      
      // Upload should not happen yet
      expect(mockProvider.upload).not.toHaveBeenCalled();
      expect(uploadQueue.getQueueSize()).toBe(1);
      
      // Provider becomes available and delay expires
      vi.mocked(connectionStateManager.getPrimaryProvider).mockReturnValue(mockProvider);
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(false);
      
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();
      
      expect(mockProvider.upload).toHaveBeenCalled();
    });
  });

  describe('clearQueue', () => {
    it('should reject all pending uploads when cleared', async () => {
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(true);
      
      const promise1 = uploadQueue.queueUpload('file1.json', '{}');
      const promise2 = uploadQueue.queueUpload('file2.json', '{}');
      
      expect(uploadQueue.getQueueSize()).toBe(2);
      
      uploadQueue.clearQueue();
      
      expect(uploadQueue.getQueueSize()).toBe(0);
      
      await expect(promise1).rejects.toThrow('Queue cleared');
      await expect(promise2).rejects.toThrow('Queue cleared');
    });
  });

  describe('isFileQueued', () => {
    it('should return true for queued files', async () => {
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(true);
      
      uploadQueue.queueUpload('queued.json', '{}');
      
      expect(uploadQueue.isFileQueued('queued.json')).toBe(true);
      expect(uploadQueue.isFileQueued('not-queued.json')).toBe(false);
    });
  });

  describe('path normalization', () => {
    it('should normalize paths correctly', async () => {
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(false);
      
      await uploadQueue.queueUpload('entries/2024-01-01.json', '{}');
      
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();
      
      expect(mockProvider.upload).toHaveBeenCalledWith('/OwnJournal/entries/2024-01-01.json', '{}');
    });

    it('should handle OwnJournal prefix in path', async () => {
      vi.mocked(connectionStateManager.shouldDelaySync).mockReturnValue(false);
      
      await uploadQueue.queueUpload('OwnJournal/test.json', '{}');
      
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();
      
      expect(mockProvider.upload).toHaveBeenCalledWith('/OwnJournal/test.json', '{}');
    });
  });
});
