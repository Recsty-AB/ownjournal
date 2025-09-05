import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { NextcloudSync } from '../NextcloudSync';
import { NextcloudDirectService } from '@/services/nextcloudDirectService';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/utils/cloudCredentialStorage', () => ({
  CloudCredentialStorage: {
    loadCredentials: vi.fn().mockResolvedValue({
      provider: 'nextcloud',
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass123',
    }),
    saveCredentials: vi.fn().mockResolvedValue(undefined),
    clearCredentials: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/utils/cloudValidation', () => ({
  nextcloudConfigSchema: {
    safeParse: vi.fn(() => ({ success: true })),
  },
  connectionRateLimiter: {
    canAttempt: vi.fn(() => true),
    getRemainingTime: vi.fn(() => 0),
    reset: vi.fn(),
  },
}));

const mockService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  test: vi.fn(),
  isConnected: true,
  upload: vi.fn(),
  download: vi.fn(),
  listFiles: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
};

vi.mock('@/services/nextcloudDirectService', () => ({
  NextcloudDirectService: vi.fn(() => mockService),
}));

describe('NextcloudSync - Connection Recovery', () => {
  const mockMasterKey = {} as CryptoKey;
  const mockOnConfigChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockService.test.mockResolvedValue(true);
    mockService.isConnected = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should maintain window binding even if isConnected temporarily becomes false', async () => {
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );

    // Wait for connection to establish
    await waitFor(() => {
      expect((window as any).nextcloudSync).toBeDefined();
    });

    const initialBinding = (window as any).nextcloudSync;

    // Simulate temporary connection loss (but config still exists)
    mockService.isConnected = false;

    // Advance time but not enough to trigger health check
    vi.advanceTimersByTime(1000);

    // Window binding should still exist and be the same object
    expect((window as any).nextcloudSync).toBeDefined();
    expect((window as any).nextcloudSync).toBe(initialBinding);
    
    // The isConnected getter should reflect current status
    expect((window as any).nextcloudSync.isConnected).toBe(false);
  });

  it('should perform health checks every 30 seconds', async () => {
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );

    // Wait for connection
    await waitFor(() => {
      expect(mockService.connect).toHaveBeenCalled();
    });

    // Reset mock to track subsequent calls
    mockService.test.mockClear();

    // Advance past initial 5-second delay
    vi.advanceTimersByTime(6000);
    await waitFor(() => {
      expect(mockService.test).toHaveBeenCalledTimes(1);
    });

    // Advance another 30 seconds
    vi.advanceTimersByTime(30000);
    await waitFor(() => {
      expect(mockService.test).toHaveBeenCalledTimes(2);
    });

    // Advance another 30 seconds
    vi.advanceTimersByTime(30000);
    await waitFor(() => {
      expect(mockService.test).toHaveBeenCalledTimes(3);
    });
  });

  it('should recover connection automatically when health check fails', async () => {
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );

    // Wait for initial connection
    await waitFor(() => {
      expect(mockService.connect).toHaveBeenCalled();
    });

    const initialConnectCalls = mockService.connect.mock.calls.length;

    // Simulate health check failure
    mockService.test.mockResolvedValueOnce(false);

    // Advance to trigger health check
    vi.advanceTimersByTime(6000);

    // Should attempt recovery by calling connect again
    await waitFor(() => {
      expect(mockService.connect).toHaveBeenCalledTimes(initialConnectCalls + 1);
    });
  });

  it('should recover from health check errors', async () => {
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );

    await waitFor(() => {
      expect(mockService.connect).toHaveBeenCalled();
    });

    const initialConnectCalls = mockService.connect.mock.calls.length;

    // Simulate health check throwing error
    mockService.test.mockRejectedValueOnce(new Error('Network error'));

    // Advance to trigger health check
    vi.advanceTimersByTime(6000);

    // Should attempt recovery
    await waitFor(() => {
      expect(mockService.connect).toHaveBeenCalledTimes(initialConnectCalls + 1);
    });
  });

  it('should clear health checks on unmount', async () => {
    const { unmount } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );

    await waitFor(() => {
      expect(mockService.connect).toHaveBeenCalled();
    });

    mockService.test.mockClear();

    // Unmount component
    unmount();

    // Advance time significantly
    vi.advanceTimersByTime(60000);

    // Health checks should not run after unmount
    expect(mockService.test).not.toHaveBeenCalled();
  });

  it('should preserve last valid config for recovery', async () => {
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );

    await waitFor(() => {
      expect(mockService.connect).toHaveBeenCalledWith({
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'testpass123',
      });
    });

    // Simulate health check failure
    mockService.test.mockResolvedValueOnce(false);

    // Trigger health check
    vi.advanceTimersByTime(6000);

    // Should reconnect with same config
    await waitFor(() => {
      const lastCall = mockService.connect.mock.calls[mockService.connect.mock.calls.length - 1];
      expect(lastCall[0]).toEqual({
        serverUrl: 'https://cloud.example.com',
        username: 'testuser',
        appPassword: 'testpass123',
      });
    });
  });
});
