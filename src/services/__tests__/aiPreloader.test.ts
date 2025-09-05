import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { aiPreloader } from '../aiPreloader';
import { localAI } from '../localAI';
import { aiModeStorage } from '@/utils/aiModeStorage';

vi.mock('../localAI', () => ({
  localAI: {
    initialize: vi.fn(),
    isInitializing: vi.fn(),
    areModelsCached: vi.fn(),
  },
}));

vi.mock('@/utils/aiModeStorage', () => ({
  aiModeStorage: {
    getMode: vi.fn(),
  },
}));

describe('AIPreloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiModeStorage.getMode).mockReturnValue('local');
    vi.mocked(localAI.isInitializing).mockReturnValue(false);
  });

  afterEach(() => {
    // Reset preloader state
    (aiPreloader as unknown as { status: string }).status = 'idle';
    (aiPreloader as unknown as { preloadPromise: Promise<void> | null }).preloadPromise = null;
  });

  describe('Status Management', () => {
    it('should start with idle status', () => {
      expect(aiPreloader.getStatus()).toBe('idle');
    });

    it('should return current progress', () => {
      expect(aiPreloader.getProgress()).toBe(0);
    });

    it('should return status message', () => {
      expect(aiPreloader.getStatusMessage()).toBe('');
    });

    it('should return download metrics', () => {
      const metrics = aiPreloader.getMetrics();
      
      expect(metrics).toHaveProperty('estimatedTotalMB');
      expect(metrics).toHaveProperty('downloadedMB');
      expect(metrics).toHaveProperty('speedMBps');
      expect(metrics).toHaveProperty('remainingSeconds');
    });
  });

  describe('Subscribe/Unsubscribe', () => {
    it('should notify subscriber immediately on subscribe', () => {
      const callback = vi.fn();
      
      aiPreloader.subscribe(callback);
      
      expect(callback).toHaveBeenCalledWith('idle', 0, '', expect.any(Object));
    });

    it('should notify multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      aiPreloader.subscribe(callback1);
      aiPreloader.subscribe(callback2);
      
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      
      const unsubscribe = aiPreloader.subscribe(callback);
      callback.mockClear();
      
      unsubscribe();
      
      // Trigger a status change
      (aiPreloader as unknown as { notify: () => void }).notify();
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('startPreload', () => {
    it('should skip preload if not in local mode', async () => {
      vi.mocked(aiModeStorage.getMode).mockReturnValue('cloud');
      
      await aiPreloader.startPreload();
      
      expect(localAI.initialize).not.toHaveBeenCalled();
      expect(aiPreloader.getStatus()).toBe('idle');
    });

    it('should skip if models already cached', async () => {
      vi.mocked(localAI.areModelsCached).mockResolvedValue(true);
      
      await aiPreloader.startPreload();
      
      expect(localAI.initialize).not.toHaveBeenCalled();
      expect(aiPreloader.getStatus()).toBe('ready');
    });

    it('should initialize models when not cached', async () => {
      vi.mocked(localAI.areModelsCached).mockResolvedValue(false);
      vi.mocked(localAI.initialize).mockImplementation(async (onProgress) => {
        if (onProgress) {
          onProgress('Loading models', 50);
          onProgress('Models ready', 100);
        }
      });
      
      await aiPreloader.startPreload();
      
      expect(localAI.initialize).toHaveBeenCalled();
      expect(aiPreloader.getStatus()).toBe('ready');
    });

    it('should handle initialization errors', async () => {
      vi.mocked(localAI.areModelsCached).mockResolvedValue(false);
      vi.mocked(localAI.initialize).mockRejectedValue(new Error('Init failed'));
      
      await aiPreloader.startPreload();
      
      expect(aiPreloader.getStatus()).toBe('error');
    });

    it('should be idempotent', async () => {
      vi.mocked(localAI.areModelsCached).mockResolvedValue(false);
      vi.mocked(localAI.initialize).mockResolvedValue(undefined);
      
      const promise1 = aiPreloader.startPreload();
      const promise2 = aiPreloader.startPreload();
      
      await Promise.all([promise1, promise2]);
      
      expect(localAI.initialize).toHaveBeenCalledTimes(1);
    });

    it('should skip if already initializing', async () => {
      vi.mocked(localAI.isInitializing).mockReturnValue(true);
      
      await aiPreloader.startPreload();
      
      expect(localAI.initialize).not.toHaveBeenCalled();
    });
  });

  describe('Progress Tracking', () => {
    it('should update progress during initialization', async () => {
      vi.mocked(localAI.areModelsCached).mockResolvedValue(false);
      
      const progressUpdates: number[] = [];
      const callback = vi.fn((status, progress) => {
        progressUpdates.push(progress);
      });
      
      aiPreloader.subscribe(callback);
      
      vi.mocked(localAI.initialize).mockImplementation(async (onProgress) => {
        if (onProgress) {
          onProgress('Loading', 25);
          onProgress('Loading', 50);
          onProgress('Loading', 75);
          onProgress('Complete', 100);
        }
      });
      
      await aiPreloader.startPreload();
      
      expect(progressUpdates).toContain(25);
      expect(progressUpdates).toContain(100);
    });

    it('should calculate download metrics', async () => {
      vi.mocked(localAI.areModelsCached).mockResolvedValue(false);
      
      vi.mocked(localAI.initialize).mockImplementation(async (onProgress) => {
        if (onProgress) {
          onProgress('Loading', 50);
        }
      });
      
      await aiPreloader.startPreload();
      
      const metrics = aiPreloader.getMetrics();
      expect(metrics.downloadedMB).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should set error status on failure', async () => {
      vi.mocked(localAI.areModelsCached).mockResolvedValue(false);
      vi.mocked(localAI.initialize).mockRejectedValue(new Error('Network error'));
      
      await aiPreloader.startPreload();
      
      expect(aiPreloader.getStatus()).toBe('error');
      expect(aiPreloader.getStatusMessage()).toContain('error');
    });

    it('should allow retry after error', async () => {
      vi.mocked(localAI.areModelsCached).mockResolvedValue(false);
      vi.mocked(localAI.initialize)
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValueOnce(undefined);
      
      await aiPreloader.startPreload();
      expect(aiPreloader.getStatus()).toBe('error');
      
      await aiPreloader.startPreload();
      expect(aiPreloader.getStatus()).toBe('ready');
    });
  });
});
