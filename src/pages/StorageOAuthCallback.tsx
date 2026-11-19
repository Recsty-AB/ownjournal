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
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';
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
    <main className="flex min-h-screen items-center justify-center bg-background p-4" style={{ paddingTop: 'calc(var(--safe-area-inset-top) + 1rem)' }}>
      <div className="w-full max-w-sm text-center">
        <img src={logo} alt="" className="mx-auto mb-8 h-12 w-12 object-contain dark:invert" />
        {status === 'processing' ? (
          <>
            <Loader2 aria-hidden="true" className="mx-auto mb-4 h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-2xl font-semibold text-foreground">Completing authentication...</p>
          </>
        ) : status === 'redirect-failed' ? (
          <>
            <p className="text-2xl font-semibold leading-snug text-foreground">This page completes mobile app authentication.</p>
            <p className="mt-3 text-sm text-muted-foreground">
              If you're on a mobile device, tap the button below to return to the app.
            </p>
            {deepLinkUrl && (
              <Button asChild className="mt-6 h-11 rounded-full px-6 bg-gradient-primary shadow-glow">
                <a href={deepLinkUrl}>
                  Open in App
                </a>
              </Button>
            )}
            <p className="mt-6 text-xs text-muted-foreground">
              If you're on a desktop browser, you can close this tab.
            </p>
          </>
        ) : (
          <>
            <AlertCircle aria-hidden="true" className="mx-auto mb-4 h-6 w-6 text-diagnostic-error" />
            <p className="text-2xl font-semibold text-foreground">Authentication Error</p>
            <p className="mt-3 text-sm text-foreground [overflow-wrap:anywhere]">{errorMessage}</p>
            <p className="mt-3 text-sm text-muted-foreground">Redirecting...</p>
          </>
        )}
      </div>
    </main>
  );
};

export default StorageOAuthCallback;
