import { describe, it, expect, beforeEach, vi } from 'vitest';
import { localAI } from '../localAI';

// Mock @huggingface/transformers
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(),
  env: {
    backends: {
      onnx: {
        wasm: {
          proxy: false,
        },
      },
    },
  },
}));

describe('LocalAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset internal state
    localAI['summarizer' as any] = null;
    localAI['classifier' as any] = null;
    localAI['initPromise' as any] = null;
    localAI['_isInitializing' as any] = false;
  });

  describe('WebGPU Detection', () => {
    it('should detect WebGPU availability', async () => {
      const mockGPU = {
        requestAdapter: vi.fn().mockResolvedValue({}),
      };

      Object.defineProperty(navigator, 'gpu', {
        value: mockGPU,
        writable: true,
        configurable: true,
      });

      // Access private method via type assertion
      const isAvailable = await (localAI as any).isWebGPUAvailable();
      expect(typeof isAvailable).toBe('boolean');
    });

    it('should handle missing WebGPU', async () => {
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const isAvailable = await (localAI as any).isWebGPUAvailable();
      expect(isAvailable).toBe(false);
    });
  });

  describe('Model Caching', () => {
    it('should check if models are cached', async () => {
      const mockCaches = {
        keys: vi.fn().mockResolvedValue(['transformers-cache']),
        open: vi.fn().mockResolvedValue({
          keys: vi.fn().mockResolvedValue([
            { url: 'https://cdn/mt5-small/model.bin' },
            { url: 'https://cdn/bert-base-multilingual-uncased-sentiment/model.bin' },
          ]),
        }),
      };

      Object.defineProperty(window, 'caches', {
        value: mockCaches,
        writable: true,
      });

      const cached = await localAI.areModelsCached();
      
      expect(mockCaches.keys).toHaveBeenCalled();
    });

    it('should return false if caches not available', async () => {
      Object.defineProperty(window, 'caches', {
        value: undefined,
        writable: true,
      });

      const cached = await localAI.areModelsCached();
      expect(cached).toBe(false);
    });

    it('should handle cache check errors', async () => {
      const mockCaches = {
        keys: vi.fn().mockRejectedValue(new Error('Cache error')),
      };

      Object.defineProperty(window, 'caches', {
        value: mockCaches,
        writable: true,
      });

      const cached = await localAI.areModelsCached();
      expect(cached).toBe(false);
    });
  });

  describe('Clear Model Cache', () => {
    it('should clear all caches', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);
      const mockCaches = {
        keys: vi.fn().mockResolvedValue(['cache1', 'cache2']),
        delete: mockDelete,
      };

      Object.defineProperty(window, 'caches', {
        value: mockCaches,
        writable: true,
      });

      await localAI.clearModelCache();
      
      expect(mockDelete).toHaveBeenCalledTimes(2);
    });

    it('should handle clear errors gracefully', async () => {
      const mockCaches = {
        keys: vi.fn().mockRejectedValue(new Error('Clear failed')),
      };

      Object.defineProperty(window, 'caches', {
        value: mockCaches,
        writable: true,
      });

      await expect(localAI.clearModelCache()).resolves.toBeUndefined();
    });
  });

  describe('Initialization', () => {
    it('should track initialization status', () => {
      expect(localAI.isInitializing()).toBe(false);
      
      localAI['_isInitializing' as any] = true;
      expect(localAI.isInitializing()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      localAI['summarizer' as any] = {};
      localAI['classifier' as any] = {};
      
      const { pipeline } = await import('@huggingface/transformers');
      
      await localAI.initialize();
      
      expect(pipeline).not.toHaveBeenCalled();
    });

    it('should report progress during initialization', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const mockFn = vi.fn().mockResolvedValue({} as any);
      (pipeline as any) = mockFn;
      
      const onProgress = vi.fn();
      
      await localAI.initialize(onProgress);
      
      expect(onProgress).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      vi.mocked(pipeline).mockRejectedValue(new Error('Init failed'));
      
      await expect(localAI.initialize()).rejects.toThrow();
      expect(localAI.isInitializing()).toBe(false);
    });

    it('should allow retry after failed initialization', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const mockFn = vi.fn();
      mockFn.mockRejectedValueOnce(new Error('First fail'));
      mockFn.mockResolvedValueOnce({} as any);
      (pipeline as any) = mockFn;
      
      await expect(localAI.initialize()).rejects.toThrow();
      
      // Reset state and retry
      localAI['initPromise' as any] = null;
      await expect(localAI.initialize()).resolves.not.toThrow();
    });
  });

  describe('Analysis Operations', () => {
    beforeEach(() => {
      localAI['summarizer' as any] = {
        call: vi.fn().mockResolvedValue([{ summary_text: 'Test summary' }]),
      };
      localAI['classifier' as any] = {
        call: vi.fn().mockResolvedValue([{ label: 'POSITIVE', score: 0.9 }]),
      };
    });

    it('should analyze journal entry', async () => {
      const result = await localAI.analyzeEntry('Test journal entry');
      
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('keywords');
    });

    it('should throw if not initialized', async () => {
      localAI['summarizer' as any] = null;
      
      await expect(localAI.analyzeEntry('test')).rejects.toThrow('not initialized');
    });

    it('should generate title suggestions', async () => {
      const result = await localAI.analyzeEntry('Test content for title');
      
      expect(result).toHaveProperty('suggestedTitle');
      expect(result).toHaveProperty('keywords');
    });

    it('should analyze trends', async () => {
      const entries = [
        { body: 'Happy day', mood: 'great' as const, date: new Date() },
        { body: 'Good progress', mood: 'good' as const, date: new Date() },
      ];
      
      const result = await localAI.analyzeTrends(entries);
      
      expect(result).toHaveProperty('emotionalTrends');
      expect(result).toHaveProperty('recurringThemes');
      expect(result).toHaveProperty('insights');
    });

    it('should handle empty entries for trends', async () => {
      const result = await localAI.analyzeTrends([]);
      
      expect(result.insights).toContain('Not enough data');
    });
  });

  describe('Error Handling', () => {
    it('should handle analysis errors gracefully', async () => {
      localAI['summarizer' as any] = {
        call: vi.fn().mockRejectedValue(new Error('Analysis failed')),
      };
      localAI['classifier' as any] = {
        call: vi.fn().mockResolvedValue([{ label: 'POSITIVE' }]),
      };
      
      await expect(localAI.analyzeEntry('test')).rejects.toThrow();
    });

    it('should handle sentiment classification errors', async () => {
      localAI['summarizer' as any] = {
        call: vi.fn().mockResolvedValue([{ summary_text: 'Summary' }]),
      };
      localAI['classifier' as any] = {
        call: vi.fn().mockRejectedValue(new Error('Classification failed')),
      };
      
      await expect(localAI.analyzeEntry('test')).rejects.toThrow();
    });
  });
});
