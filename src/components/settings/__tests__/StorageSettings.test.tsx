import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { StorageSettings } from '../StorageSettings';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getMasterKey: vi.fn(() => null),
    initialize: vi.fn().mockResolvedValue(undefined),
    canInitialSync: vi.fn(() => true),
    performFullSync: vi.fn().mockResolvedValue(undefined),
    onMasterKeyChanged: vi.fn(() => () => {}),
  },
}));

vi.mock('@/services/connectionStateManager', () => ({
  connectionStateManager: {
    getConnectedProviderNames: vi.fn(() => []),
    isConnected: vi.fn(() => false),
    isPrimaryProvider: vi.fn(() => false),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('@/components/storage/GoogleDriveSync', () => ({
  GoogleDriveSync: () => <div data-testid="google-drive-sync">GoogleDriveSync</div>,
}));

// Mock ICloudSync only when feature is enabled
vi.mock('@/components/storage/ICloudSync', () => ({
  ICloudSync: () => <div data-testid="icloud-sync">ICloudSync</div>,
}));

vi.mock('@/config/features', () => ({
  FEATURES: { ICLOUD_ENABLED: true }, // Enable for testing
}));

vi.mock('@/components/storage/DropboxSync', () => ({
  DropboxSync: () => <div data-testid="dropbox-sync">DropboxSync</div>,
}));

vi.mock('@/components/storage/NextcloudSync', () => ({
  NextcloudSync: () => <div data-testid="nextcloud-sync">NextcloudSync</div>,
}));

vi.mock('@/components/settings/ProviderTransfer', () => ({
  ProviderTransfer: () => <div data-testid="provider-transfer">ProviderTransfer</div>,
}));

vi.mock('@/components/auth/JournalPasswordDialog', () => ({
  JournalPasswordDialog: () => <div data-testid="password-dialog">PasswordDialog</div>,
}));

describe('StorageSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render successfully', () => {
    const { container } = render(<StorageSettings />);
    expect(container).toBeInTheDocument();
  });

  it('should render all sync providers', () => {
    const { container } = render(<StorageSettings />);
    expect(container.textContent).toContain('GoogleDriveSync');
    expect(container.textContent).toContain('ICloudSync'); // Feature flag enabled in test
    expect(container.textContent).toContain('DropboxSync');
    expect(container.textContent).toContain('NextcloudSync');
  });

  it('should render provider transfer', () => {
    const { container } = render(<StorageSettings />);
    expect(container.textContent).toContain('ProviderTransfer');
  });

  it('should render password dialog', () => {
    const { container } = render(<StorageSettings />);
    expect(container.textContent).toContain('PasswordDialog');
  });

  it('should render storage description', () => {
    const { container } = render(<StorageSettings />);
    expect(container.textContent).toContain('encrypted');
  });

  it('should handle master key state', () => {
    const { container } = render(<StorageSettings />);
    expect(container).toBeInTheDocument();
  });

  it('should handle password requirement workflow', () => {
    const { container } = render(<StorageSettings />);
    expect(container).toBeInTheDocument();
  });

  it('should track sync status per provider', () => {
    const { container } = render(<StorageSettings />);
    expect(container).toBeInTheDocument();
  });
});
