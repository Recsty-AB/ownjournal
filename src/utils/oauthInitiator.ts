/**
 * OAuth initiator utility for onboarding wizard
 * Allows starting OAuth flow directly without going through Settings dialog
 */

import { oauthConfig, isGoogleDriveConfigured, isDropboxConfigured, getGoogleClientId } from '@/config/oauth';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateOAuthState,
  storePKCEVerifier,
  checkOAuthRateLimit,
  getOAuthRedirectUri,
} from '@/utils/oauth';

export type OAuthProvider = 'googleDrive' | 'dropbox';

interface InitiateOAuthResult {
  success: boolean;
  error?: string;
}

/**
 * Map wizard provider names to OAuth provider keys
 */
export function getOAuthProviderKey(wizardProvider: string): OAuthProvider | null {
  switch (wizardProvider) {
    case 'googleDrive':
      return 'googleDrive';
    case 'dropbox':
      return 'dropbox';
    default:
      return null;
  }
}

/**
 * Check if a provider uses OAuth (vs direct credentials like Nextcloud)
 */
export function isOAuthProvider(wizardProvider: string): boolean {
  return wizardProvider === 'googleDrive' || wizardProvider === 'dropbox';
}

/**
 * Initiate OAuth flow for a cloud provider
 * This redirects the user to the provider's OAuth page
 */
export async function initiateOAuth(provider: OAuthProvider): Promise<InitiateOAuthResult> {
  if (provider === 'googleDrive') {
    return initiateGoogleDriveOAuth();
  } else if (provider === 'dropbox') {
    return initiateDropboxOAuth();
  }
  
  return { success: false, error: 'Unknown provider' };
}

async function initiateGoogleDriveOAuth(): Promise<InitiateOAuthResult> {
  const clientId = getGoogleClientId();
  
  if (!isGoogleDriveConfigured()) {
    return { success: false, error: 'Google Drive not configured' };
  }

  // Rate limit check
  if (!checkOAuthRateLimit('google-drive')) {
    return { success: false, error: 'Too many attempts. Please wait.' };
  }

  try {
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateOAuthState('google-drive');
    
    // Store PKCE verifier and state
    storePKCEVerifier('google-drive', codeVerifier, state);
    
    const redirectUri = getOAuthRedirectUri('google-drive');
    
    // Build auth URL
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.appdata')}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${encodeURIComponent(state)}&` +
      `code_challenge=${encodeURIComponent(codeChallenge)}&` +
      `code_challenge_method=S256`;
    
    // Redirect to OAuth
    window.location.href = authUrl;
    
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start OAuth';
    return { success: false, error: message };
  }
}

async function initiateDropboxOAuth(): Promise<InitiateOAuthResult> {
  const clientId = oauthConfig.dropbox.clientId;
  
  if (!isDropboxConfigured()) {
    return { success: false, error: 'Dropbox not configured' };
  }

  // Rate limit check
  if (!checkOAuthRateLimit('dropbox')) {
    return { success: false, error: 'Too many attempts. Please wait.' };
  }

  try {
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateOAuthState('dropbox');
    
    // Store PKCE verifier and state
    storePKCEVerifier('dropbox', codeVerifier, state);
    
    const redirectUri = getOAuthRedirectUri('dropbox');
    
    // Build auth URL
    const authUrl = `https://www.dropbox.com/oauth2/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `token_access_type=offline&` +
      `state=${encodeURIComponent(state)}&` +
      `code_challenge=${encodeURIComponent(codeChallenge)}&` +
      `code_challenge_method=S256`;
    
    // Mark that Dropbox just connected to prevent immediate rate-limited sync
    sessionStorage.setItem('dropbox-just-connected', Date.now().toString());
    
    // Redirect to OAuth
    window.location.href = authUrl;
    
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start OAuth';
    return { success: false, error: message };
  }
}
