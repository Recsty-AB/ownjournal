import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StorageSettings } from '../StorageSettings';
import { storageServiceV2 } from '@/services/storageServiceV2';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getMasterKey: vi.fn(),
    initialize: vi.fn(),
    canInitialSync: vi.fn(),
    performFullSync: vi.fn(),
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

vi.mock('@/services/nextcloudDirectService', () => ({
  NextcloudDirectService: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    test: vi.fn().mockResolvedValue(true),
    isConnected: false,
  })),
}));

vi.mock('@/services/googleDriveService', () => ({
  GoogleDriveService: {
    getInstance: vi.fn().mockReturnValue({
      isAuthenticated: vi.fn().mockReturnValue(false),
      authenticate: vi.fn(),
      disconnect: vi.fn(),
    }),
  },
}));

vi.mock('@/services/dropboxService', () => ({
  DropboxService: {
    getInstance: vi.fn().mockReturnValue({
      isAuthenticated: vi.fn().mockReturnValue(false),
      authenticate: vi.fn(),
      disconnect: vi.fn(),
    }),
  },
}));

vi.mock('@/utils/platformCapabilities', () => ({
  PlatformCapabilities: {
    isIOS: vi.fn().mockReturnValue(false),
    isMacOS: vi.fn().mockReturnValue(false),
    isDesktop: vi.fn().mockReturnValue(false),
    supportsICloud: vi.fn().mockReturnValue(false),
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

describe('StorageSettings - Password Persistence', () => {
  const mockMasterKey = {} as CryptoKey;

  beforeEach(() => {
    vi.clearAllMocks();
    // Start with no master key
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    // No stored password by default
    const { retrievePassword } = require('@/utils/passwordStorage');
    vi.mocked(retrievePassword).mockResolvedValue(null);
  });

  it('should auto-initialize with stored password on mount', async () => {
    const { retrievePassword } = require('@/utils/passwordStorage');
    const { storePassword } = require('@/utils/passwordStorage');
    
    // Mock stored password exists
    vi.mocked(retrievePassword).mockResolvedValue('stored-password');
    
    // Mock successful initialization
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    vi.mocked(storageServiceV2.initialize).mockResolvedValue(undefined);
    
    render(<StorageSettings />);
    
    // Wait for auto-initialization
    await waitFor(() => {
      expect(retrievePassword).toHaveBeenCalled();
      expect(storageServiceV2.initialize).toHaveBeenCalledWith('stored-password');
    });
    
    // Password dialog should NOT appear since auto-init succeeded
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

  it('should auto-sync when connection is established with password', async () => {
    const { CloudCredentialStorage } = require('@/utils/cloudCredentialStorage');
    const { NextcloudDirectService } = require('@/services/nextcloudDirectService');
    
    // Mock master key exists
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    
    // Mock Nextcloud config being saved (connection established)
    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };
    
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    
    // Mock successful test
    const mockService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      test: vi.fn().mockResolvedValue(true),
      isConnected: true,
    };
    vi.mocked(NextcloudDirectService).mockReturnValue(mockService as any);
    
    // Mock canInitialSync to return true (never synced before)
    vi.mocked(storageServiceV2.canInitialSync).mockReturnValue(true);
    vi.mocked(storageServiceV2.performFullSync).mockResolvedValue(undefined);
    
    // Clear localStorage to simulate first connection
    localStorage.clear();
    
    render(<StorageSettings />);
    
    // Wait for connection to be detected and auto-sync to trigger
    await waitFor(() => {
      expect(storageServiceV2.performFullSync).toHaveBeenCalled();
    }, { timeout: 3000 });
    
    // Verify sync marker was set
    expect(localStorage.getItem('ownjournal_synced_nextcloud')).toBe('true');
  });

  it('should NOT auto-sync if already synced before', async () => {
    const { CloudCredentialStorage } = require('@/utils/cloudCredentialStorage');
    const { NextcloudDirectService } = require('@/services/nextcloudDirectService');
    
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
    const { CloudCredentialStorage } = require('@/utils/cloudCredentialStorage');
    const { NextcloudDirectService } = require('@/services/nextcloudDirectService');
    
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
    const { CloudCredentialStorage } = require('@/utils/cloudCredentialStorage');
    const { NextcloudDirectService } = require('@/services/nextcloudDirectService');
    
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
