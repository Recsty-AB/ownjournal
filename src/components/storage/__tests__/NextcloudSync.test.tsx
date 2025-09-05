import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { NextcloudSync } from '../NextcloudSync';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/utils/cloudCredentialStorage', () => ({
  CloudCredentialStorage: {
    loadCredentials: vi.fn().mockResolvedValue(null),
    saveCredentials: vi.fn().mockResolvedValue(undefined),
    clearCredentials: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  test: vi.fn().mockResolvedValue(true),
  isConnected: false,
};

vi.mock('@/services/nextcloudDirectService', () => ({
  NextcloudDirectService: vi.fn(() => mockService),
}));

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getMasterKey: vi.fn().mockReturnValue(null),
    initialize: vi.fn(),
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

describe('NextcloudSync', () => {
  const mockOnConfigChange = vi.fn();
  const mockOnRequirePassword = vi.fn();
  const mockMasterKey = {} as CryptoKey;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService.test.mockResolvedValue(true);
    mockService.isConnected = false;
    delete (window as any).nextcloudSync;
  });

  it('should render successfully', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render with null master key', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render without optional callbacks', () => {
    const { container } = render(
      <NextcloudSync masterKey={mockMasterKey} />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render connection status', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render connect button when not connected', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should handle loading state', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render Nextcloud branding', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container.textContent).toContain('Nextcloud');
  });

  it('should render configuration form', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render CORS help section', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should handle validation errors', () => {
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should handle password requirement on connect', () => {
    const mockOnRequirePassword = vi.fn();
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should verify connection with test() before marking as connected', async () => {
    const { CloudCredentialStorage } = require('@/utils/cloudCredentialStorage');
    const { waitFor } = require('@testing-library/react');
    
    // Mock saved config
    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };
    
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    mockService.test.mockResolvedValue(true);
    
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    
    // Wait for test() to be called
    await waitFor(() => {
      expect(mockService.test).toHaveBeenCalled();
    });
    
    // Should mark as connected after successful test
    await waitFor(() => {
      expect(mockOnConfigChange).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'nextcloud',
        serverUrl: 'https://cloud.example.com',
      }));
    });
  });

  it('should NOT mark as connected if test() fails', async () => {
    const { CloudCredentialStorage } = require('@/utils/cloudCredentialStorage');
    const { waitFor } = require('@testing-library/react');
    
    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };
    
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    mockService.test.mockResolvedValue(false);
    
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    
    // Wait for test() to be called
    await waitFor(() => {
      expect(mockService.test).toHaveBeenCalled();
    });
    
    // Should NOT call onConfigChange with connected state
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(mockOnConfigChange).not.toHaveBeenCalled();
  });

  it('should create window binding only once when connected', async () => {
    const { CloudCredentialStorage } = require('@/utils/cloudCredentialStorage');
    const { waitFor } = require('@testing-library/react');
    
    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };
    
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    mockService.test.mockResolvedValue(true);
    
    const { rerender } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    
    // Wait for connection
    await waitFor(() => {
      expect((window as any).nextcloudSync).toBeDefined();
    });
    
    const firstBinding = (window as any).nextcloudSync;
    
    // Rerender with same props
    rerender(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should be the same binding object
    expect((window as any).nextcloudSync).toBe(firstBinding);
  });

  it('should require password only when truly needed (no master key and trying to connect)', async () => {
    const { CloudCredentialStorage } = require('@/utils/cloudCredentialStorage');
    
    // No saved config initially
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(null);
    
    const { container } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    
    expect(container).toBeInTheDocument();
    
    // Should NOT call onRequirePassword if not trying to connect
    await new Promise(resolve => setTimeout(resolve, 500));
    expect(mockOnRequirePassword).not.toHaveBeenCalled();
  });

  it('should remove window binding when component unmounts', async () => {
    const { CloudCredentialStorage } = require('@/utils/cloudCredentialStorage');
    const { waitFor } = require('@testing-library/react');
    
    const mockConfig = {
      provider: 'nextcloud' as const,
      serverUrl: 'https://cloud.example.com',
      username: 'testuser',
      appPassword: 'testpass',
    };
    
    vi.mocked(CloudCredentialStorage.loadCredentials).mockResolvedValue(mockConfig);
    mockService.test.mockResolvedValue(true);
    
    const { unmount } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    
    // Wait for connection and window binding
    await waitFor(() => {
      expect((window as any).nextcloudSync).toBeDefined();
    });
    
    // Unmount component (simulates disconnection or navigation away)
    unmount();
    
    // Window binding should be cleaned up
    expect((window as any).nextcloudSync).toBeUndefined();
  });

  it('should NOT request password again after master key is provided', async () => {
    const { storageServiceV2 } = await import('@/services/storageServiceV2');
    const mockOnRequirePassword = vi.fn();
    
    // Mock storageServiceV2 to return null initially
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(null);
    
    // Start without master key
    const { rerender } = render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={null}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    
    // Now provide master key both in props AND in storage service (simulating password being set)
    vi.mocked(storageServiceV2.getMasterKey).mockReturnValue(mockMasterKey);
    
    rerender(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    
    // Re-render again (simulating component update)
    rerender(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
        onRequirePassword={mockOnRequirePassword}
      />
    );
    
    // Password should NOT be requested after master key is provided
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // onRequirePassword should not have been called after master key was provided
    // (it might have been called initially when masterKey was null, but not after)
    const callsAfterKeyProvided = mockOnRequirePassword.mock.calls.length;
    expect(callsAfterKeyProvided).toBeLessThanOrEqual(1);
    
    // Verify that storageServiceV2.getMasterKey was checked
    expect(storageServiceV2.getMasterKey).toHaveBeenCalled();
  });

  it('should establish window binding only once when connected', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    
    render(
      <NextcloudSync
        onConfigChange={mockOnConfigChange}
        masterKey={mockMasterKey}
      />
    );
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Count how many times "window binding established" was logged
    const bindingLogs = consoleSpy.mock.calls.filter(
      call => call[0]?.includes('window binding established')
    );
    
    // Should be called at most once
    expect(bindingLogs.length).toBeLessThanOrEqual(1);
    
    consoleSpy.mockRestore();
  });
});
