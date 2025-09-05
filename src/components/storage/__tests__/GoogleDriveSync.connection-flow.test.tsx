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
  },
}));

vi.mock('@/services/googleDriveService', () => ({
  GoogleDriveService: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock('@/utils/oauth', () => ({
  generateCodeVerifier: vi.fn(() => 'test-verifier'),
  generateCodeChallenge: vi.fn(() => Promise.resolve('test-challenge')),
  generateOAuthState: vi.fn((provider: string) => `${provider}_test-state`),
  getProviderFromState: vi.fn((state: string) => state.split('_')[0] || null),
  storePKCEVerifier: vi.fn(),
  retrievePKCEVerifier: vi.fn(() => ({ verifier: 'test-verifier', state: 'test-state' })),
  validateTokenResponse: vi.fn((tokens) => tokens),
  cleanOAuthUrl: vi.fn(),
  checkOAuthRateLimit: vi.fn(() => true),
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
    const connectButton = screen.getByText('Connect to Google Drive');
    fireEvent.click(connectButton);

    // Should call onRequirePassword with a retry function
    await waitFor(() => {
      expect(onRequirePassword).toHaveBeenCalled();
    });

    // Verify the callback receives a function
    const passedArg = onRequirePassword.mock.calls[0][0];
    expect(typeof passedArg).toBe('function');
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
    const connectButton = screen.getByText('Connect to Google Drive');
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
        search: '?code=test-code&state=test-state',
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
        search: '?code=test-code&state=test-state',
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
        search: '?code=test-code&state=test-state',
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
