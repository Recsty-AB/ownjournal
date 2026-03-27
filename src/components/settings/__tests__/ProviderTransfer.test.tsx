import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ProviderTransfer } from '../ProviderTransfer';

vi.mock('@/hooks/useTransfer', () => ({
  useTransfer: () => ({
    isTransferring: false,
    progress: 0,
    currentFile: null,
    lastTransferSuccess: false,
    sourceProvider: null,
    targetProvider: null,
    phase: 'copying',
    cleanupProgress: 0,
    transfer: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    resetTransferSuccess: vi.fn(),
  }),
}));

vi.mock('@/services/connectionStateManager', () => ({
  connectionStateManager: {
    getConnectedProviders: vi.fn(() => []),
    subscribe: vi.fn(() => () => {}),
    getProvider: vi.fn(() => null),
    unregisterProvider: vi.fn(),
    setPreferredPrimaryProvider: vi.fn(),
  },
}));

vi.mock('@/utils/encryptionModeStorage', () => ({
  isE2EEnabled: vi.fn(() => false),
}));

vi.mock('@/utils/cloudCredentialStorage', () => ({
  CloudCredentialStorage: { clearCredentials: vi.fn() },
}));

vi.mock('@/utils/simpleModeCredentialStorage', () => ({
  SimpleModeCredentialStorage: {
    clearGoogleDriveCredentials: vi.fn(),
    clearDropboxCredentials: vi.fn(),
    clearICloudCredentials: vi.fn(),
  },
}));

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getMasterKey: vi.fn(() => null),
  },
}));

import { connectionStateManager } from '@/services/connectionStateManager';

describe('ProviderTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const { container } = render(<ProviderTransfer />);
    expect(container).toBeInTheDocument();
  });

  it('should show message when less than 2 providers', () => {
    const { container } = render(<ProviderTransfer />);
    // Uses i18n keys since useTranslation is not mocked with real translations
    expect(container.textContent).toContain('storage.providerTransfer');
  });

  it('should render transfer UI when 2+ providers connected', () => {
    vi.mocked(connectionStateManager.getConnectedProviders).mockReturnValue([
      { name: 'Google Drive', isConnected: true, upload: vi.fn(), download: vi.fn(), listFiles: vi.fn(), delete: vi.fn(), exists: vi.fn() },
      { name: 'Dropbox', isConnected: true, upload: vi.fn(), download: vi.fn(), listFiles: vi.fn(), delete: vi.fn(), exists: vi.fn() },
    ]);

    const { container } = render(<ProviderTransfer />);
    expect(container.textContent).toContain('storage.transferBetweenProviders');
  });

  it('should render source and target selects', () => {
    vi.mocked(connectionStateManager.getConnectedProviders).mockReturnValue([
      { name: 'Google Drive', isConnected: true, upload: vi.fn(), download: vi.fn(), listFiles: vi.fn(), delete: vi.fn(), exists: vi.fn() },
      { name: 'Dropbox', isConnected: true, upload: vi.fn(), download: vi.fn(), listFiles: vi.fn(), delete: vi.fn(), exists: vi.fn() },
    ]);

    const { container } = render(<ProviderTransfer />);
    expect(container.textContent).toContain('storage.from');
    expect(container.textContent).toContain('storage.to');
  });

  it('should render transfer button', () => {
    vi.mocked(connectionStateManager.getConnectedProviders).mockReturnValue([
      { name: 'Google Drive', isConnected: true, upload: vi.fn(), download: vi.fn(), listFiles: vi.fn(), delete: vi.fn(), exists: vi.fn() },
      { name: 'Dropbox', isConnected: true, upload: vi.fn(), download: vi.fn(), listFiles: vi.fn(), delete: vi.fn(), exists: vi.fn() },
    ]);

    const { container } = render(<ProviderTransfer />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should handle transfer state', () => {
    vi.mocked(connectionStateManager.getConnectedProviders).mockReturnValue([
      { name: 'Google Drive', isConnected: true, upload: vi.fn(), download: vi.fn(), listFiles: vi.fn(), delete: vi.fn(), exists: vi.fn() },
      { name: 'Dropbox', isConnected: true, upload: vi.fn(), download: vi.fn(), listFiles: vi.fn(), delete: vi.fn(), exists: vi.fn() },
    ]);

    const { container } = render(<ProviderTransfer />);
    expect(container).toBeInTheDocument();
  });
});
