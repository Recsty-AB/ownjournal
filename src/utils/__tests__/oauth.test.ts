import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateOAuthState,
  getProviderFromState,
  storePKCEVerifier,
  retrievePKCEVerifier,
  validateTokenResponse,
  cleanOAuthUrl,
  checkOAuthRateLimit,
} from '../oauth';

describe('OAuth PKCE Utilities', () => {
  beforeEach(() => {
    // Clear storage before each test
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Code Verifier Generation', () => {
    it('should generate a valid code verifier', () => {
      const verifier = generateCodeVerifier();
      
      expect(verifier).toBeTruthy();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    it('should generate URL-safe base64 strings', () => {
      const verifier = generateCodeVerifier();
      
      // Should not contain +, /, or =
      expect(verifier).not.toMatch(/[+/=]/);
      // Should only contain URL-safe characters
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate unique verifiers', () => {
      const verifiers = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        verifiers.add(generateCodeVerifier());
      }
      
      expect(verifiers.size).toBe(100);
    });
  });

  describe('Code Challenge Generation', () => {
    it('should generate a valid code challenge from verifier', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      
      expect(challenge).toBeTruthy();
      expect(typeof challenge).toBe('string');
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate same challenge for same verifier', async () => {
      const verifier = generateCodeVerifier();
      
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);
      
      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenges for different verifiers', async () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      
      const challenge1 = await generateCodeChallenge(verifier1);
      const challenge2 = await generateCodeChallenge(verifier2);
      
      expect(challenge1).not.toBe(challenge2);
    });

    it('should use SHA-256 for hashing', async () => {
      const verifier = 'test-verifier';
      const challenge = await generateCodeChallenge(verifier);
      
      // SHA-256 produces 32 bytes = 43 characters in base64url (without padding)
      expect(challenge.length).toBe(43);
    });
  });

  describe('OAuth State Generation', () => {
    it('should generate a valid state parameter with provider prefix', () => {
      const state = generateOAuthState('google');
      
      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
      expect(state.startsWith('google_')).toBe(true);
    });

    it('should generate URL-safe strings', () => {
      const state = generateOAuthState('dropbox');
      // After the provider prefix, rest should be URL-safe
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate unique states', () => {
      const states = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        states.add(generateOAuthState('google'));
      }
      
      expect(states.size).toBe(100);
    });
    
    it('should extract provider from state', () => {
      const state = generateOAuthState('google-drive');
      const provider = getProviderFromState(state);
      expect(provider).toBe('google-drive');
    });
    
    it('should return null for state without provider prefix', () => {
      const provider = getProviderFromState('invalidstate');
      expect(provider).toBeNull();
    });
  });

  describe('PKCE Storage and Retrieval', () => {
    it('should store and retrieve PKCE verifier', () => {
      const provider = 'google';
      const verifier = generateCodeVerifier();
      const state = generateOAuthState(provider);
      
      storePKCEVerifier(provider, verifier, state);
      const retrieved = retrievePKCEVerifier(provider, state);
      
      expect(retrieved).toBe(verifier);
    });

    it('should return null for non-existent provider', () => {
      const state = generateOAuthState('some-provider');
      const retrieved = retrievePKCEVerifier('non-existent', state);
      
      expect(retrieved).toBeNull();
    });

    it('should return null for wrong state parameter', () => {
      const provider = 'google';
      const verifier = generateCodeVerifier();
      const correctState = generateOAuthState(provider);
      const wrongState = generateOAuthState(provider);
      
      storePKCEVerifier(provider, verifier, correctState);
      const retrieved = retrievePKCEVerifier(provider, wrongState);
      
      expect(retrieved).toBeNull();
    });

    it('should clear verifier after retrieval', () => {
      const provider = 'google';
      const verifier = generateCodeVerifier();
      const state = generateOAuthState(provider);
      
      storePKCEVerifier(provider, verifier, state);
      
      const firstRetrieval = retrievePKCEVerifier(provider, state);
      expect(firstRetrieval).toBe(verifier);
      
      const secondRetrieval = retrievePKCEVerifier(provider, state);
      expect(secondRetrieval).toBeNull();
    });

    it('should handle multiple providers independently', () => {
      const verifier1 = generateCodeVerifier();
      const state1 = generateOAuthState('google');
      const verifier2 = generateCodeVerifier();
      const state2 = generateOAuthState('dropbox');
      
      storePKCEVerifier('google', verifier1, state1);
      storePKCEVerifier('dropbox', verifier2, state2);
      
      expect(retrievePKCEVerifier('google', state1)).toBe(verifier1);
      expect(retrievePKCEVerifier('dropbox', state2)).toBe(verifier2);
    });

    it('should expire verifier after timeout', () => {
      vi.useFakeTimers();
      
      const provider = 'google';
      const verifier = generateCodeVerifier();
      const state = generateOAuthState(provider);
      
      storePKCEVerifier(provider, verifier, state);
      
      // Fast forward 11 minutes (past expiration)
      vi.advanceTimersByTime(11 * 60 * 1000);
      
      const retrieved = retrievePKCEVerifier(provider, state);
      expect(retrieved).toBeNull();
      
      vi.useRealTimers();
    });

    it('should use sessionStorage on web platform', () => {
      const provider = 'google';
      const verifier = generateCodeVerifier();
      const state = generateOAuthState(provider);
      
      // Mock web platform
      (window as any).Capacitor = undefined;
      (window as any).electronAPI = undefined;
      
      storePKCEVerifier(provider, verifier, state);
      
      // Should be in sessionStorage
      const stored = sessionStorage.getItem(`pkce_${provider}`);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!).verifier).toBe(verifier);
    });

    it('should handle sessionStorage errors gracefully', () => {
      const provider = 'google';
      const verifier = generateCodeVerifier();
      const state = generateOAuthState(provider);
      
      // Mock sessionStorage error
      vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should fall back to memory storage without throwing
      expect(() => {
        storePKCEVerifier(provider, verifier, state);
      }).not.toThrow();
      
      // Should still work via memory
      const retrieved = retrievePKCEVerifier(provider, state);
      expect(retrieved).toBe(verifier);
    });
  });

  describe('Token Response Validation', () => {
    it('should validate valid token response', () => {
      const tokenData = {
        access_token: 'valid-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'valid-refresh-token',
        scope: 'read write',
      };
      
      const result = validateTokenResponse(tokenData);
      
      expect(result.access_token).toBe(tokenData.access_token);
      expect(result.token_type).toBe(tokenData.token_type);
      expect(result.expires_in).toBe(tokenData.expires_in);
      expect(result.refresh_token).toBe(tokenData.refresh_token);
    });

    it('should throw on missing access_token', () => {
      const tokenData = {
        token_type: 'Bearer',
        expires_in: 3600,
      };
      
      expect(() => validateTokenResponse(tokenData)).toThrow();
    });

    it('should throw on missing token_type', () => {
      const tokenData = {
        access_token: 'valid-token',
        expires_in: 3600,
      };
      
      expect(() => validateTokenResponse(tokenData)).toThrow();
    });

    it('should handle optional refresh_token', () => {
      const tokenData = {
        access_token: 'valid-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };
      
      const result = validateTokenResponse(tokenData);
      expect(result.refresh_token).toBeUndefined();
    });

    it('should validate expected scopes when provided', () => {
      const tokenData = {
        access_token: 'valid-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read write admin',
      };
      
      expect(() => 
        validateTokenResponse(tokenData, ['read', 'write'])
      ).not.toThrow();
    });

    it('should throw when expected scopes are missing', () => {
      const tokenData = {
        access_token: 'valid-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read',
      };
      
      expect(() => 
        validateTokenResponse(tokenData, ['read', 'write', 'admin'])
      ).toThrow();
    });

    it('should handle scope as array', () => {
      const tokenData = {
        access_token: 'valid-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: ['read', 'write'],
      };
      
      expect(() => 
        validateTokenResponse(tokenData, ['read'])
      ).not.toThrow();
    });

    it('should reject invalid token types', () => {
      const tokenData = {
        access_token: 123, // Should be string
        token_type: 'Bearer',
        expires_in: 3600,
      };
      
      expect(() => validateTokenResponse(tokenData)).toThrow();
    });
  });

  describe('OAuth URL Cleanup', () => {
    it('should remove OAuth parameters from URL', () => {
      // Mock window.location
      const mockLocation = {
        href: 'https://example.com/?code=abc123&state=xyz789',
        origin: 'https://example.com',
        pathname: '/',
        search: '?code=abc123&state=xyz789',
      };
      
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      });
      
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      
      cleanOAuthUrl();
      
      expect(replaceStateSpy).toHaveBeenCalledWith(
        {},
        '',
        expect.not.stringContaining('code=')
      );
      expect(replaceStateSpy).toHaveBeenCalledWith(
        {},
        '',
        expect.not.stringContaining('state=')
      );
    });

    it('should preserve other query parameters', () => {
      const mockLocation = {
        href: 'https://example.com/?code=abc&foo=bar&state=xyz',
        origin: 'https://example.com',
        pathname: '/',
        search: '?code=abc&foo=bar&state=xyz',
      };
      
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      });
      
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
      
      cleanOAuthUrl();
      
      expect(replaceStateSpy).toHaveBeenCalledWith(
        {},
        '',
        expect.stringContaining('foo=bar')
      );
    });
  });

  describe('OAuth Rate Limiting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should allow initial OAuth attempt', () => {
      const canAttempt = checkOAuthRateLimit('google');
      expect(canAttempt).toBe(true);
    });

    it('should enforce rate limit after max attempts', () => {
      const provider = 'google';
      
      // First 3 attempts should succeed
      expect(checkOAuthRateLimit(provider)).toBe(true);
      expect(checkOAuthRateLimit(provider)).toBe(true);
      expect(checkOAuthRateLimit(provider)).toBe(true);
      
      // 4th attempt should be blocked
      expect(checkOAuthRateLimit(provider)).toBe(false);
    });

    it('should reset rate limit after cooldown period', () => {
      const provider = 'google';
      
      // Exhaust rate limit
      checkOAuthRateLimit(provider);
      checkOAuthRateLimit(provider);
      checkOAuthRateLimit(provider);
      expect(checkOAuthRateLimit(provider)).toBe(false);
      
      // Fast forward past cooldown (15 minutes)
      vi.advanceTimersByTime(16 * 60 * 1000);
      
      // Should allow attempts again
      expect(checkOAuthRateLimit(provider)).toBe(true);
    });

    it('should track rate limits per provider independently', () => {
      // Exhaust Google rate limit
      checkOAuthRateLimit('google');
      checkOAuthRateLimit('google');
      checkOAuthRateLimit('google');
      expect(checkOAuthRateLimit('google')).toBe(false);
      
      // Dropbox should still work
      expect(checkOAuthRateLimit('dropbox')).toBe(true);
    });
  });

  describe('Security Properties', () => {
    it('should generate cryptographically random values', () => {
      const values = new Set<string>();
      
      for (let i = 0; i < 1000; i++) {
        values.add(generateCodeVerifier());
      }
      
      // All values should be unique (no collisions)
      expect(values.size).toBe(1000);
    });

    it('should protect against timing attacks in state validation', () => {
      const provider = 'google';
      const verifier = generateCodeVerifier();
      const correctState = generateOAuthState(provider);
      const similarState = correctState.slice(0, -1) + 'x';
      
      storePKCEVerifier(provider, verifier, correctState);
      
      const start1 = performance.now();
      retrievePKCEVerifier(provider, correctState);
      const time1 = performance.now() - start1;
      
      storePKCEVerifier(provider, verifier, correctState);
      
      const start2 = performance.now();
      retrievePKCEVerifier(provider, similarState);
      const time2 = performance.now() - start2;
      
      // Timing difference should be minimal (< 10ms)
      expect(Math.abs(time1 - time2)).toBeLessThan(10);
    });

    it('should not expose sensitive data in errors', () => {
      const tokenData = { invalid: 'data' };
      
      try {
        validateTokenResponse(tokenData);
      } catch (error: any) {
        // Error should not contain token values
        expect(error.message).not.toContain('access_token');
      }
    });
  });

  describe('PKCE Flow Integration', () => {
    it('should complete full PKCE flow', async () => {
      const provider = 'google';
      
      // 1. Generate verifier and challenge
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      const state = generateOAuthState(provider);
      
      // 2. Store verifier before redirect
      storePKCEVerifier(provider, verifier, state);
      
      // 3. Simulate OAuth redirect callback
      const retrievedVerifier = retrievePKCEVerifier(provider, state);
      
      expect(retrievedVerifier).toBe(verifier);
      
      // 4. Validate token response
      const tokenData = {
        access_token: 'token-123',
        token_type: 'Bearer',
        expires_in: 3600,
      };
      
      const validatedToken = validateTokenResponse(tokenData);
      expect(validatedToken.access_token).toBe('token-123');
    });
  });
});
