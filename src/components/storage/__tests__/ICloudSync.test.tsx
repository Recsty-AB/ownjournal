import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ICloudSync } from '../ICloudSync';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/services/iCloudService', () => ({
  ICloudService: vi.fn().mockImplementation(function() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      test: vi.fn().mockResolvedValue(true),
      isConnected: false,
    };
  }),
  NeedsAppleSignInError: class NeedsAppleSignInError extends Error {},
  CloudKitOriginError: class CloudKitOriginError extends Error {},
  iCloudDidSignIn: vi.fn().mockReturnValue(false),
  isCloudKitOriginRejected: vi.fn().mockReturnValue(false),
  getCloudKitRejectedOrigin: vi.fn().mockReturnValue(null),
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

vi.mock('@/utils/encryptionModeStorage', () => ({
  getEncryptionMode: vi.fn().mockReturnValue('e2e'),
}));

vi.mock('@/hooks/usePlatform', () => ({
  usePlatform: () => ({ isWeb: true, isMobile: false, isDesktop: false }),
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
  },
}));

describe('ICloudSync', () => {
  const mockOnConfigChange = vi.fn();
  const mockOnRequirePassword = vi.fn();
  const mockMasterKey = {} as CryptoKey;

  it('should render successfully', () => {
    const { container } = render(
      <ICloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should show dev setup required message', () => {
    vi.stubEnv('VITE_APPLE_CLOUDKIT_CONTAINER_ID', '');
    vi.stubEnv('VITE_APPLE_CLOUDKIT_API_TOKEN', '');
    try {
      const { container } = render(
        <ICloudSync
          onConfigChange={mockOnConfigChange}
          masterKey={mockMasterKey}
          onRequirePassword={mockOnRequirePassword}
        />
      );
      expect(container.textContent).toContain('providers.icloud.devSetupRequired');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('should mention iCloud in title', () => {
    const { container } = render(
      <ICloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container.textContent).toContain('storage.icloud');
  });

  it('should show dev setup description', () => {
    vi.stubEnv('VITE_APPLE_CLOUDKIT_CONTAINER_ID', '');
    vi.stubEnv('VITE_APPLE_CLOUDKIT_API_TOKEN', '');
    try {
      const { container } = render(
        <ICloudSync
          onConfigChange={mockOnConfigChange}
          masterKey={mockMasterKey}
          onRequirePassword={mockOnRequirePassword}
        />
      );
      expect(container.textContent).toContain('providers.icloud.devSetupRequiredDesc');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('should render with null master key', () => {
    const { container } = render(
      <ICloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render without optional callbacks', () => {
    const { container } = render(
      <ICloudSync masterKey={mockMasterKey} />
    );
    expect(container).toBeInTheDocument();
  });
});
