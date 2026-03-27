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
  GoogleDriveSync: ({ onRequirePassword, masterKey }: {
    onRequirePassword?: (retryAction?: () => void) => void;
    masterKey: CryptoKey | null
  }) => {
    const handleConnect = () => {
      if (!masterKey && onRequirePassword) {
        onRequirePassword();
      }
    };

    return (
      <div data-testid="google-drive-sync">
        <button onClick={handleConnect}>Connect Google Drive</button>
        <span data-testid="master-key-status">{masterKey ? 'has-key' : 'no-key'}</span>
      </div>
    );
  },
}));

vi.mock('@/components/storage/ICloudSync', () => ({
  ICloudSync: () => <div data-testid="icloud-sync">iCloud</div>,
}));

vi.mock('@/components/storage/DropboxSync', () => ({
  DropboxSync: () => <div data-testid="dropbox-sync">Dropbox</div>,
}));

vi.mock('@/components/storage/NextcloudSync', () => ({
  NextcloudSync: () => <div data-testid="nextcloud-sync">Nextcloud</div>,
}));

vi.mock('@/components/settings/ProviderTransfer', () => ({
  ProviderTransfer: () => <div data-testid="provider-transfer">Transfer</div>,
}));

vi.mock('@/components/auth/JournalPasswordDialog', () => ({
  JournalPasswordDialog: ({ open, onPasswordSet }: {
    open: boolean;
    onPasswordSet: (password: string) => void
  }) => (
    <div data-testid="password-dialog" data-open={open}>
      <input data-testid="password-input" />
      <button
        data-testid="submit-password"
        onClick={() => { Promise.resolve(onPasswordSet('test-password-123456')).catch(() => {}); }}
      >
        Submit
      </button>
    </div>
  ),
}));

describe('StorageSettings - Auto-Retry After Password Set', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should open password dialog when connecting without master key', async () => {
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);

    render(<StorageSettings />);

    expect(screen.getByTestId('master-key-status')).toHaveTextContent('no-key');

    fireEvent.click(screen.getByText('Connect Google Drive'));

    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });
  });

  it('should not trigger password dialog if connection was not pending', async () => {
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);

    render(<StorageSettings />);

    // Without clicking connect, the dialog should remain closed
    expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'false');
  });

  it('should initialize storage service when password is submitted', async () => {
    const mockMasterKey = {} as CryptoKey;

    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    vi.mocked(storageServiceV2.initialize).mockResolvedValue();

    render(<StorageSettings />);

    fireEvent.click(screen.getByText('Connect Google Drive'));

    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    // After initialization, return the key
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);

    fireEvent.click(screen.getByTestId('submit-password'));

    await waitFor(() => {
      expect(storageServiceV2.initialize).toHaveBeenCalledWith('test-password-123456');
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
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
  });
});
