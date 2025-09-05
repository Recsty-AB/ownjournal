import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { GoogleDriveSync } from '../GoogleDriveSync';
import { DropboxSync } from '../DropboxSync';

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

vi.mock('@/services/dropboxService', () => ({
  DropboxService: vi.fn().mockImplementation(() => ({
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

describe('OAuth Race Condition Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'http://localhost',
        pathname: '/',
        search: '',
        href: '',
      },
      writable: true,
    });
  });

  describe('GoogleDriveSync', () => {
    it('should wait before calling onRequirePassword when OAuth callback occurs without master key', async () => {
      const onRequirePassword = vi.fn();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate OAuth callback in URL
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '?code=test-code&state=test-state' },
        writable: true,
      });

      render(
        <GoogleDriveSync
          masterKey={null}
          onRequirePassword={onRequirePassword}
        />
      );

      // Should log warning about waiting
      await waitFor(() => {
        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('OAuth callback received but master key not available, waiting')
        );
      }, { timeout: 300 });

      // After waiting, should log error and call onRequirePassword
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          expect.stringContaining('Master key still not available after waiting')
        );
        expect(onRequirePassword).toHaveBeenCalled();
      }, { timeout: 500 });

      consoleWarn.mockRestore();
      consoleError.mockRestore();
    });

    it('should process OAuth callback immediately when master key is already available', async () => {
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
        value: { ...window.location, search: '?code=test-code&state=test-state' },
        writable: true,
      });

      render(
        <GoogleDriveSync
          masterKey={mockMasterKey}
          onConfigChange={onConfigChange}
        />
      );

      // Should process OAuth immediately without warnings
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should handle OAuth error in URL without requiring password', async () => {
      const onRequirePassword = vi.fn();

      // Simulate OAuth error
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '?error=access_denied&error_description=User denied' },
        writable: true,
      });

      render(
        <GoogleDriveSync
          masterKey={null}
          onRequirePassword={onRequirePassword}
        />
      );

      // Should not call onRequirePassword for OAuth errors
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(onRequirePassword).not.toHaveBeenCalled();
    });
  });

  describe('DropboxSync', () => {
    it('should wait before calling onRequirePassword when OAuth callback occurs without master key', async () => {
      const onRequirePassword = vi.fn();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate OAuth callback in URL
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '?code=test-code&state=test-state' },
        writable: true,
      });

      render(
        <DropboxSync
          masterKey={null}
          onRequirePassword={onRequirePassword}
        />
      );

      // Should log warning about waiting
      await waitFor(() => {
        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining('OAuth callback received but master key not available, waiting')
        );
      }, { timeout: 300 });

      // After waiting, should log error and call onRequirePassword
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          expect.stringContaining('Master key still not available after waiting')
        );
        expect(onRequirePassword).toHaveBeenCalled();
      }, { timeout: 500 });

      consoleWarn.mockRestore();
      consoleError.mockRestore();
    });

    it('should process OAuth callback when master key is available', async () => {
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
        value: { ...window.location, search: '?code=test-code&state=test-state' },
        writable: true,
      });

      render(
        <DropboxSync
          masterKey={mockMasterKey}
          onConfigChange={onConfigChange}
        />
      );

      // Should process OAuth immediately
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 1000 });
    });
  });

  describe('Race condition prevention', () => {
    it('should not call onRequirePassword multiple times for the same OAuth callback', async () => {
      const onRequirePassword = vi.fn();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate OAuth callback in URL
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '?code=test-code&state=test-state' },
        writable: true,
      });

      const { rerender } = render(
        <GoogleDriveSync
          masterKey={null}
          onRequirePassword={onRequirePassword}
        />
      );

      // Wait for initial processing
      await waitFor(() => {
        expect(onRequirePassword).toHaveBeenCalledTimes(1);
      }, { timeout: 500 });

      // Rerender with same props
      rerender(
        <GoogleDriveSync
          masterKey={null}
          onRequirePassword={onRequirePassword}
        />
      );

      // Should not call again (URL was cleaned)
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(onRequirePassword).toHaveBeenCalledTimes(1);

      consoleWarn.mockRestore();
      consoleError.mockRestore();
    });
  });
});
