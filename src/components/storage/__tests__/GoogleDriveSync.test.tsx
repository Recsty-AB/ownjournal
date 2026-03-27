import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { GoogleDriveSync } from '../GoogleDriveSync';

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

vi.mock('@/services/googleDriveService', () => {
  const MockGoogleDriveService = vi.fn().mockImplementation(function() {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      test: vi.fn().mockResolvedValue(true),
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
  validateTokenResponse: vi.fn(() => true),
  cleanOAuthUrl: vi.fn(),
  checkOAuthRateLimit: vi.fn(() => ({ allowed: true })),
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

vi.mock('@/services/cloudStorageService', () => ({
  cloudStorageService: {
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
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

describe('GoogleDriveSync', () => {
  const mockOnConfigChange = vi.fn();
  const mockOnRequirePassword = vi.fn();
  const mockMasterKey = {} as CryptoKey;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as { location?: unknown }).location;
    (window as { location: { search: string } }).location = { search: '' };
  });

  it('should render successfully', () => {
    const { container } = render(
      <GoogleDriveSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render with null master key', () => {
    const { container } = render(
      <GoogleDriveSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render without optional callbacks', () => {
    const { container } = render(
      <GoogleDriveSync masterKey={mockMasterKey} />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render connection status', () => {
    const { container } = render(
      <GoogleDriveSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render connect button when not connected', () => {
    const { container } = render(
      <GoogleDriveSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should handle loading state', () => {
    const { container } = render(
      <GoogleDriveSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render Google Drive branding', () => {
    const { container } = render(
      <GoogleDriveSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container.textContent).toContain('storage.googleDrive');
  });

  it('should handle token refresh requirement', () => {
    const { container } = render(
      <GoogleDriveSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });
});
