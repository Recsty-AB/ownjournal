import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { StorageSettings } from '../StorageSettings';
import { storageServiceV2 } from '@/services/storageServiceV2';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getMasterKey: vi.fn(() => null),
    initialize: vi.fn(),
    canInitialSync: vi.fn(() => false),
    performFullSync: vi.fn(),
    onMasterKeyChanged: vi.fn(() => () => {}),
    isSyncInProgress: vi.fn(() => false),
    getAllEntries: vi.fn().mockResolvedValue([]),
    clearMasterKey: vi.fn(),
    deleteAllEntries: vi.fn().mockResolvedValue(undefined),
    onCloudProviderConnected: vi.fn().mockResolvedValue(undefined),
    isPendingOAuth: false,
    resetEncryptionState: vi.fn(),
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
    ensureConnections: vi.fn().mockResolvedValue(undefined),
    unregisterProvider: vi.fn(),
    setPreferredPrimaryProvider: vi.fn(),
    shouldDelaySync: vi.fn(() => false),
    getConnectedProviders: vi.fn(() => []),
  },
}));

vi.mock('@/utils/encryptionModeStorage', () => ({
  getEncryptionMode: vi.fn(() => 'e2e'),
  setEncryptionMode: vi.fn(),
  isE2EEnabled: vi.fn(() => true),
}));

vi.mock('@/utils/passwordStorage', () => ({
  retrievePassword: vi.fn().mockResolvedValue(null),
  storePassword: vi.fn().mockResolvedValue(undefined),
  clearPassword: vi.fn().mockResolvedValue(undefined),
  hasStoredPassword: vi.fn(() => false),
}));

vi.mock('@/utils/cloudCredentialStorage', () => ({
  CloudCredentialStorage: { clearAll: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/utils/simpleModeCredentialStorage', () => ({
  SimpleModeCredentialStorage: { clearAll: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/utils/userScope', () => ({
  getCurrentUserId: vi.fn(() => 'test-user'),
  scopedKey: vi.fn((key: string) => `u:test-user:${key}`),
}));

vi.mock('@/utils/translateCloudError', () => ({
  translateCloudError: vi.fn((error: Error) => error.message),
}));

vi.mock('@/utils/cloudErrorCodes', () => ({
  isNextcloudEncryptionError: vi.fn(() => false),
}));

vi.mock('@/services/encryptionStateManager', () => ({
  encryptionStateManager: {
    requestPasswordIfNeeded: vi.fn().mockImplementation(async () => {
      window.dispatchEvent(new CustomEvent('require-password-reentry'));
    }),
    handleInitializationError: vi.fn(() => ({ passwordCleared: false, shouldPromptPassword: false })),
    getState: vi.fn(() => ({ mode: 'e2e', hasKey: false })),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('@/components/settings/CloudEncryptedDataDialog', () => ({
  CloudEncryptedDataDialog: () => <div data-testid="cloud-encrypted-dialog" />,
}));

vi.mock('@/components/settings/IncompatibleKeyDialog', () => ({
  IncompatibleKeyDialog: () => <div data-testid="incompatible-key-dialog" />,
}));

vi.mock('@/components/storage/GoogleDriveSync', () => ({
  GoogleDriveSync: ({ onRequirePassword, masterKey }: { onRequirePassword?: () => void; masterKey: CryptoKey | null }) => (
    <div data-testid="google-drive-sync">
      <button onClick={() => { if (!masterKey && onRequirePassword) onRequirePassword(); }}>Connect Google Drive</button>
      <span data-testid="master-key-status">{masterKey ? 'has-key' : 'no-key'}</span>
    </div>
  ),
}));

vi.mock('@/components/storage/ICloudSync', () => ({
  ICloudSync: () => <div data-testid="icloud-sync">iCloud</div>,
}));

vi.mock('@/components/storage/DropboxSync', () => ({
  DropboxSync: ({ onRequirePassword, masterKey }: { onRequirePassword?: () => void; masterKey: CryptoKey | null }) => (
    <div data-testid="dropbox-sync">
      <button onClick={() => { if (!masterKey && onRequirePassword) onRequirePassword(); }}>Connect Dropbox</button>
      <span data-testid="master-key-status-dropbox">{masterKey ? 'has-key' : 'no-key'}</span>
    </div>
  ),
}));

vi.mock('@/components/storage/NextcloudSync', () => ({
  NextcloudSync: () => <div data-testid="nextcloud-sync">Nextcloud</div>,
}));

vi.mock('@/components/settings/ProviderTransfer', () => ({
  ProviderTransfer: () => <div data-testid="provider-transfer">Transfer</div>,
}));

vi.mock('@/components/auth/JournalPasswordDialog', () => ({
  JournalPasswordDialog: ({ open, onPasswordSet }: { open: boolean; onPasswordSet: (password: string) => void }) => (
    <div data-testid="password-dialog" data-open={open}>
      <input
        data-testid="password-input"
        onChange={(e) => e.target.value}
      />
      <button
        data-testid="submit-password"
        onClick={() => { Promise.resolve(onPasswordSet('test-password-123456')).catch(() => {}); }}
      >
        Submit
      </button>
    </div>
  ),
}));

describe('StorageSettings - Encryption Password Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should show password dialog when connecting without master key', async () => {
    render(<StorageSettings />);

    // Initially no master key
    expect(screen.getByTestId('master-key-status')).toHaveTextContent('no-key');

    // Try to connect to Google Drive
    fireEvent.click(screen.getByText('Connect Google Drive'));

    // Password dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });
  });

  it('should initialize storage service when password is set', async () => {
    const mockMasterKey = {} as CryptoKey;

    // Start with no key
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    vi.mocked(storageServiceV2.initialize).mockImplementation(async () => {
      // After initialization, key becomes available
      vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    });

    render(<StorageSettings />);

    // Open password dialog
    fireEvent.click(screen.getByText('Connect Google Drive'));

    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    // Submit password
    fireEvent.click(screen.getByTestId('submit-password'));

    // Should initialize storage service
    await waitFor(() => {
      expect(storageServiceV2.initialize).toHaveBeenCalledWith('test-password-123456');
    });
  });

  it('should propagate master key to providers after password set', async () => {
    const mockMasterKey = {} as CryptoKey;

    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    vi.mocked(storageServiceV2.initialize).mockImplementation(async () => {
      vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    });

    render(<StorageSettings />);

    expect(screen.getByTestId('master-key-status')).toHaveTextContent('no-key');

    fireEvent.click(screen.getByText('Connect Google Drive'));

    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    fireEvent.click(screen.getByTestId('submit-password'));

    await waitFor(() => {
      expect(screen.getByTestId('master-key-status')).toHaveTextContent('has-key');
    }, { timeout: 5000 });
  });

  it('should close password dialog after successful initialization', async () => {
    const mockMasterKey = {} as CryptoKey;

    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    vi.mocked(storageServiceV2.initialize).mockImplementation(async () => {
      vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    });

    render(<StorageSettings />);

    fireEvent.click(screen.getByText('Connect Google Drive'));

    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    fireEvent.click(screen.getByTestId('submit-password'));

    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'false');
    }, { timeout: 5000 });
  });

  it('should not show password dialog again after key is set', async () => {
    const mockMasterKey = {} as CryptoKey;

    // Start with key already available
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);

    render(<StorageSettings />);

    // Should have key
    expect(screen.getByTestId('master-key-status')).toHaveTextContent('has-key');

    // Try to connect - should not show password dialog
    fireEvent.click(screen.getByText('Connect Google Drive'));

    // Dialog should stay closed
    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'false');
    });
  });

  it('should call initialize with password when submitted', async () => {
    const mockMasterKey = {} as CryptoKey;

    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    vi.mocked(storageServiceV2.initialize).mockImplementation(async () => {
      vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    });

    render(<StorageSettings />);

    fireEvent.click(screen.getByText('Connect Google Drive'));

    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    // Submit password
    fireEvent.click(screen.getByTestId('submit-password'));

    // Should call initialize with the password
    await waitFor(() => {
      expect(storageServiceV2.initialize).toHaveBeenCalledWith('test-password-123456');
    });

    // Master key should be available after initialization
    await waitFor(() => {
      expect(storageServiceV2.getMasterKey).toHaveBeenCalled();
    });
  });

  it('should handle initialization errors gracefully', async () => {
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    vi.mocked(storageServiceV2.initialize).mockImplementation(async () => { throw new Error('Initialization failed'); });

    render(<StorageSettings />);

    fireEvent.click(screen.getByText('Connect Google Drive'));

    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    fireEvent.click(screen.getByTestId('submit-password'));

    await waitFor(() => {
      expect(storageServiceV2.initialize).toHaveBeenCalled();
    });

    // Dialog should remain open on error
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('should update master key state after initialization', async () => {
    const mockMasterKey = {} as CryptoKey;

    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    vi.mocked(storageServiceV2.initialize).mockImplementation(async () => {
      vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    });

    render(<StorageSettings />);

    fireEvent.click(screen.getByText('Connect Google Drive'));

    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    fireEvent.click(screen.getByTestId('submit-password'));

    await waitFor(() => {
      expect(screen.getByTestId('master-key-status')).toHaveTextContent('has-key');
    }, { timeout: 5000 });
  });
});
