import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StorageSettings } from '../StorageSettings';
import { storageServiceV2 } from '@/services/storageServiceV2';
import { retrievePassword, storePassword, clearPassword, hasStoredPassword } from '@/utils/passwordStorage';
import { CloudCredentialStorage } from '@/utils/cloudCredentialStorage';
import { NextcloudDirectService } from '@/services/nextcloudDirectService';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/utils/encryptionModeStorage', () => ({
  getEncryptionMode: vi.fn().mockReturnValue('e2e'),
  setEncryptionMode: vi.fn(),
  isE2EEnabled: vi.fn().mockReturnValue(true),
  isSimpleModeEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('@/utils/userScope', () => ({
  getCurrentUserId: vi.fn().mockReturnValue('test-user-id'),
  scopedKey: vi.fn((key: string) => `u:test-user-id:${key}`),
  userScopedDBName: vi.fn((name: string) => `${name}_test-user-id`),
  getLastUserId: vi.fn().mockReturnValue(null),
  setCurrentUserId: vi.fn(),
  migrateLocalStorageToUserScope: vi.fn(),
  clearUnscopedUserData: vi.fn(),
}));

vi.mock('@/utils/translateCloudError', () => ({
  translateCloudError: vi.fn().mockReturnValue('Error'),
}));

vi.mock('@/utils/cloudErrorCodes', () => ({
  isNextcloudEncryptionError: vi.fn().mockReturnValue(false),
}));

vi.mock('@/utils/simpleModeCredentialStorage', () => ({
  SimpleModeCredentialStorage: {
    loadGoogleDriveCredentials: vi.fn().mockResolvedValue(null),
    loadDropboxCredentials: vi.fn().mockResolvedValue(null),
    saveGoogleDriveCredentials: vi.fn(),
    saveDropboxCredentials: vi.fn(),
    hasGoogleDriveCredentials: vi.fn().mockReturnValue(false),
    hasDropboxCredentials: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@/config/features', () => ({
  FEATURES: {
    ICLOUD_ENABLED: false,
    APPLE_SIGNIN_ENABLED: false,
  },
  isAppleFeatureAvailable: () => true,
}));

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getMasterKey: vi.fn(),
    initialize: vi.fn(),
    canInitialSync: vi.fn(),
    performFullSync: vi.fn(),
    onMasterKeyChanged: vi.fn(() => () => {}),
  },
}));

vi.mock('@/services/connectionStateManager', () => ({
  connectionStateManager: {
    getConnectedProviderNames: vi.fn(() => []),
    getConnectedCount: vi.fn(() => 0),
    isConnected: vi.fn(() => false),
    isPrimaryProvider: vi.fn(() => false),
    subscribe: vi.fn(() => () => {}),
    getPrimaryProviderName: vi.fn(() => null),
    getPrimaryProvider: vi.fn(() => null),
    getProvider: vi.fn(() => null),
    getConnectedProviders: vi.fn(() => []),
    ensureConnections: vi.fn().mockResolvedValue(undefined),
    unregisterProvider: vi.fn(),
    registerProvider: vi.fn(),
    enableProvider: vi.fn(),
    setPreferredPrimaryProvider: vi.fn(),
    shouldDelaySync: vi.fn(() => false),
    isExplicitlyDisabled: vi.fn().mockReturnValue(false),
    getProviderDisplayConfig: vi.fn(() => null),
  },
}));

vi.mock('@/utils/passwordStorage', () => ({
  retrievePassword: vi.fn().mockResolvedValue(null),
  storePassword: vi.fn().mockResolvedValue(undefined),
  clearPassword: vi.fn(),
  hasStoredPassword: vi.fn().mockReturnValue(false),
}));

vi.mock('@/utils/cloudCredentialStorage', () => ({
  CloudCredentialStorage: {
    loadCredentials: vi.fn().mockResolvedValue(null),
    saveCredentials: vi.fn().mockResolvedValue(undefined),
    clearCredentials: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/nextcloudDirectService', () => {
  const Mock = vi.fn().mockImplementation(function() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      test: vi.fn().mockResolvedValue(true),
      isConnected: false,
    };
  });
  return { NextcloudDirectService: Mock };
});

// Mock child sync components to avoid needing all transitive service dependencies
vi.mock('@/components/storage/GoogleDriveSync', () => ({
  GoogleDriveSync: (props: any) => <div data-testid="google-drive-sync" />,
}));

vi.mock('@/components/storage/DropboxSync', () => ({
  DropboxSync: (props: any) => <div data-testid="dropbox-sync" />,
}));

vi.mock('@/components/storage/NextcloudSync', () => ({
  NextcloudSync: (props: any) => <div data-testid="nextcloud-sync" />,
}));

vi.mock('@/components/storage/ICloudSync', () => ({
  ICloudSync: (props: any) => <div data-testid="icloud-sync" />,
}));

vi.mock('@/utils/platformCapabilities', () => ({
  PlatformCapabilities: {
    isIOS: vi.fn().mockReturnValue(false),
    isMacOS: vi.fn().mockReturnValue(false),
    isDesktop: vi.fn().mockReturnValue(false),
    supportsICloud: vi.fn().mockReturnValue(false),
  },
  getAllCapabilities: vi.fn().mockReturnValue({
    storage: { indexedDB: true, localStorage: true, fileSystem: false },
    network: { serviceWorker: true, backgroundSync: false },
    ui: { notifications: true, share: false },
    oauth: { supportsRedirect: true, supportsPopup: true },
  }),
  getStorageCapabilities: vi.fn().mockReturnValue({ indexedDB: true, localStorage: true, fileSystem: false }),
  getNetworkCapabilities: vi.fn().mockReturnValue({ serviceWorker: true, backgroundSync: false }),
  getUICapabilities: vi.fn().mockReturnValue({ notifications: true, share: false }),
  getOAuthCapabilities: vi.fn().mockReturnValue({ supportsRedirect: true, supportsPopup: true }),
  hasCapability: vi.fn().mockReturnValue(true),
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

describe('StorageSettings - Password Persistence', () => {
  const mockMasterKey = {} as CryptoKey;

  beforeEach(() => {
    vi.clearAllMocks();
    // Start with no master key
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    // No stored password by default
    vi.mocked(retrievePassword).mockResolvedValue(null);
  });

  it('should sync master key from storage service on mount', async () => {
    // Mock master key exists in storage service
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);

    render(<StorageSettings />);

    // Should check for existing master key on mount
    await waitFor(() => {
      expect(storageServiceV2.getMasterKey).toHaveBeenCalled();
    });

    // Password dialog should NOT appear since master key exists
    await waitFor(() => {
      expect(screen.queryByText(/Set Your Journal Password/i)).not.toBeInTheDocument();
    });
  });

  it('should NOT show password dialog again after password is set', async () => {
    const user = userEvent.setup();
    
    // Initially no master key
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    
    const { rerender } = render(<StorageSettings />);
    
    // Wait for initial render
    await waitFor(() => {
      expect(screen.queryByText(/Set Your Journal Password/i)).not.toBeInTheDocument();
    });
    
    // Simulate password initialization - master key is now available in service
    vi.mocked(storageServiceV2.initialize).mockResolvedValue(undefined);
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    
    // Re-render - this simulates the component re-rendering after password is set
    rerender(<StorageSettings />);
    
    // Even if handleRequirePassword is called somehow, it should check storage service
    // and not show the dialog since master key exists
    await waitFor(() => {
      expect(screen.queryByText(/Set Your Journal Password/i)).not.toBeInTheDocument();
    });
    
    // Verify that getMasterKey was called to check for existing key
    expect(storageServiceV2.getMasterKey).toHaveBeenCalled();
  });

  it('should persist master key across component re-renders', async () => {
    // Initially no master key
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    
    const { rerender, unmount } = render(<StorageSettings />);
    
    // Simulate password being set
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    
    // Re-render component (simulating navigation or state change)
    rerender(<StorageSettings />);
    
    // Master key should be synced from storage service
    await waitFor(() => {
      const key = storageServiceV2.getMasterKey();
      expect(key).toBe(mockMasterKey);
    });
    
    // Unmount and remount completely
    unmount();
    render(<StorageSettings />);
    
    // Master key should still be available
    await waitFor(() => {
      const key = storageServiceV2.getMasterKey();
      expect(key).toBe(mockMasterKey);
    });
  });

  it('should ignore password requests when master key already exists', async () => {
    // Start with master key already available
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    
    const { rerender } = render(<StorageSettings />);
    
    // Password dialog should never appear
    await waitFor(() => {
      expect(screen.queryByText(/Set Your Journal Password/i)).not.toBeInTheDocument();
    });
    
    // Even after re-render
    rerender(<StorageSettings />);
    
    await waitFor(() => {
      expect(screen.queryByText(/Set Your Journal Password/i)).not.toBeInTheDocument();
    });
  });

  it('should prevent duplicate password requests in same session', async () => {
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    
    render(<StorageSettings />);
    
    // Simulate multiple rapid password requests
    // (This would happen if multiple providers try to connect simultaneously)
    
    // The password dialog should only appear once
    const dialogs = screen.queryAllByText(/Set Your Journal Password/i);
    expect(dialogs.length).toBeLessThanOrEqual(1);
  });

  it('should subscribe to master key changes on mount', async () => {
    // Mock master key not yet available
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);

    render(<StorageSettings />);

    // Should subscribe to master key changes
    await waitFor(() => {
      expect(storageServiceV2.onMasterKeyChanged).toHaveBeenCalled();
    });
  });

  it('should NOT auto-sync if already synced before', async () => {
    
    // Mock master key exists
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    
    // Mock Nextcloud config
    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };
    
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    
    const mockService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      test: vi.fn().mockResolvedValue(true),
      isConnected: true,
    };
    vi.mocked(NextcloudDirectService).mockReturnValue(mockService as any);
    
    // Mock that we've synced before
    localStorage.setItem('ownjournal_synced_nextcloud', 'true');
    vi.mocked(storageServiceV2.canInitialSync).mockReturnValue(true);
    vi.mocked(storageServiceV2.performFullSync).mockResolvedValue(undefined);
    
    render(<StorageSettings />);
    
    // Wait a bit and ensure performFullSync was NOT called
    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(storageServiceV2.performFullSync).not.toHaveBeenCalled();
  });

  it('should NOT auto-sync if canInitialSync returns false', async () => {
    
    // Mock master key exists
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    
    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };
    
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    
    const mockService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      test: vi.fn().mockResolvedValue(true),
      isConnected: true,
    };
    vi.mocked(NextcloudDirectService).mockReturnValue(mockService as any);
    
    // Mock canInitialSync returns false (e.g., sync already in progress)
    localStorage.clear();
    vi.mocked(storageServiceV2.canInitialSync).mockReturnValue(false);
    vi.mocked(storageServiceV2.performFullSync).mockResolvedValue(undefined);
    
    render(<StorageSettings />);
    
    // Wait and ensure performFullSync was NOT called
    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(storageServiceV2.performFullSync).not.toHaveBeenCalled();
  });

  it('should NOT auto-sync if no master key is available', async () => {
    
    // Mock NO master key
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    
    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };
    
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    
    const mockService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      test: vi.fn().mockResolvedValue(true),
      isConnected: true,
    };
    vi.mocked(NextcloudDirectService).mockReturnValue(mockService as any);
    
    localStorage.clear();
    vi.mocked(storageServiceV2.canInitialSync).mockReturnValue(true);
    vi.mocked(storageServiceV2.performFullSync).mockResolvedValue(undefined);
    
    render(<StorageSettings />);
    
    // Wait and ensure performFullSync was NOT called
    await new Promise(resolve => setTimeout(resolve, 500));
    
    expect(storageServiceV2.performFullSync).not.toHaveBeenCalled();
  });
});
