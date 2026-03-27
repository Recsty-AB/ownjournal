import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { GoogleDriveSync } from '../GoogleDriveSync';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/utils/cloudCredentialStorage', () => ({
  CloudCredentialStorage: {
    loadCredentials: vi.fn(() => Promise.resolve(null)),
    saveCredentials: vi.fn(() => Promise.resolve()),
    clearCredentials: vi.fn(),
    hasCredentials: vi.fn().mockReturnValue(false),
    forceRemoveCredentials: vi.fn(),
  },
}));

vi.mock('@/services/googleDriveService', () => {
  const MockGoogleDriveService = vi.fn().mockImplementation(function() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: false,
    };
  });
  return { GoogleDriveService: MockGoogleDriveService };
});

vi.mock('@/utils/oauth', () => ({
  generateCodeVerifier: vi.fn(() => 'test-verifier'),
  generateCodeChallenge: vi.fn(() => Promise.resolve('test-challenge')),
  generateOAuthState: vi.fn((provider: string) => `${provider}_test-state`),
  getProviderFromState: vi.fn((state: string) => state.split('_')[0] || null),
  storePKCEVerifier: vi.fn(),
  retrievePKCEVerifier: vi.fn(() => 'test-verifier'),
  validateTokenResponse: vi.fn((tokens) => tokens),
  cleanOAuthUrl: vi.fn(),
  checkOAuthRateLimit: vi.fn(() => true),
  getOAuthRedirectUri: vi.fn(() => 'http://localhost/oauth-callback'),
  markOAuthCodeProcessed: vi.fn(),
  isOAuthCodeProcessed: vi.fn(() => false),
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

vi.mock('@/utils/passwordStorage', () => ({
  hasStoredPassword: vi.fn().mockReturnValue(false),
  retrievePassword: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/encryptionStateManager', () => ({
  encryptionStateManager: {
    requestPasswordIfNeeded: vi.fn(),
  },
}));

vi.mock('@/services/cloudStorageService', () => ({
  cloudStorageService: {
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-supabase-token' } },
      }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('@/config/supabase', () => ({
  SUPABASE_CONFIG: {
    url: 'https://test.supabase.co',
    key: 'test-key',
    projectId: 'test-project',
  },
}));

vi.mock('@/utils/encryptionModeStorage', () => ({
  getEncryptionMode: vi.fn().mockReturnValue('e2e'),
  isE2EEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock('@/config/oauth', () => ({
  oauthConfig: { googleDrive: { clientId: 'test-client-id', scopes: ['https://www.googleapis.com/auth/drive.file'] } },
  isGoogleDriveConfigured: vi.fn().mockReturnValue(true),
  getGoogleClientId: vi.fn().mockReturnValue('test-client-id'),
  isNativePlatform: vi.fn().mockReturnValue(false),
}));

vi.mock('@/utils/signOutState', () => ({
  isSigningOut: vi.fn().mockReturnValue(false),
}));

describe('GoogleDriveSync - Connection Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost',
        pathname: '/',
        search: '',
        href: 'http://localhost/',
      },
      writable: true,
    });
  });

  it('should pass retry action when requesting password', async () => {
    const onRequirePassword = vi.fn();

    render(
      <GoogleDriveSync
        masterKey={null}
        onRequirePassword={onRequirePassword}
      />
    );

    // Click connect without master key
    const connectButton = screen.getByText('storage.connectGoogleDrive');
    fireEvent.click(connectButton);

    // Should call onRequirePassword when master key is not available
    await waitFor(() => {
      expect(onRequirePassword).toHaveBeenCalled();
    });
  });

  it('should initiate OAuth flow when master key is available', async () => {
    const mockMasterKey = {} as CryptoKey;

    // Set up environment for OAuth
    import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id';

    const { rerender } = render(
      <GoogleDriveSync
        masterKey={null}
        onRequirePassword={vi.fn()}
      />
    );

    // Initially no key - clicking should request password
    const connectButton = screen.getByText('storage.connectGoogleDrive');
    fireEvent.click(connectButton);

    // Now provide master key
    rerender(
      <GoogleDriveSync
        masterKey={mockMasterKey}
        onRequirePassword={vi.fn()}
      />
    );

    // Click connect again with key available
    fireEvent.click(connectButton);

    // Should not request password since key is available
    // OAuth flow would redirect the browser (which we can't test here)
  });

  it('should handle OAuth callback with master key available', async () => {
    const mockMasterKey = {} as CryptoKey;
    const onConfigChange = vi.fn();

    // Mock successful token exchange
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600,
        }),
      })
    ) as unknown as typeof fetch;

    // Simulate OAuth callback
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?code=test-code&state=google-drive_test-state',
      },
      writable: true,
    });

    render(
      <GoogleDriveSync
        masterKey={mockMasterKey}
        onConfigChange={onConfigChange}
      />
    );

    // Should process OAuth callback
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it('should request password when OAuth callback occurs without master key', async () => {
    const onRequirePassword = vi.fn();

    // Simulate OAuth callback
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?code=test-code&state=google-drive_test-state',
      },
      writable: true,
    });

    render(
      <GoogleDriveSync
        masterKey={null}
        onRequirePassword={onRequirePassword}
      />
    );

    // Should request password since master key is not available
    await waitFor(() => {
      expect(onRequirePassword).toHaveBeenCalled();
    }, { timeout: 500 });

    // Verify a retry function was passed
    const passedArg = onRequirePassword.mock.calls[0][0];
    expect(typeof passedArg).toBe('function');
  });

  it('should not process OAuth callback multiple times', async () => {
    const mockMasterKey = {} as CryptoKey;
    const onConfigChange = vi.fn();

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600,
        }),
      })
    ) as unknown as typeof fetch;

    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?code=test-code&state=google-drive_test-state',
      },
      writable: true,
    });

    const { rerender } = render(
      <GoogleDriveSync
        masterKey={mockMasterKey}
        onConfigChange={onConfigChange}
      />
    );

    // Wait for initial OAuth processing
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }, { timeout: 1000 });

    // Rerender should not trigger OAuth again (URL was cleaned)
    rerender(
      <GoogleDriveSync
        masterKey={mockMasterKey}
        onConfigChange={onConfigChange}
      />
    );

    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Should still be called only once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
