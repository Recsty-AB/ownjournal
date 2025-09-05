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
  },
}));

vi.mock('@/components/storage/GoogleDriveSync', () => ({
  GoogleDriveSync: ({ onRequirePassword, masterKey }: { onRequirePassword?: () => void; masterKey: CryptoKey | null }) => (
    <div data-testid="google-drive-sync">
      <button onClick={onRequirePassword}>Connect Google Drive</button>
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
      <button onClick={onRequirePassword}>Connect Dropbox</button>
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
        onClick={() => onPasswordSet('test-password-123456')}
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
    
    vi.mocked(storageServiceV2.initialize).mockResolvedValue();
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);

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
    
    // Initially no key
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValueOnce(null);
    
    render(<StorageSettings />);
    
    expect(screen.getByTestId('master-key-status')).toHaveTextContent('no-key');

    // Setup mock to return key after initialization
    vi.mocked(storageServiceV2.initialize).mockResolvedValue();
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);

    // Open password dialog
    fireEvent.click(screen.getByText('Connect Google Drive'));
    
    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    // Submit password
    fireEvent.click(screen.getByTestId('submit-password'));

    // Wait for state to propagate (includes the setTimeout(100) delay)
    await waitFor(() => {
      expect(screen.getByTestId('master-key-status')).toHaveTextContent('has-key');
    }, { timeout: 500 });
  });

  it('should close password dialog after successful initialization', async () => {
    const mockMasterKey = {} as CryptoKey;
    
    vi.mocked(storageServiceV2.initialize).mockResolvedValue();
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);

    render(<StorageSettings />);

    // Open password dialog
    fireEvent.click(screen.getByText('Connect Google Drive'));
    
    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    // Submit password
    fireEvent.click(screen.getByTestId('submit-password'));

    // Dialog should close after initialization (with setTimeout delay)
    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'false');
    }, { timeout: 500 });
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

  it('should prevent concurrent password initialization', async () => {
    const mockMasterKey = {} as CryptoKey;
    
    let resolveInit: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });
    
    vi.mocked(storageServiceV2.initialize).mockReturnValue(initPromise);
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);

    render(<StorageSettings />);

    // Open password dialog
    fireEvent.click(screen.getByText('Connect Google Drive'));
    
    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    // Click submit multiple times
    fireEvent.click(screen.getByTestId('submit-password'));
    fireEvent.click(screen.getByTestId('submit-password'));
    fireEvent.click(screen.getByTestId('submit-password'));

    // Should only call initialize once
    expect(storageServiceV2.initialize).toHaveBeenCalledTimes(1);

    // Resolve initialization
    resolveInit!();

    await waitFor(() => {
      expect(storageServiceV2.getMasterKey).toHaveBeenCalled();
    });
  });

  it('should handle initialization errors gracefully', async () => {
    vi.mocked(storageServiceV2.initialize).mockRejectedValue(new Error('Initialization failed'));

    render(<StorageSettings />);

    // Open password dialog
    fireEvent.click(screen.getByText('Connect Google Drive'));
    
    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    // Submit password
    fireEvent.click(screen.getByTestId('submit-password'));

    // Should call initialize
    await waitFor(() => {
      expect(storageServiceV2.initialize).toHaveBeenCalled();
    });

    // Dialog should remain open on error
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
  });

  it('should update master key state synchronously before closing dialog', async () => {
    const mockMasterKey = {} as CryptoKey;
    const keyUpdateSequence: string[] = [];
    
    vi.mocked(storageServiceV2.initialize).mockImplementation(async () => {
      keyUpdateSequence.push('initialize-called');
    });
    
    vi.mocked(storageServiceV2.getMasterKey).mockImplementation(() => {
      keyUpdateSequence.push('getMasterKey-called');
      return mockMasterKey;
    });

    render(<StorageSettings />);

    // Open password dialog
    fireEvent.click(screen.getByText('Connect Google Drive'));
    
    await waitFor(() => {
      expect(screen.getByTestId('password-dialog')).toHaveAttribute('data-open', 'true');
    });

    // Submit password
    fireEvent.click(screen.getByTestId('submit-password'));

    await waitFor(() => {
      expect(keyUpdateSequence).toEqual(['initialize-called', 'getMasterKey-called']);
    });

    // Wait for state propagation
    await waitFor(() => {
      expect(screen.getByTestId('master-key-status')).toHaveTextContent('has-key');
    }, { timeout: 500 });
  });
});
