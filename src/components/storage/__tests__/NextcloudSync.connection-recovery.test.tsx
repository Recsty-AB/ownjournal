import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { NextcloudSync } from '../NextcloudSync';

const { mockService } = vi.hoisted(() => ({
  mockService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    test: vi.fn(),
    isConnected: true,
    upload: vi.fn(),
    download: vi.fn(),
    listFiles: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  },
}));

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
    clearCredentials: vi.fn(),
    hasCredentials: vi.fn().mockReturnValue(true),
    forceRemoveCredentials: vi.fn(),
  },
}));

vi.mock('@/utils/cloudValidation', () => ({
  nextcloudConfigSchema: {
    safeParse: vi.fn(() => ({ success: true })),
  },
  normalizeServerUrl: vi.fn((url: string) => url),
  connectionRateLimiter: {
    canAttempt: vi.fn(() => true),
    getRemainingTime: vi.fn(() => 0),
    reset: vi.fn(),
  },
}));

vi.mock('@/services/nextcloudDirectService', () => {
  const MockNextcloudDirectService = vi.fn().mockImplementation(function() { return mockService; });
  return { NextcloudDirectService: MockNextcloudDirectService };
});

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getMasterKey: vi.fn().mockReturnValue(null),
    initialize: vi.fn(),
    enableSync: vi.fn(),
    disableSync: vi.fn(),
    clearLocalSyncState: vi.fn().mockResolvedValue(undefined),
    resetEncryptionState: vi.fn(),
    onCloudProviderConnected: vi.fn().mockResolvedValue(undefined),
    isPendingOAuth: false,
    isInitializationInProgress: false,
  },
}));

vi.mock('@/utils/simpleModeCredentialStorage', () => ({
  SimpleModeCredentialStorage: {
    loadGoogleDriveCredentials: vi.fn().mockReturnValue(null),
    saveGoogleDriveCredentials: vi.fn(),
    clearGoogleDriveCredentials: vi.fn(),
    hasGoogleDriveCredentials: vi.fn().mockReturnValue(false),
    loadDropboxCredentials: vi.fn().mockReturnValue(null),
    saveDropboxCredentials: vi.fn(),
    clearDropboxCredentials: vi.fn(),
    hasDropboxCredentials: vi.fn().mockReturnValue(false),
    loadNextcloudCredentials: vi.fn().mockReturnValue(null),
    saveNextcloudCredentials: vi.fn(),
    clearNextcloudCredentials: vi.fn(),
    hasNextcloudCredentials: vi.fn().mockReturnValue(false),
    loadICloudCredentials: vi.fn().mockReturnValue(null),
    saveICloudCredentials: vi.fn(),
    clearICloudCredentials: vi.fn(),
    hasICloudCredentials: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@/services/cloudStorageService', () => ({
  cloudStorageService: {
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
  },
}));

vi.mock('@/utils/encryptionModeStorage', () => ({
  getEncryptionMode: vi.fn().mockReturnValue('e2e'),
}));

vi.mock('@/services/connectionStateManager', () => ({
  connectionStateManager: {
    isConnected: vi.fn().mockReturnValue(false),
    isPrimaryProvider: vi.fn().mockReturnValue(false),
    getProviderDisplayConfig: vi.fn().mockReturnValue(null),
    subscribe: vi.fn(() => () => {}),
    isExplicitlyDisabled: vi.fn().mockReturnValue(false),
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
    getConnectedProviderNames: vi.fn().mockReturnValue([]),
    enableProvider: vi.fn(),
    getProviderStatus: vi.fn().mockReturnValue(null),
    setProviderStatus: vi.fn(),
    onStatusChange: vi.fn(() => () => {}),
  },
}));

vi.mock('@/hooks/usePlatform', () => ({
  usePlatform: () => ({ isWeb: true, isMobile: false, isDesktop: false }),
}));

vi.mock('@/utils/nextcloudQrScanner', () => ({
  isQrScanningAvailable: vi.fn().mockReturnValue(false),
  scanNextcloudQr: vi.fn(),
}));

// Helper to flush all pending promises and microtasks with fake timers
async function flushPromises() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

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

    // Flush async effects (loadConfig, credential load, connect, test)
    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect((window as any).nextcloudSync).toBeDefined();

    const initialBinding = (window as any).nextcloudSync;

    // Simulate temporary connection loss (but config still exists)
    mockService.isConnected = false;

    // Advance time but not enough to trigger health check (initial check at 30s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Window binding should still exist and be the same object
    expect((window as any).nextcloudSync).toBeDefined();
    expect((window as any).nextcloudSync).toBe(initialBinding);

    // The isConnected getter should reflect current status
    expect((window as any).nextcloudSync.isConnected).toBe(false);
  });

  it('should perform health checks periodically', async () => {
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );

    // Flush connection establishment
    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(mockService.connect).toHaveBeenCalled();

    // Reset mock to track subsequent calls
    mockService.test.mockClear();

    // Advance past initial 30-second delay for first health check
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(mockService.test).toHaveBeenCalledTimes(1);

    // Advance another 60 seconds for the periodic interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(mockService.test).toHaveBeenCalledTimes(2);

    // Advance another 60 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(mockService.test).toHaveBeenCalledTimes(3);
  });

  it('should recover connection after multiple consecutive health check failures', async () => {
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );

    // Flush connection establishment
    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(mockService.connect).toHaveBeenCalled();
    const initialConnectCalls = mockService.connect.mock.calls.length;

    // Component requires 3 consecutive failures before recovery (MAX_FAILURES_BEFORE_LOG = 3)
    // Set up 3 consecutive failures
    mockService.test.mockResolvedValue(false);

    // Trigger initial health check (30s)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    // Trigger 2nd health check (60s interval)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    // Trigger 3rd health check (60s interval) - should trigger recovery
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    // Should attempt recovery by calling connect again after 3 failures
    expect(mockService.connect).toHaveBeenCalledTimes(initialConnectCalls + 1);
  });

  it('should clear health checks on unmount', async () => {
    const { unmount } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );

    // Flush connection establishment
    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(mockService.connect).toHaveBeenCalled();
    mockService.test.mockClear();

    // Unmount component
    unmount();

    // Advance time significantly past health check intervals
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });

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

    // Flush connection establishment
    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(mockService.connect).toHaveBeenCalledWith({
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass123',
    });

    // Simulate 3 consecutive health check failures to trigger recovery
    mockService.test.mockResolvedValue(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);  // 1st check
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);  // 2nd check
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);  // 3rd check - triggers recovery
    });

    // Should reconnect with same config
    const lastCall = mockService.connect.mock.calls[mockService.connect.mock.calls.length - 1];
    expect(lastCall[0]).toEqual({
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass123',
    });
  });
});
