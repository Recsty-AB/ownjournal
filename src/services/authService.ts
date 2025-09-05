/**
 * OAuth Authentication Service
 * Abstracts OAuth flows for different platforms (Web, Capacitor, Electron)
 */

import { getPlatformInfo } from '@/utils/platformDetection';
import { SUPABASE_CONFIG } from '@/config/supabase';
import { getGoogleClientId } from '@/config/oauth';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateOAuthState,
  storePKCEVerifier,
  retrievePKCEVerifier,
  validateTokenResponse,
  cleanOAuthUrl,
  checkOAuthRateLimit,
  getOAuthRedirectUri,
  type TokenResponse,
} from '@/utils/oauth';

export interface OAuthConfig {
  provider: 'google-drive' | 'dropbox';
  clientId: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri?: string; // Optional, will be auto-generated if not provided
}

export interface OAuthResult {
  success: boolean;
  tokens?: TokenResponse;
  error?: string;
}

/**
 * Main OAuth Service
 * Routes to platform-specific implementations
 */
export class AuthService {
  private static instance: AuthService;
  
  private constructor() {}
  
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  /**
   * Initiate OAuth flow (platform-aware)
   */
  async authenticate(config: OAuthConfig): Promise<OAuthResult> {
    const platform = getPlatformInfo();
    
    // Rate limiting
    if (!checkOAuthRateLimit(config.provider)) {
      return {
        success: false,
        error: 'Too many authentication attempts. Please wait before trying again.',
      };
    }
    
    try {
      if (platform.isWeb) {
        return await this.authenticateWeb(config);
      } else if (platform.isCapacitor) {
        return await this.authenticateCapacitor(config);
      } else if (platform.isElectron) {
        return await this.authenticateElectron(config);
      }
      
      return {
        success: false,
        error: 'Unsupported platform for OAuth',
      };
    } catch (error: any) {
      console.error('OAuth authentication failed:', error);
      return {
        success: false,
        error: error.message || 'Authentication failed',
      };
    }
  }
  
  /**
   * Web OAuth flow using full-page redirect
   * Initiates OAuth and stores provider config for callback handling
   */
  private async authenticateWeb(config: OAuthConfig): Promise<OAuthResult> {
    // Check if we're returning from OAuth (has code in URL)
    const callback = this.handleOAuthCallback();
    if (callback) {
      // We're returning from OAuth, complete the flow
      return await this.completeWebOAuth(config, callback.code, callback.state);
    }
    
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateOAuthState(config.provider);
    
    // Store verifier and state (sessionStorage for web - persists across redirects)
    storePKCEVerifier(config.provider, codeVerifier, state);
    
    // Store provider config in sessionStorage for callback
    try {
      sessionStorage.setItem('oauth_provider', config.provider);
      sessionStorage.setItem('oauth_config', JSON.stringify({
        clientId: config.clientId,
        tokenUrl: config.tokenUrl,
        scopes: config.scopes,
      }));
    } catch (err) {
      console.warn('Failed to store OAuth config:', err);
    }
    
    // Build authorization URL
    const redirectUri = config.redirectUri || getOAuthRedirectUri();
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    // Provider-specific parameters
    if (config.provider === 'google-drive') {
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
    } else if (config.provider === 'dropbox') {
      authUrl.searchParams.set('token_access_type', 'offline');
    }
    
    // Redirect to OAuth provider
    window.location.href = authUrl.toString();
    
    // This won't return - page will redirect
    return { success: false, error: 'Redirecting...' };
  }
  
  /**
   * Complete web OAuth after redirect back from provider
   */
  private async completeWebOAuth(
    config: OAuthConfig,
    code: string,
    state: string
  ): Promise<OAuthResult> {
    try {
      // Retrieve stored config if not provided
      let finalConfig = config;
      if (!config.tokenUrl || !config.clientId) {
        try {
          const storedProvider = sessionStorage.getItem('oauth_provider');
          const storedConfig = sessionStorage.getItem('oauth_config');
          if (storedProvider && storedConfig) {
            const parsed = JSON.parse(storedConfig);
            finalConfig = {
              ...config,
              provider: (storedProvider as 'google-drive' | 'dropbox'),
              clientId: parsed.clientId,
              tokenUrl: parsed.tokenUrl,
              scopes: parsed.scopes,
            };
          }
          // Clean up
          sessionStorage.removeItem('oauth_provider');
          sessionStorage.removeItem('oauth_config');
        } catch (err) {
          console.warn('Failed to retrieve stored OAuth config:', err);
        }
      }
      
      // Retrieve and validate PKCE verifier
      const verifier = retrievePKCEVerifier(finalConfig.provider, state);
      if (!verifier) {
        return {
          success: false,
          error: 'Authentication session expired. Please try again.',
        };
      }
      
      // Exchange code for tokens
      const redirectUri = finalConfig.redirectUri || getOAuthRedirectUri();
      const tokens = await this.exchangeCodeForTokens(
        finalConfig,
        code,
        verifier,
        redirectUri
      );
      
      return {
        success: true,
        tokens,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Authentication failed. Please try again.',
      };
    }
  }
  
  /**
   * Capacitor OAuth flow (HTTPS App Links for Android)
   * Uses verified HTTPS URLs instead of custom schemes for Google compliance
   */
  private async authenticateCapacitor(config: OAuthConfig): Promise<OAuthResult> {
    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateOAuthState(config.provider);
      
      // Store PKCE verifier and state
      storePKCEVerifier(config.provider, codeVerifier, state);
      
      // Use HTTPS App Link for storage OAuth (Google Drive, Dropbox)
      // This is required for Google OAuth compliance on Android
      const redirectUri = config.redirectUri || getOAuthRedirectUri(config.provider);
      
      // Use platform-specific client ID for Google Drive on Android
      const effectiveClientId = config.provider === 'google-drive' 
        ? getGoogleClientId() 
        : config.clientId;
      
      console.log(`📱 [AuthService] Capacitor OAuth for ${config.provider}`);
      console.log(`   Redirect URI: ${redirectUri}`);
      
      const authUrl = new URL(config.authUrl);
      authUrl.searchParams.set('client_id', effectiveClientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', config.scopes.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      
      // Provider-specific parameters
      if (config.provider === 'google-drive') {
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
      } else if (config.provider === 'dropbox') {
        authUrl.searchParams.set('token_access_type', 'offline');
      }
      
      // Import Capacitor modules dynamically
      const { Browser } = await import('@capacitor/browser');
      const { App } = await import('@capacitor/app');
      
      return new Promise(async (resolve) => {
        let isResolved = false;
        
        // Set up timeout (5 minutes)
        const timeout = setTimeout(async () => {
          if (!isResolved) {
            isResolved = true;
            try {
              await listener.remove();
              await Browser.close();
            } catch (e) {
              console.error('Error cleaning up OAuth timeout:', e);
            }
            resolve({
              success: false,
              error: 'Authentication timed out. Please try again.',
            });
          }
        }, 5 * 60 * 1000);
        
        // Set up deep link listener (await the promise)
        const listener = await App.addListener('appUrlOpen', async (data: any) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timeout);
          
          // Remove listener
          await listener.remove();
          
          try {
            const url = new URL(data.url);
            const code = url.searchParams.get('code');
            const returnedState = url.searchParams.get('state');
            const error = url.searchParams.get('error');
            
            // Close the browser
            await Browser.close();
            
            if (error) {
              resolve({
                success: false,
                error: `Authentication failed: ${error}`,
              });
              return;
            }
            
            if (!code || !returnedState) {
              resolve({
                success: false,
                error: 'Authentication was not completed. Please try again.',
              });
              return;
            }
            
            // Retrieve and validate PKCE verifier
            const verifier = retrievePKCEVerifier(config.provider, returnedState);
            if (!verifier) {
              resolve({
                success: false,
                error: 'Authentication session expired. Please try again.',
              });
              return;
            }
            
            // Exchange code for tokens
            // Google Drive requires client_secret, so use edge function for secure token exchange
            let tokens: any;
            
            if (config.provider === 'google-drive') {
              // Use edge function which has the client_secret stored securely
              const supabaseUrl = SUPABASE_CONFIG.url;
              console.log('📱 [AuthService] Using edge function for Google Drive token exchange');
              
              // Get auth token for edge function authentication
              const { supabase } = await import('@/integrations/supabase/client');
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) {
                console.error('📱 [AuthService] No auth session for token exchange');
                resolve({
                  success: false,
                  error: 'Authentication required for OAuth token exchange',
                });
                return;
              }
              
              const tokenResponse = await fetch(`${supabaseUrl}/functions/v1/google-drive-token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  code,
                  redirect_uri: redirectUri,
                  code_verifier: verifier,
                  grant_type: 'authorization_code',
                }),
              });
              
              if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error('📱 [AuthService] Google Drive token exchange failed:', errorText);
                resolve({
                  success: false,
                  error: 'Failed to complete authentication. Please try again.',
                });
                return;
              }
              
              tokens = await tokenResponse.json();
            } else {
              // Direct token exchange for other providers (Dropbox, etc.)
              const tokenResponse = await fetch(config.tokenUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                  grant_type: 'authorization_code',
                  code,
                  redirect_uri: redirectUri,
                  client_id: config.clientId,
                  code_verifier: verifier,
                }).toString(),
              });
              
              if (!tokenResponse.ok) {
                resolve({
                  success: false,
                  error: 'Failed to complete authentication. Please try again.',
                });
                return;
              }
              
              tokens = await tokenResponse.json();
            }
            
            const validatedTokens = validateTokenResponse(tokens, config.scopes);
            
            resolve({
              success: true,
              tokens: validatedTokens,
            });
          } catch (err) {
            resolve({
              success: false,
              error: err instanceof Error ? err.message : 'Failed to process OAuth callback',
            });
          }
        });
        
        // Open browser for OAuth
        Browser.open({ 
          url: authUrl.toString(),
          presentationStyle: 'popover',
        }).catch(async (err) => {
          clearTimeout(timeout);
          await listener.remove();
          resolve({
            success: false,
            error: 'Failed to open authentication window. Please try again.',
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: 'Authentication failed. Please try again.',
      };
    }
  }
  
  /**
   * Electron OAuth flow (native browser window with deep linking)
   */
  private async authenticateElectron(config: OAuthConfig): Promise<OAuthResult> {
    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateOAuthState(config.provider);
      
      // Store PKCE verifier and state
      storePKCEVerifier(config.provider, codeVerifier, state);
      
      // Build authorization URL with deep link redirect
      const redirectUri = config.redirectUri || 'ownjournal://oauth/callback';
      const authUrl = new URL(config.authUrl);
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', config.scopes.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      
      // Provider-specific parameters
      if (config.provider === 'google-drive') {
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
      } else if (config.provider === 'dropbox') {
        authUrl.searchParams.set('token_access_type', 'offline');
      }
      
      // Check if Electron API is available
      if (!window.electronAPI) {
        return {
          success: false,
          error: 'Desktop features not available. Please use the desktop app.',
        };
      }
      
      // Open OAuth in native window
      const callbackUrl = await window.electronAPI.startOAuth(authUrl.toString());
      
      // Parse callback URL
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      
      if (error) {
        return {
          success: false,
          error: `Authentication failed: ${error}`,
        };
      }
      
      if (!code || !returnedState) {
        return {
          success: false,
          error: 'Authentication was not completed. Please try again.',
        };
      }
      
      // Retrieve and validate PKCE verifier
      const verifier = retrievePKCEVerifier(config.provider, returnedState);
      if (!verifier) {
        return {
          success: false,
          error: 'Authentication session expired. Please try again.',
        };
      }
      
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(
        config,
        code,
        verifier,
        redirectUri
      );
      
      return {
        success: true,
        tokens,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Authentication failed. Please try again.',
      };
    }
  }
  
  /**
   * Exchange authorization code for access/refresh tokens
   */
  private async exchangeCodeForTokens(
    config: OAuthConfig,
    code: string,
    codeVerifier: string,
    redirectUri: string
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });
    
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error('Failed to complete authentication. Please try again.');
    }
    
    const data = await response.json();
    return validateTokenResponse(data, config.scopes);
  }
  
  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    provider: 'google-drive' | 'dropbox',
    refreshToken: string,
    clientId: string,
    tokenUrl: string
  ): Promise<TokenResponse> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      grant_type: 'refresh_token',
    });
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }
    
    const data = await response.json();
    
    // Refresh might not return a new refresh token, preserve the old one
    if (!data.refresh_token) {
      data.refresh_token = refreshToken;
    }
    
    return validateTokenResponse(data);
  }
  
  /**
   * Handle OAuth callback (for web platform)
   */
  handleOAuthCallback(): { code: string; state: string } | null {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (code && state) {
      // Clean URL
      cleanOAuthUrl();
      
      return { code, state };
    }
    
    return null;
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
