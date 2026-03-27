import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransfer } from '../useTransfer';
import { transferService } from '@/services/transferService';
import type { CloudProvider } from '@/types/cloudProvider';

vi.mock('@/services/transferService', () => ({
  transferService: {
    transfer: vi.fn(),
    stop: vi.fn(),
    onProgress: vi.fn(() => vi.fn()),
    running: false,
    getProgress: vi.fn(() => null),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/utils/translateCloudError', () => ({
  translateCloudError: vi.fn((error: Error) => error.message),
}));

vi.mock('@/utils/encryptionModeStorage', () => ({
  isE2EEnabled: vi.fn(() => false),
}));

vi.mock('@/utils/passwordStorage', () => ({
  retrievePassword: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    validateEncryptionKeyFromProvider: vi.fn(),
  },
}));

describe('useTransfer', () => {
  const mockSourceProvider: CloudProvider = {
    name: 'Dropbox',
    isConnected: true,
    upload: vi.fn(),
    download: vi.fn(),
    listFiles: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  };

  const mockTargetProvider: CloudProvider = {
    name: 'Google Drive',
    isConnected: true,
    upload: vi.fn(),
    download: vi.fn(),
    listFiles: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useTransfer());
    
    expect(result.current.isTransferring).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.currentFile).toBeNull();
  });

  it('should handle successful transfer', async () => {
    vi.mocked(transferService.transfer).mockImplementation(async (source, target, options) => {
      if (options?.onProgress) {
        options.onProgress(5, 10, 'file1.txt');
        options.onProgress(10, 10, 'file10.txt');
      }
      return {
        success: true,
        cancelled: false,
        totalFiles: 10,
        transferredFiles: 10,
        failedFiles: [],
        skippedFiles: 0,
        duration: 1000,
      };
    });

    const { result } = renderHook(() => useTransfer());
    
    await act(async () => {
      await result.current.transfer(mockSourceProvider, mockTargetProvider);
    });

    expect(result.current.isTransferring).toBe(false);

    expect(transferService.transfer).toHaveBeenCalledWith(
      mockSourceProvider,
      mockTargetProvider,
      expect.objectContaining({
        onProgress: expect.any(Function),
        onConflict: expect.any(Function),
        verifyChecksums: true,
        maxRetries: 3,
      })
    );
  });

  it('should update progress during transfer', async () => {
    vi.mocked(transferService.transfer).mockImplementation(async (source, target, options) => {
      if (options?.onProgress) {
        options.onProgress(5, 10, 'file5.txt');
      }
      return {
        success: true,
        cancelled: false,
        totalFiles: 10,
        transferredFiles: 10,
        failedFiles: [],
        skippedFiles: 0,
        duration: 1000,
      };
    });

    const { result } = renderHook(() => useTransfer());

    await act(async () => {
      await result.current.transfer(mockSourceProvider, mockTargetProvider);
    });

    expect(result.current.isTransferring).toBe(false);
  });

  it('should handle transfer errors', async () => {
    vi.mocked(transferService.transfer).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTransfer());
    
    await act(async () => {
      await result.current.transfer(mockSourceProvider, mockTargetProvider);
    });

    expect(result.current.isTransferring).toBe(false);
  });

  it('should handle partial failures', async () => {
    vi.mocked(transferService.transfer).mockResolvedValue({
      success: false,
      cancelled: false,
      totalFiles: 10,
      transferredFiles: 8,
      failedFiles: ['file9.txt', 'file10.txt'],
      skippedFiles: 0,
      duration: 1000,
    });

    const { result } = renderHook(() => useTransfer());
    
    await act(async () => {
      await result.current.transfer(mockSourceProvider, mockTargetProvider);
    });

    expect(result.current.isTransferring).toBe(false);
  });

  it('should reject if source provider not connected', async () => {
    const disconnectedSource = { ...mockSourceProvider, isConnected: false };

    const { result } = renderHook(() => useTransfer());
    
    await act(async () => {
      await result.current.transfer(disconnectedSource, mockTargetProvider);
    });

    expect(transferService.transfer).not.toHaveBeenCalled();
  });

  it('should reject if target provider not connected', async () => {
    const disconnectedTarget = { ...mockTargetProvider, isConnected: false };

    const { result } = renderHook(() => useTransfer());
    
    await act(async () => {
      await result.current.transfer(mockSourceProvider, disconnectedTarget);
    });

    expect(transferService.transfer).not.toHaveBeenCalled();
  });

  it('should stop transfer', async () => {
    let resolveTransfer: (value: any) => void;
    vi.mocked(transferService.transfer).mockImplementation(() => {
      return new Promise(resolve => {
        resolveTransfer = resolve;
      });
    });

    const { result } = renderHook(() => useTransfer());

    // Start the transfer (don't await it)
    let transferPromise: Promise<any>;
    await act(async () => {
      transferPromise = result.current.transfer(mockSourceProvider, mockTargetProvider);
    });

    // Now isTransferring should be true
    expect(result.current.isTransferring).toBe(true);

    // Stop the transfer
    act(() => {
      result.current.stop();
    });

    expect(transferService.stop).toHaveBeenCalled();

    // Resolve the transfer to clean up
    await act(async () => {
      resolveTransfer!({
        success: true,
        cancelled: true,
        totalFiles: 10,
        transferredFiles: 5,
        failedFiles: [],
        skippedFiles: 0,
        duration: 1000,
      });
      await transferPromise!;
    });
  });

  it('should handle conflict resolution', async () => {
    let conflictHandler: ((fileName: string) => string) | undefined;

    vi.mocked(transferService.transfer).mockImplementation(async (source, target, options) => {
      conflictHandler = options?.onConflict;
      return {
        success: true,
        cancelled: false,
        totalFiles: 10,
        transferredFiles: 10,
        failedFiles: [],
        skippedFiles: 0,
        duration: 1000,
      };
    });

    const { result } = renderHook(() => useTransfer());
    
    await act(async () => {
      await result.current.transfer(mockSourceProvider, mockTargetProvider);
    });

    expect(conflictHandler).toBeDefined();
    expect(conflictHandler?.('test.txt')).toBe('overwrite');
  });

  it('should reset state after transfer completes', async () => {
    vi.mocked(transferService.transfer).mockResolvedValue({
      success: true,
      cancelled: false,
      totalFiles: 10,
      transferredFiles: 10,
      failedFiles: [],
      skippedFiles: 0,
      duration: 1000,
    });

    const { result } = renderHook(() => useTransfer());
    
    await act(async () => {
      await result.current.transfer(mockSourceProvider, mockTargetProvider);
    });

    expect(result.current.isTransferring).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.currentFile).toBeNull();
  });
});
