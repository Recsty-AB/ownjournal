/**
 * OAuth 2.0 PKCE utilities for secure authorization without client secrets
 * PKCE (Proof Key for Code Exchange) allows public clients to securely use OAuth
 */

import { buildAppLink } from '@/config/app';

/**
 * Generate a cryptographically random code verifier
 * 43-128 characters, URL-safe base64 encoded
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

/**
 * Generate code challenge from verifier using SHA-256
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(new Uint8Array(hash));
}

/**
 * URL-safe base64 encoding (no padding, URL-safe characters)
 */
function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Validate OAuth state parameter to prevent CSRF attacks
 * State includes provider prefix for routing callbacks to correct component
 */
export function generateOAuthState(provider: string): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const randomPart = base64URLEncode(array);
  return `${provider}_${randomPart}`;
}

/**
 * Extract provider from OAuth state parameter
 */
export function getProviderFromState(state: string): string | null {
  const underscoreIndex = state.indexOf('_');
  if (underscoreIndex === -1) return null;
  return state.substring(0, underscoreIndex);
}

/**
 * PRIVACY-FIRST: Store PKCE verifier and state
 * - Web: sessionStorage (persists across redirects, cleared on tab close)
 * - Capacitor/Electron: Memory only (no redirect, more secure)
 * Expires after 10 minutes to prevent stale state attacks
 */
const pkceStore = new Map<string, { verifier: string; state: string; expiresAt: number }>();

// Helper to detect if we should use sessionStorage (web only, not Capacitor/Electron)
function shouldUseSessionStorage(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Use memory for Capacitor (no page reload during OAuth)
  if ((window as any).Capacitor?.isNativePlatform?.()) return false;
  
  // Use memory for Electron (no page reload during OAuth)
  if ((window as any).electronAPI?.isElectron) return false;
  
  // Use sessionStorage for web (survives redirects)
  return true;
}

export function storePKCEVerifier(provider: string, verifier: string, state: string): void {
  const expiresAt = Date.now() + (10 * 60 * 1000);
  const data = { verifier, state, expiresAt };
  
  if (shouldUseSessionStorage()) {
    // Web: Use sessionStorage to persist across OAuth redirects
    try {
      sessionStorage.setItem(`pkce_${provider}`, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to store PKCE in sessionStorage, using memory:', err);
      pkceStore.set(provider, data);
    }
  } else {
    // Capacitor/Electron: Memory only (no redirect)
    pkceStore.set(provider, data);
  }
  
  // Auto-cleanup expired entries
  setTimeout(() => cleanExpiredPKCE(), 10 * 60 * 1000 + 1000);
}

function cleanExpiredPKCE(): void {
  const now = Date.now();
  
  // Clean memory store
  for (const [provider, data] of pkceStore.entries()) {
    if (data.expiresAt <= now) {
      pkceStore.delete(provider);
    }
  }
  
  // Clean sessionStorage if on web
  if (shouldUseSessionStorage() && typeof sessionStorage !== 'undefined') {
    try {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('pkce_')) {
          const stored = sessionStorage.getItem(key);
          if (stored) {
            const data = JSON.parse(stored);
            if (data.expiresAt <= now) {
              sessionStorage.removeItem(key);
            }
          }
        }
      });
    } catch (err) {
      console.warn('Failed to clean expired PKCE from sessionStorage:', err);
    }
  }
}

/**
 * Retrieve and clear PKCE verifier and validate state
 * SECURITY: Validates state before returning verifier
 * Checks both sessionStorage (web) and memory (Capacitor/Electron)
 */
export function retrievePKCEVerifier(provider: string, returnedState: string): string | null {
  let data = pkceStore.get(provider);
  
  // Try sessionStorage if not in memory (web platform)
  if (!data && shouldUseSessionStorage()) {
    try {
      const stored = sessionStorage.getItem(`pkce_${provider}`);
      if (stored) {
        data = JSON.parse(stored);
        sessionStorage.removeItem(`pkce_${provider}`); // Clear after retrieval
      }
    } catch (err) {
      console.warn('Failed to retrieve PKCE from sessionStorage:', err);
    }
  }
  
  if (!data) {
    console.error('[OAuth] No PKCE data found for provider:', provider);
    return null;
  }
  
  // Check if expired
  if (Date.now() > data.expiresAt) {
    console.error('[OAuth] PKCE data expired for provider:', provider);
    pkceStore.delete(provider);
    if (shouldUseSessionStorage()) {
      try {
        sessionStorage.removeItem(`pkce_${provider}`);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    return null;
  }
  
  // Validate state to prevent CSRF
  if (data.state !== returnedState) {
    console.error('[OAuth] State mismatch - potential CSRF attack');
    pkceStore.delete(provider);
    if (shouldUseSessionStorage()) {
      try {
        sessionStorage.removeItem(`pkce_${provider}`);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    return null;
  }
  
  // Clear after use (one-time use)
  pkceStore.delete(provider);
  
  return data.verifier;
}

/**
 * Validate OAuth token response
 */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

export function validateTokenResponse(data: any, expectedScopes?: string[]): TokenResponse {
  if (!data.access_token || typeof data.access_token !== 'string') {
    throw new Error('Invalid token response: missing access_token');
  }
  
  if (!data.refresh_token || typeof data.refresh_token !== 'string') {
    throw new Error('Invalid token response: missing refresh_token');
  }
  
  if (!data.expires_in || typeof data.expires_in !== 'number') {
    throw new Error('Invalid token response: missing expires_in');
  }
  
  // Validate scopes if provided (privacy check)
  if (expectedScopes && data.scope) {
    const returnedScopes = data.scope.split(' ');
    const hasAllScopes = expectedScopes.every(scope => returnedScopes.includes(scope));
    if (!hasAllScopes) {
      console.warn('OAuth warning: Returned scopes do not match requested scopes');
    }
  }
  
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: data.scope,
  };
}

/**
 * Check if running on a native platform (Capacitor/Electron)
 */
function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check Capacitor
  if ((window as any).Capacitor?.isNativePlatform?.()) return true;
  
  // Check Electron
  if ((window as any).electronAPI?.isElectron) return true;
  
  return false;
}

/**
 * Get the OAuth redirect URI for a specific provider.
 *
 * For native platforms (Android/iOS), uses HTTPS App Links for storage OAuth:
 * - Storage OAuth (Google Drive, Dropbox): https://{APP_DOMAIN}/storage-callback
 *
 * For web:
 * - Dropbox requires trailing slash to match console config.
 * - Google Drive works with origin only.
 */
export function getOAuthRedirectUri(provider?: 'google-drive' | 'dropbox'): string {
  // For native platforms, use HTTPS App Link for storage providers
  if (isNativePlatform() && (provider === 'google-drive' || provider === 'dropbox')) {
    const redirectUri = buildAppLink('/storage-callback');
    if (import.meta.env.DEV) {
      console.log(`🔐 [${provider}] Native OAuth redirect URI:`, redirectUri);
    }
    return redirectUri;
  }
  
  const origin = window.location.origin;
  
  // Dropbox requires trailing slash to match console config
  if (provider === 'dropbox') {
    const redirectUri = origin.endsWith('/') ? origin : `${origin}/`;
    if (import.meta.env.DEV) {
      console.log('🔐 [Dropbox] OAuth redirect URI:', redirectUri);
    }
    return redirectUri;
  }
  
  // Google Drive and default: use origin without trailing slash
  if (import.meta.env.DEV) {
    console.log('🔐 OAuth redirect URI:', origin);
  }
  return origin;
}

/**
 * Clean URL of OAuth parameters (privacy: remove from browser history)
 */
export function cleanOAuthUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  window.history.replaceState({}, document.title, url.pathname + url.search);
}

/**
 * Rate limiter for OAuth attempts (prevent abuse)
 */
const oauthAttempts = new Map<string, number[]>();

export function checkOAuthRateLimit(provider: string): boolean {
  const now = Date.now();
  const attempts = oauthAttempts.get(provider) || [];
  
  // Remove attempts older than 5 minutes
  const recentAttempts = attempts.filter(time => now - time < 5 * 60 * 1000);
  
  // Allow max 5 attempts per 5 minutes
  if (recentAttempts.length >= 5) {
    return false;
  }
  
  recentAttempts.push(now);
  oauthAttempts.set(provider, recentAttempts);
  return true;
}

// ============= OAuth Code Deduplication =============

const PROCESSED_CODES_KEY = 'oauth_processed_codes';
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ProcessedCodeEntry {
  timestamp: number;
}

/**
 * Mark an OAuth authorization code as processed
 * This persists in sessionStorage to survive page reloads
 */
export function markOAuthCodeProcessed(code: string): void {
  try {
    const stored = sessionStorage.getItem(PROCESSED_CODES_KEY);
    const processed: Record<string, ProcessedCodeEntry> = stored ? JSON.parse(stored) : {};
    
    // Clean expired entries
    const now = Date.now();
    for (const [key, entry] of Object.entries(processed)) {
      if (now - entry.timestamp > CODE_TTL_MS) {
        delete processed[key];
      }
    }
    
    // Add new code
    processed[code] = { timestamp: now };
    sessionStorage.setItem(PROCESSED_CODES_KEY, JSON.stringify(processed));
  } catch (err) {
    console.warn('Failed to mark OAuth code as processed:', err);
  }
}

/**
 * Check if an OAuth authorization code has already been processed
 * Returns true if the code was already processed (should skip)
 */
export function isOAuthCodeProcessed(code: string): boolean {
  try {
    const stored = sessionStorage.getItem(PROCESSED_CODES_KEY);
    if (!stored) return false;
    
    const processed: Record<string, ProcessedCodeEntry> = JSON.parse(stored);
    const entry = processed[code];
    
    if (!entry) return false;
    
    // Check if still within TTL
    const now = Date.now();
    if (now - entry.timestamp > CODE_TTL_MS) {
      // Expired, clean up
      delete processed[code];
      sessionStorage.setItem(PROCESSED_CODES_KEY, JSON.stringify(processed));
      return false;
    }
    
    return true;
  } catch (err) {
    console.warn('Failed to check OAuth code status:', err);
    return false;
  }
}

/**
 * Clear all processed OAuth codes (for testing/debugging)
 */
export function clearProcessedOAuthCodes(): void {
  try {
    sessionStorage.removeItem(PROCESSED_CODES_KEY);
  } catch (err) {
    // Ignore
  }
}
