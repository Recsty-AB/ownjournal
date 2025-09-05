/**
 * Storage OAuth Callback Page
 * 
 * Handles OAuth redirects for cloud storage providers (Google Drive, Dropbox)
 * on native Android using HTTPS App Links.
 * 
 * This page:
 * 1. Extracts the authorization code and state from URL query params
 * 2. Stores them in sessionStorage for the provider component to process
 * 3. Redirects to the main app with Settings dialog open
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getProviderFromState } from '@/utils/oauth';

const StorageOAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      console.log('📥 [StorageCallback] Processing storage OAuth callback');
      console.log('   code:', code ? `${code.substring(0, 20)}...` : 'none');
      console.log('   state:', state || 'none');
      console.log('   error:', error || 'none');

      if (error) {
        console.error('❌ [StorageCallback] OAuth error:', error, errorDescription);
        setStatus('error');
        setErrorMessage(errorDescription || error);
        
        // Still redirect to main app after showing error briefly
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
        return;
      }

      if (!code || !state) {
        console.error('❌ [StorageCallback] Missing code or state');
        setStatus('error');
        setErrorMessage('Missing authorization code or state parameter');
        
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
        return;
      }

      // Extract provider from state
      const provider = getProviderFromState(state);
      console.log('📌 [StorageCallback] Provider from state:', provider);

      // Store OAuth params for the provider component to pick up
      // This allows the main app's provider components to complete the token exchange
      sessionStorage.setItem('storage-oauth-code', code);
      sessionStorage.setItem('storage-oauth-state', state);
      sessionStorage.setItem('storage-oauth-provider', provider || 'unknown');
      
      // Ensure settings dialog reopens
      sessionStorage.setItem('settings-dialog-open', 'true');

      console.log('✅ [StorageCallback] OAuth params stored, redirecting to main app');

      // Navigate to main app - the provider component will detect the stored params
      navigate('/', { replace: true });
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'processing' ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Completing authentication...</p>
          </>
        ) : (
          <>
            <p className="text-destructive font-medium">Authentication Error</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <p className="text-xs text-muted-foreground">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default StorageOAuthCallback;
