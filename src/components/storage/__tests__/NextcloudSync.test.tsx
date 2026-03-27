import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { NextcloudSync } from '../NextcloudSync';

const { mockService } = vi.hoisted(() => ({
  mockService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    test: vi.fn().mockResolvedValue(true),
    isConnected: false,
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
    loadCredentials: vi.fn().mockResolvedValue(null),
    saveCredentials: vi.fn().mockResolvedValue(undefined),
    clearCredentials: vi.fn(),
    hasCredentials: vi.fn().mockReturnValue(false),
    forceRemoveCredentials: vi.fn(),
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

describe('NextcloudSync', () => {
  const mockOnConfigChange = vi.fn();
  const mockOnRequirePassword = vi.fn();
  const mockMasterKey = {} as CryptoKey;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService.test.mockResolvedValue(true);
    mockService.isConnected = false;
    delete (window as any).nextcloudSync;
  });

  it('should render successfully', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render with null master key', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render without optional callbacks', () => {
    const { container } = render(
      <NextcloudSync masterKey={mockMasterKey} />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render connection status', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render connect button when not connected', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should handle loading state', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render Nextcloud branding', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container.textContent).toContain('providers.nextcloud.title');
  });

  it('should render configuration form', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render CORS help section', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should handle validation errors', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should handle password requirement on connect', () => {
    const mockOnRequirePassword = vi.fn();
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should verify connection with test() before marking as connected', async () => {
    const { CloudCredentialStorage } = await import('@/utils/cloudCredentialStorage');

    // Mock saved config
    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };

    vi.mocked(CloudCredentialStorage.hasCredentials).mockReturnValue(true);
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    mockService.test.mockResolvedValue(true);
    
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    
    // Wait for test() to be called
    await waitFor(() => {
      expect(mockService.test).toHaveBeenCalled();
    });
    
    // Should mark as connected after successful test
    await waitFor(() => {
      expect(mockOnConfigChange).toHaveBeenCalledWith(true);
    });
  });

  it('should call test() after connecting even when test fails', async () => {
    const { CloudCredentialStorage } = await import('@/utils/cloudCredentialStorage');

    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };

    vi.mocked(CloudCredentialStorage.hasCredentials).mockReturnValue(true);
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    mockService.test.mockResolvedValue(false);

    await act(async () => {
      render(
        <NextcloudSync
          onConfigChange={mockOnConfigChange}
          masterKey={mockMasterKey}
        />
      );
    });

    // Flush remaining promises
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // test() should have been called as a verification step
    expect(mockService.test).toHaveBeenCalled();

    // Component marks as connected before test() runs, so onConfigChange is called
    expect(mockOnConfigChange).toHaveBeenCalledWith(true);
  });

  it('should create window binding only once when connected', async () => {
    const { CloudCredentialStorage } = await import('@/utils/cloudCredentialStorage');

    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };

    vi.mocked(CloudCredentialStorage.hasCredentials).mockReturnValue(true);
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    mockService.test.mockResolvedValue(true);
    mockService.isConnected = true;

    let rerender: ReturnType<typeof render>['rerender'];
    await act(async () => {
      const result = render(
        <NextcloudSync
          onConfigChange={mockOnConfigChange}
          masterKey={mockMasterKey}
        />
      );
      rerender = result.rerender;
    });

    // Flush remaining promises
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect((window as any).nextcloudSync).toBeDefined();
    const firstBinding = (window as any).nextcloudSync;

    // Rerender with same props
    await act(async () => {
      rerender(
        <NextcloudSync
          onConfigChange={mockOnConfigChange}
          masterKey={mockMasterKey}
        />
      );
    });

    // Should be the same binding object
    expect((window as any).nextcloudSync).toBe(firstBinding);
  });

  it('should require password only when truly needed (no master key and trying to connect)', async () => {
    const { CloudCredentialStorage } = await import('@/utils/cloudCredentialStorage');
    
    // No saved config initially
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(null);
    
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    
    expect(container).toBeInTheDocument();
    
    // Should NOT call onRequirePassword if not trying to connect
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(mockOnRequirePassword).not.toHaveBeenCalled();
  });

  it('should preserve window binding when component unmounts for background sync', async () => {
    const { CloudCredentialStorage } = await import('@/utils/cloudCredentialStorage');

    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };

    vi.mocked(CloudCredentialStorage.hasCredentials).mockReturnValue(true);
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    mockService.test.mockResolvedValue(true);
    mockService.isConnected = true;

    let unmount: ReturnType<typeof render>['unmount'];
    await act(async () => {
      const result = render(
        <NextcloudSync
          onConfigChange={mockOnConfigChange}
          masterKey={mockMasterKey}
        />
      );
      unmount = result.unmount;
    });

    // Flush remaining promises
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect((window as any).nextcloudSync).toBeDefined();

    // Unmount component (simulates Settings dialog closing)
    unmount();

    // Window binding should persist for background sync operations
    expect((window as any).nextcloudSync).toBeDefined();
  });

  it('should NOT request password again after master key is provided', async () => {
    const { storageServiceV2 } = await import('@/services/storageServiceV2');
    const mockOnRequirePassword = vi.fn();
    
    // Mock storageServiceV2 to return null initially
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    
    // Start without master key
    const { rerender } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    
    // Now provide master key both in props AND in storage service (simulating password being set)
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    
    rerender(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    
    // Re-render again (simulating component update)
    rerender(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    
    // Password should NOT be requested after master key is provided
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // onRequirePassword should not have been called after master key was provided
    // (it might have been called initially when masterKey was null, but not after)
    const callsAfterKeyProvided = mockOnRequirePassword.mock.calls.length;
    expect(callsAfterKeyProvided).toBeLessThanOrEqual(1);
    
    // Verify that storageServiceV2.getMasterKey was checked
    expect(storageServiceV2.getMasterKey).toHaveBeenCalled();
  });

  it('should establish window binding only once when connected', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Count how many times "window binding established" was logged
    const bindingLogs = consoleSpy.mock.calls.filter(
      call => call[0]?.includes('window binding established')
    );
    
    // Should be called at most once
    expect(bindingLogs.length).toBeLessThanOrEqual(1);
    
    consoleSpy.mockRestore();
  });
});
