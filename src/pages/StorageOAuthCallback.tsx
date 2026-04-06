/**
 * Storage OAuth Callback Page
 *
 * Handles OAuth redirects for cloud storage providers (Google Drive, Dropbox)
 * on native platforms (Android/iOS) using HTTPS App Links.
 *
 * On Android: App Links intercept this URL and route directly to the native app.
 * On iOS: SFSafariViewController loads this page, which then redirects to the
 *   custom URL scheme to bounce back to the native app.
 * On Web: This route is not used (web OAuth redirects to window.location.origin).
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getProviderFromState } from '@/utils/oauth';
import { buildDeepLink } from '@/config/app';

const StorageOAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'redirect-failed' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  const [deepLinkUrl, setDeepLinkUrl] = useState('');

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      console.log('[StorageCallback] Processing storage OAuth callback');

      // This page is only reached from native OAuth flows (web uses origin redirect).
      // Redirect to custom scheme so iOS routes back to the native app.
      // On iOS, SFSafariViewController intercepts custom scheme URLs and triggers
      // the Capacitor App.addListener('appUrlOpen') handler in the native app.
      // Note: index.html has a faster pre-React trampoline, but this is a fallback.
      const isNativeApp = (window as any).Capacitor?.isNativePlatform?.() === true;
      if (!isNativeApp) {
        const deepLink = buildDeepLink('/storage-callback', window.location.search);
        setDeepLinkUrl(deepLink);
        console.log('[StorageCallback] Redirecting to native app via deep link:', deepLink);
        window.location.replace(deepLink);

        // If the scheme redirect didn't navigate away (desktop browser, or no app installed),
        // show a fallback UI after a short delay instead of a blank screen.
        timeouts.push(setTimeout(() => {
          setStatus('redirect-failed');
        }, 1500));
        return;
      }

      if (error) {
        console.error('[StorageCallback] OAuth error:', error, errorDescription);
        setStatus('error');
        setErrorMessage(errorDescription || error);

        timeouts.push(setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000));
        return;
      }

      if (!code || !state) {
        console.error('[StorageCallback] Missing code or state');
        setStatus('error');
        setErrorMessage('Missing authorization code or state parameter');

        timeouts.push(setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000));
        return;
      }

      // Extract provider from state
      const provider = getProviderFromState(state);

      // Store OAuth params for the provider component to pick up
      sessionStorage.setItem('storage-oauth-code', code);
      sessionStorage.setItem('storage-oauth-state', state);
      sessionStorage.setItem('storage-oauth-provider', provider || 'unknown');
      sessionStorage.setItem('settings-dialog-open', 'true');

      console.log('[StorageCallback] OAuth params stored, redirecting to main app');
      navigate('/', { replace: true });
    };

    processCallback();

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm px-4">
        {status === 'processing' ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Completing authentication...</p>
          </>
        ) : status === 'redirect-failed' ? (
          <>
            <p className="font-medium">This page completes mobile app authentication.</p>
            <p className="text-sm text-muted-foreground">
              If you're on a mobile device, tap the button below to return to the app.
            </p>
            {deepLinkUrl && (
              <a
                href={deepLinkUrl}
                className="inline-block mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
              >
                Open in App
              </a>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              If you're on a desktop browser, you can close this tab.
            </p>
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
