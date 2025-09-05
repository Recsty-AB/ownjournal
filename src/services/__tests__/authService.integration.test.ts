/**
 * Integration tests for AuthService
 * Tests OAuth flows across different platforms (Web, Capacitor, Electron)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../authService';
import type { OAuthConfig } from '../authService';

// Mock platform detection
vi.mock('@/utils/platformDetection', () => ({
  getPlatformInfo: vi.fn(() => ({
    platform: 'web' as const,
    category: 'web' as const,
    isWeb: true,
    isMobile: false,
    isDesktop: false,
    isCapacitor: false,
    isElectron: false,
    supportsPopupOAuth: true,
    supportsDeepLinking: false,
    supportsNativeFileSystem: false,
    deviceId: 'test-device-id',
  })),
}));

// Mock OAuth utilities
vi.mock('@/utils/oauth', () => ({
  generateCodeVerifier: vi.fn(() => 'test-verifier'),
  generateCodeChallenge: vi.fn(async () => 'test-challenge'),
  generateOAuthState: vi.fn((provider: string) => `${provider}_test-state`),
  getProviderFromState: vi.fn((state: string) => state.split('_')[0] || null),
  storePKCEVerifier: vi.fn(),
  retrievePKCEVerifier: vi.fn(() => 'test-verifier'),
  validateTokenResponse: vi.fn((data) => data),
  cleanOAuthUrl: vi.fn(),
  checkOAuthRateLimit: vi.fn(() => true),
}));

// Mock Capacitor Browser
vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: vi.fn(),
    addListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

describe('AuthService - Platform Integration', () => {
  let authService: AuthService;
  let mockConfig: OAuthConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = AuthService.getInstance();
    
    mockConfig = {
      provider: 'google-drive',
      clientId: 'test-client-id',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    };

    // Mock sessionStorage
    global.sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    // Mock window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        origin: 'https://app.example.com',
        pathname: '/',
        search: '',
        href: 'https://app.example.com/',
      },
    });
  });

  describe('Web Platform Flow', () => {
    it('should initiate OAuth flow on web platform', async () => {
      const { getPlatformInfo } = await import('@/utils/platformDetection');
      vi.mocked(getPlatformInfo).mockReturnValue({
        platform: 'web',
        category: 'web',
        isWeb: true,
        isMobile: false,
        isDesktop: false,
        isCapacitor: false,
        isElectron: false,
        supportsPopupOAuth: true,
        supportsDeepLinking: false,
        supportsNativeFileSystem: false,
        deviceId: 'test-device-id',
      });

      const result = await authService.authenticate(mockConfig);

      // On web, the method returns success: false because it redirects
      expect(result.success).toBe(false);
      expect(sessionStorage.setItem).toHaveBeenCalledWith('oauth_provider', 'google-drive');
    });

    it('should handle OAuth callback on web platform', async () => {
      const { getPlatformInfo } = await import('@/utils/platformDetection');
      vi.mocked(getPlatformInfo).mockReturnValue({
        platform: 'web',
        category: 'web',
        isWeb: true,
        isMobile: false,
        isDesktop: false,
        isCapacitor: false,
        isElectron: false,
        supportsPopupOAuth: true,
        supportsDeepLinking: false,
        supportsNativeFileSystem: false,
        deviceId: 'test-device-id',
      });

      // Mock URL with OAuth callback parameters
      window.location.search = '?code=test-auth-code&state=test-state';

      // Mock sessionStorage returning stored config
      vi.mocked(sessionStorage.getItem).mockImplementation((key) => {
        if (key === 'oauth_provider') return 'google-drive';
        if (key === 'oauth_config') return JSON.stringify({
          clientId: mockConfig.clientId,
          tokenUrl: mockConfig.tokenUrl,
          scopes: mockConfig.scopes,
        });
        return null;
      });

      // Mock fetch for token exchange
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      const result = await authService.authenticate(mockConfig);

      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.tokens?.access_token).toBe('test-access-token');
    });

    it('should handle OAuth errors on web platform', async () => {
      const { getPlatformInfo } = await import('@/utils/platformDetection');
      vi.mocked(getPlatformInfo).mockReturnValue({
        platform: 'web',
        category: 'web',
        isWeb: true,
        isMobile: false,
        isDesktop: false,
        isCapacitor: false,
        isElectron: false,
        supportsPopupOAuth: true,
        supportsDeepLinking: false,
        supportsNativeFileSystem: false,
        deviceId: 'test-device-id',
      });

      // Mock URL with OAuth error
      window.location.search = '?error=access_denied&error_description=User+denied+access';

      const result = await authService.authenticate(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('access_denied');
    });

    it('should enforce rate limiting', async () => {
      const { checkOAuthRateLimit } = await import('@/utils/oauth');
      vi.mocked(checkOAuthRateLimit).mockReturnValue(false);

      const result = await authService.authenticate(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many authentication attempts');
    });
  });

  describe('Capacitor Platform Flow', () => {
    it('should initiate OAuth flow on Capacitor platform', async () => {
      const { getPlatformInfo } = await import('@/utils/platformDetection');
      vi.mocked(getPlatformInfo).mockReturnValue({
        platform: 'capacitor-ios',
        category: 'mobile',
        isWeb: false,
        isMobile: true,
        isDesktop: false,
        isCapacitor: true,
        isElectron: false,
        supportsPopupOAuth: false,
        supportsDeepLinking: true,
        supportsNativeFileSystem: false,
        deviceId: 'test-device-id',
      });

      const { Browser } = await import('@capacitor/browser');
      
      // Mock Browser.addListener to immediately trigger callback
      vi.mocked(Browser.addListener).mockImplementation((event, callback: (data: { url: string }) => void) => {
        if (event === 'browserPageLoaded') {
          setTimeout(() => {
            callback({ url: 'https://app.example.com/?code=test-code&state=test-state' });
          }, 0);
        }
        return Promise.resolve({ remove: async () => {} });
      });

      // Mock fetch for token exchange
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      const result = await authService.authenticate(mockConfig);

      expect(Browser.open).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.tokens?.access_token).toBe('test-access-token');
    });

    it('should handle user cancellation on Capacitor', async () => {
      const { getPlatformInfo } = await import('@/utils/platformDetection');
      vi.mocked(getPlatformInfo).mockReturnValue({
        platform: 'capacitor-ios',
        category: 'mobile',
        isWeb: false,
        isMobile: true,
        isDesktop: false,
        isCapacitor: true,
        isElectron: false,
        supportsPopupOAuth: false,
        supportsDeepLinking: true,
        supportsNativeFileSystem: false,
        deviceId: 'test-device-id',
      });

      const { Browser } = await import('@capacitor/browser');
      
      // Mock user closing browser
      vi.mocked(Browser.addListener).mockImplementation((event, callback: (data: { url: string }) => void) => {
        if (event === 'browserPageLoaded') {
          setTimeout(() => {
            callback({ url: '' }); // Empty URL indicates cancellation
          }, 0);
        }
        return Promise.resolve({ remove: async () => {} });
      });

      const result = await authService.authenticate(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });

  describe('Electron Platform Flow', () => {
    it('should initiate OAuth flow on Electron platform', async () => {
      const { getPlatformInfo } = await import('@/utils/platformDetection');
      vi.mocked(getPlatformInfo).mockReturnValue({
        platform: 'electron-mac',
        category: 'desktop',
        isWeb: false,
        isMobile: false,
        isDesktop: true,
        isCapacitor: false,
        isElectron: true,
        supportsPopupOAuth: false,
        supportsDeepLinking: false,
        supportsNativeFileSystem: true,
        deviceId: 'test-device-id',
      });

      // Mock Electron IPC
      (window as unknown as Record<string, unknown>).electronAPI = {
        openOAuth: vi.fn().mockResolvedValue({
          success: true,
          code: 'test-code',
          state: 'test-state',
        }),
      };

      // Mock fetch for token exchange
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      const result = await authService.authenticate(mockConfig);

      expect((window as unknown as Record<string, unknown>).electronAPI).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.tokens?.access_token).toBe('test-access-token');
    });

    it('should handle Electron IPC errors', async () => {
      const { getPlatformInfo } = await import('@/utils/platformDetection');
      vi.mocked(getPlatformInfo).mockReturnValue({
        platform: 'electron-mac',
        category: 'desktop',
        isWeb: false,
        isMobile: false,
        isDesktop: true,
        isCapacitor: false,
        isElectron: true,
        supportsPopupOAuth: false,
        supportsDeepLinking: false,
        supportsNativeFileSystem: true,
        deviceId: 'test-device-id',
      });

      // Mock Electron IPC error
      (window as unknown as Record<string, unknown>).electronAPI = {
        openOAuth: vi.fn().mockResolvedValue({
          success: false,
          error: 'User closed the authentication window',
        }),
      };

      const result = await authService.authenticate(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('closed');
    });
  });

  describe('Cross-Platform Token Exchange', () => {
    it('should successfully exchange authorization code for tokens', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: mockConfig.scopes.join(' '),
        }),
      });

      window.location.search = '?code=test-code&state=test-state';
      vi.mocked(sessionStorage.getItem).mockImplementation((key) => {
        if (key === 'oauth_provider') return 'google-drive';
        if (key === 'oauth_config') return JSON.stringify({
          clientId: mockConfig.clientId,
          tokenUrl: mockConfig.tokenUrl,
          scopes: mockConfig.scopes,
        });
        return null;
      });

      const result = await authService.authenticate(mockConfig);

      expect(fetch).toHaveBeenCalledWith(
        mockConfig.tokenUrl,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
      expect(result.success).toBe(true);
    });

    it('should handle token exchange errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        }),
      });

      window.location.search = '?code=invalid-code&state=test-state';
      vi.mocked(sessionStorage.getItem).mockImplementation((key) => {
        if (key === 'oauth_provider') return 'google-drive';
        if (key === 'oauth_config') return JSON.stringify({
          clientId: mockConfig.clientId,
          tokenUrl: mockConfig.tokenUrl,
          scopes: mockConfig.scopes,
        });
        return null;
      });

      const result = await authService.authenticate(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network errors during token exchange', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      window.location.search = '?code=test-code&state=test-state';
      vi.mocked(sessionStorage.getItem).mockImplementation((key) => {
        if (key === 'oauth_provider') return 'google-drive';
        if (key === 'oauth_config') return JSON.stringify({
          clientId: mockConfig.clientId,
          tokenUrl: mockConfig.tokenUrl,
          scopes: mockConfig.scopes,
        });
        return null;
      });

      const result = await authService.authenticate(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('PKCE Flow', () => {
    it('should use PKCE parameters in authorization URL', async () => {
      const { generateCodeVerifier, generateCodeChallenge, storePKCEVerifier } = await import('@/utils/oauth');
      
      await authService.authenticate(mockConfig);

      expect(generateCodeVerifier).toHaveBeenCalled();
      expect(generateCodeChallenge).toHaveBeenCalledWith('test-verifier');
      expect(storePKCEVerifier).toHaveBeenCalledWith(
        mockConfig.provider,
        'test-verifier',
        'test-state'
      );
    });

    it('should validate state parameter in callback', async () => {
      const { retrievePKCEVerifier } = await import('@/utils/oauth');
      
      window.location.search = '?code=test-code&state=mismatched-state';
      vi.mocked(sessionStorage.getItem).mockImplementation((key) => {
        if (key === 'oauth_provider') return 'google-drive';
        if (key === 'oauth_config') return JSON.stringify({
          clientId: mockConfig.clientId,
          tokenUrl: mockConfig.tokenUrl,
          scopes: mockConfig.scopes,
        });
        return null;
      });
      
      // Mock verifier retrieval failure (state mismatch)
      vi.mocked(retrievePKCEVerifier).mockReturnValue(null);

      const result = await authService.authenticate(mockConfig);

      expect(result.success).toBe(false);
    });
  });
});
