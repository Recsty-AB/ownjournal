import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Loader2, Info, ChevronDown, Star, ExternalLink } from "lucide-react";
import { ICloudIcon } from "./ProviderIcons";
import { useToast } from "@/hooks/use-toast";
import { ICloudService, NeedsAppleSignInError, CloudKitOriginError, iCloudDidSignIn, isCloudKitOriginRejected, getCloudKitRejectedOrigin } from "@/services/iCloudService";
import { CloudCredentialStorage, type ICloudCredentials } from "@/utils/cloudCredentialStorage";
import { SimpleModeCredentialStorage } from "@/utils/simpleModeCredentialStorage";
import { getEncryptionMode } from "@/utils/encryptionModeStorage";
import { usePlatform } from "@/hooks/usePlatform";
import { useTranslation } from "react-i18next";
import { connectionStateManager } from "@/services/connectionStateManager";
import { storageServiceV2 } from "@/services/storageServiceV2";

interface ICloudSyncProps {
  onConfigChange?: (isConnected: boolean, isOAuthComplete?: boolean) => void;
  masterKey: CryptoKey | null;
  onRequirePassword?: () => void;  // Pure state flow - no callback parameter
  isPrimary?: boolean;
}

export const ICloudSync = ({ onConfigChange, masterKey, onRequirePassword, isPrimary }: ICloudSyncProps) => {
  // Initialize isConnected from ConnectionStateManager only - single source of truth
  const [isConnected, setIsConnected] = useState(() => {
    return connectionStateManager.isConnected('iCloud');
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [service, setService] = useState<ICloudService | null>(null);
  const [isSetupExpanded, setIsSetupExpanded] = useState(false);
  const [isPrimaryLocal, setIsPrimaryLocal] = useState(false);
  
  // Configuration form state (pre-fill from env when set)
  const [apiToken, setApiToken] = useState(() => (import.meta.env.VITE_APPLE_CLOUDKIT_API_TOKEN as string) ?? '');
  const [containerId, setContainerId] = useState(() => (import.meta.env.VITE_APPLE_CLOUDKIT_CONTAINER_ID as string) ?? '');
  const [environment, setEnvironment] = useState<'development' | 'production'>(() =>
    (import.meta.env.VITE_APPLE_CLOUDKIT_ENVIRONMENT === 'production' ? 'production' : 'development')
  );
  
  const { toast } = useToast();
  const { platform, isDesktop, isMobile } = usePlatform();
  const { t } = useTranslation();
  
  // Check if platform supports iCloud
  // iCloud is supported on iOS, macOS, and web browsers, but NOT on Android
  const isPlatformSupported = platform !== 'capacitor-android';
  
  // Track if credentials have been loaded to prevent duplicate calls
  const credentialsLoadedRef = useRef(false);
  
  // Track pending connection for pure state flow (auto-retry when masterKey becomes available)
  const [pendingConnection, setPendingConnection] = useState(false);
  const pendingCredentialsRef = useRef<ICloudCredentials | null>(null);

  // Apple ID sign-in flow state
  const [needsAppleSignIn, setNeedsAppleSignIn] = useState(false);
  // True once the user has clicked our "Sign in with Apple ID" button (shows Continue button).
  const [hasAttemptedSignIn, setHasAttemptedSignIn] = useState(false);
  const pendingSignInRef = useRef<{ container: any; credentials: ICloudCredentials } | null>(null);

  // Use ref to track isConnected to avoid stale closure in subscription
  const isConnectedRef = useRef(isConnected);
  // Ref to guard against duplicate auto-complete attempts (visibilitychange can fire rapidly).
  const isAutoCompletingRef = useRef(false);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Listen for password dialog cancellation to clear pending connection state
  useEffect(() => {
    const handlePasswordCancelled = () => {
      if (import.meta.env.DEV) console.log('🔄 [iCloud] Password dialog cancelled - clearing pending state');
      
      // Clear pending connection state
      setPendingConnection(false);
      pendingCredentialsRef.current = null;
      
      // Reset connecting state
      setIsConnecting(false);
      
      // Notify parent that connection was cancelled
      onConfigChange?.(false);
    };
    
    window.addEventListener('password-dialog-cancelled', handlePasswordCancelled);
    return () => window.removeEventListener('password-dialog-cancelled', handlePasswordCancelled);
  }, [onConfigChange]);

  // Subscribe to ConnectionStateManager for external disconnect events and primary status
  useEffect(() => {
    const handleManagerUpdate = () => {
      const managerConnected = connectionStateManager.isConnected('iCloud');
      const primary = connectionStateManager.isPrimaryProvider('iCloud');
      setIsPrimaryLocal(primary);
      
      // Use ref to avoid stale closure
      const currentlyConnected = isConnectedRef.current;
      
      // If manager says disconnected but we thought we were connected, update state
      if (!managerConnected && currentlyConnected) {
        if (import.meta.env.DEV) console.log('🔔 [iCloud] External disconnect detected via manager');
        setIsConnected(false);
        credentialsLoadedRef.current = false;
      } else if (managerConnected && !currentlyConnected) {
        setIsConnected(true);
      }
    };
    
    // Initial check
    handleManagerUpdate();
    
    const unsubscribe = connectionStateManager.subscribe(handleManagerUpdate);
    return () => unsubscribe();
  }, []); // Empty deps - use ref for current state

  // Auto-retry connection when masterKey becomes available (pure state flow)
  useEffect(() => {
    if (pendingConnection && masterKey && pendingCredentialsRef.current) {
      if (import.meta.env.DEV) console.log('🔄 [iCloud] Master key available, retrying pending connection');
      setPendingConnection(false);
      handleConnect(pendingCredentialsRef.current);
      pendingCredentialsRef.current = null;
    }
  }, [masterKey, pendingConnection]);

  // Listen for encryption-initialized event to process pending connections
  useEffect(() => {
    const handleEncryptionInitialized = async (event: CustomEvent) => {
      if (pendingConnection && event.detail.hasMasterKey && pendingCredentialsRef.current) {
        if (import.meta.env.DEV) console.log('🔑 [iCloud] Encryption initialized event - processing pending connection');
        const key = storageServiceV2.getMasterKey();
        if (key) {
          setPendingConnection(false);
          handleConnect(pendingCredentialsRef.current);
          pendingCredentialsRef.current = null;
        }
      }
    };
    
    window.addEventListener('encryption-initialized', handleEncryptionInitialized as EventListener);
    return () => window.removeEventListener('encryption-initialized', handleEncryptionInitialized as EventListener);
  }, [pendingConnection]);

  // When the Apple sign-in tab is open and the user returns to our tab, automatically
  // retry setUpAuth() — it succeeds once the sign-in cookie is set.
  useEffect(() => {
    if (!needsAppleSignIn) return;

    const tryAutoComplete = async () => {
      if (!pendingSignInRef.current || isAutoCompletingRef.current) return;
      isAutoCompletingRef.current = true;
      try {
        const { container, credentials: creds } = pendingSignInRef.current;
        const userIdentity = await container.setUpAuth();
        if (userIdentity && pendingSignInRef.current) {
          pendingSignInRef.current = null;
          setNeedsAppleSignIn(false);
          setHasAttemptedSignIn(false);
          iCloudDidSignIn(container);
          const newService = new ICloudService();
          setIsConnecting(true);
          await newService.connect(creds, masterKey);
          finishSuccessfulConnect(newService);
        }
      } catch {
        // Silent – user can manually click "I've signed in – Continue"
      } finally {
        isAutoCompletingRef.current = false;
        setIsConnecting(false);
      }
    };

    const onVisible = () => { if (document.visibilityState === 'visible') tryAutoComplete(); };
    const onFocus = () => tryAutoComplete();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAppleSignIn, masterKey]);

  useEffect(() => {
    // CRITICAL: Check ConnectionStateManager first - it's the single source of truth
    if (connectionStateManager.isConnected('iCloud')) {
      if (import.meta.env.DEV) console.log('🔗 [iCloud] Already connected via ConnectionStateManager, skipping credential load');
      setIsConnected(true);
      credentialsLoadedRef.current = true;
      // FIX: Do NOT call onConfigChange here - this is a remount, not a new connection
      // The parent already subscribes to ConnectionStateManager for state updates
      return;
    }
    
    // CRITICAL: Skip if explicitly disabled (user previously disconnected)
    if (connectionStateManager.isExplicitlyDisabled('iCloud')) {
      if (import.meta.env.DEV) console.log('🚫 [iCloud] Explicitly disabled, skipping credential load');
      return;
    }
    
    // Skip if already loaded AND still connected
    // IMPORTANT: If masterKey just became available, allow retry even if previously loaded
    if (credentialsLoadedRef.current && isConnected) {
      return;
    }

    // If this origin was already rejected by CloudKit (421), show the cached error
    // immediately without making any further network calls.
    const rejectedOrigin = getCloudKitRejectedOrigin();
    if (rejectedOrigin) {
      const msg = `${t('providers.icloud.originNotAllowed', { origin: rejectedOrigin })} ${t('providers.icloud.connectionTestFailed421Hint')}`;
      setConnectionError(msg);
      return;
    }

    // Load existing credentials on mount
    loadExistingCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterKey]);

  // Window binding is now handled by ConnectionStateManager
  // The manager handles registration/unregistration automatically

  const loadExistingCredentials = async () => {
    try {
      const encryptionMode = getEncryptionMode();
      let credentials: ICloudCredentials | null = null;

      if (encryptionMode === 'e2e' && masterKey) {
        // E2E mode: Load encrypted credentials
        credentials = await CloudCredentialStorage.loadCredentials<ICloudCredentials>('icloud', masterKey);
      } else if (encryptionMode === 'simple') {
        // Simple mode: Load plain text credentials
        credentials = SimpleModeCredentialStorage.loadICloudCredentials();
      }

      if (credentials) {
        setApiToken(credentials.apiToken);
        setContainerId(credentials.containerId);
        setEnvironment(credentials.environment);
        
        // Auto-connect with existing credentials
        credentialsLoadedRef.current = true;
        await handleConnect(credentials);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to load iCloud credentials:', error);
    }
  };

  // Extracted so it can be called from both handleConnect and handleContinueAfterSignIn.
  const finishSuccessfulConnect = (newService: ICloudService) => {
    setService(newService);
    setIsConnected(true);
    connectionStateManager.registerProvider('iCloud', newService);
    storageServiceV2.enableSync();
    onConfigChange?.(true, true);
    if (import.meta.env.DEV) console.log('📥 [iCloud] Dispatching trigger-sync to reload entries');
    queueMicrotask(() => { window.dispatchEvent(new CustomEvent('trigger-sync')); });
    const isPrimary = connectionStateManager.isPrimaryProvider('iCloud');
    toast({
      title: t('providers.icloud.connectedSuccess'),
      description: isPrimary ? t('providers.icloud.connectedSuccessDesc') : t('storage.connectedAsBackup'),
    });
  };

  /**
   * Called when the user clicks "Continue after signing in".
   * Re-checks setUpAuth() to see if the Apple sign-in popup completed,
   * as a fallback for whenUserSignsIn() not resolving automatically.
   */
  const handleContinueAfterSignIn = async () => {
    if (!pendingSignInRef.current) return;
    setIsConnecting(true);
    try {
      const { container, credentials: creds } = pendingSignInRef.current;
      const userIdentity = await container.setUpAuth();
      if (userIdentity) {
        pendingSignInRef.current = null;
        setNeedsAppleSignIn(false);
        iCloudDidSignIn(container);
        const newService = new ICloudService();
        await newService.connect(creds, masterKey);
        finishSuccessfulConnect(newService);
      } else {
        toast({
          title: t('providers.icloud.signInRequired'),
          description: t('providers.icloud.signInRequiredDesc'),
          variant: 'destructive',
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('iCloud post-sign-in connect error:', err);
      const msg = err instanceof Error ? err.message : t('providers.icloud.connectionFailed');
      setConnectionError(msg);
      toast({ title: t('storage.connectionFailed'), description: msg, variant: 'destructive' });
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Try to open the Apple sign-in popup by finding CloudKit's rendered link in #apple-sign-in-button.
   * Optionally waits for the link to appear via MutationObserver (e.g. after CloudKit async render).
   * Returns true if the popup was opened (or we showed popup-blocked toast); false if no link found.
   */
  const tryOpenSignInPopup = (options?: { waitForLink?: boolean; timeoutMs?: number }): Promise<boolean> => {
    const area = document.getElementById('apple-sign-in-button');
    const attemptOpen = (): boolean => {
      if (!area) return false;
      const link = area.querySelector<HTMLAnchorElement>('a');
      if (link?.href) {
        const w = 600, h = 700;
        const left = Math.round(window.screenLeft + (window.outerWidth - w) / 2);
        const top = Math.round(window.screenTop + (window.outerHeight - h) / 2);
        const popup = window.open(link.href, 'apple-cloudkit-signin',
          `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
        if (popup) return true;
        toast({
          title: t('storage.connectionError'),
          description: t('providers.icloud.popupBlocked'),
          variant: 'destructive',
        });
        return true;
      }
      // CloudKit JS renders a <div class="apple-auth-button"> (not an <a> or <button>).
      const btn = area.querySelector<HTMLElement>('.apple-auth-button, button, a');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    };

    if (attemptOpen()) return Promise.resolve(true);
    if (!options?.waitForLink || !area) return Promise.resolve(false);

    const timeoutMs = options.timeoutMs ?? 3000;
    return new Promise<boolean>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        observer.disconnect();
        resolve(attemptOpen());
      }, timeoutMs);
      const observer = new MutationObserver(() => {
        if (attemptOpen()) {
          observer.disconnect();
          window.clearTimeout(timeoutId);
          resolve(true);
        }
      });
      observer.observe(area, { childList: true, subtree: true });
    });
  };

  const handleSignInClick = () => {
    setHasAttemptedSignIn(true);
    tryOpenSignInPopup({ waitForLink: true, timeoutMs: 3000 }).then((opened) => {
      if (!opened) {
        if (import.meta.env.DEV) console.warn('[iCloud] Apple sign-in link not found in #apple-sign-in-button');
        toast({
          title: t('storage.connectionError'),
          description: t('providers.icloud.signInLinkNotReady'),
          variant: 'destructive',
        });
      }
    });
  };

  const handleConnect = async (existingCredentials?: ICloudCredentials) => {
    // Guard: if this origin is already known-rejected by CloudKit, show the cached
    // error immediately without any network call. To retry after fixing the
    // CloudKit Allowed Origins config, the user refreshes the page (ensureConnections
    // auto-connects with _originRejected reset to null).
    if (isCloudKitOriginRejected()) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setConnectionError(`${t('providers.icloud.originNotAllowed', { origin })} ${t('providers.icloud.connectionTestFailed421Hint')}`);
      return;
    }

    const encryptionMode = getEncryptionMode();

    // Effective values: form state with env fallback (so env-configured builds work without user input)
    const effectiveToken = (apiToken.trim() || (import.meta.env.VITE_APPLE_CLOUDKIT_API_TOKEN as string) || '').trim();
    const effectiveContainerId = (containerId.trim() || (import.meta.env.VITE_APPLE_CLOUDKIT_CONTAINER_ID as string) || '').trim();
    const effectiveEnvironment = (environment || (import.meta.env.VITE_APPLE_CLOUDKIT_ENVIRONMENT === 'production' ? 'production' : 'development')) as 'development' | 'production';
    const buildCredentials = (): ICloudCredentials => ({
      provider: 'icloud',
      apiToken: effectiveToken,
      containerId: effectiveContainerId,
      environment: effectiveEnvironment,
    });

    // Check if password is needed for E2E mode - pure state flow (no callback)
    if (encryptionMode === 'e2e' && !masterKey) {
      // CRITICAL: Check if initialization is already in progress
      // If so, just wait - don't request password again
      if (storageServiceV2.isInitializationInProgress) {
        if (import.meta.env.DEV) console.log('🔄 [iCloud] Initialization in progress - waiting');
        pendingCredentialsRef.current = existingCredentials || buildCredentials();
        setPendingConnection(true);
        return;
      }

      // Also check if master key already exists in storage service
      const existingKey = storageServiceV2.getMasterKey();
      if (existingKey) {
        if (import.meta.env.DEV) console.log('🔑 [iCloud] Master key exists in storageService - proceeding');
        // Continue with existing key
      } else {
        if (import.meta.env.DEV) console.log('🔐 [iCloud] Master key required for E2E mode');
        // Store credentials for retry when masterKey becomes available
        pendingCredentialsRef.current = existingCredentials || buildCredentials();
        setPendingConnection(true);

        // CRITICAL: Use centralized password request (checks if actually needed first)
        import('@/services/encryptionStateManager').then(({ encryptionStateManager }) => {
          encryptionStateManager.requestPasswordIfNeeded('ICloudSync-handleConnect');
        });
        onRequirePassword?.();
        return;
      }
    }

    setIsConnecting(true);
    setConnectionError(null);

    // Build credentials before try block so the Apple sign-in callback can capture them.
    const credentials: ICloudCredentials = existingCredentials || buildCredentials();

    try {
      if (!credentials.apiToken || !credentials.containerId) {
        throw new Error(t('providers.icloud.credentialsRequired'));
      }

      const newService = new ICloudService();
      await newService.connect(credentials, masterKey);
      finishSuccessfulConnect(newService);
      setIsConnecting(false);
    } catch (error) {
      if (error instanceof CloudKitOriginError) {
        const msg = t('providers.icloud.originNotAllowed', { origin: error.origin });
        setConnectionError(`${msg} ${t('providers.icloud.connectionTestFailed421Hint')}`);
        // No toast — the error is already visible in the card alert directly below the button.
        setIsConnecting(false);
        return;
      }
      if (error instanceof NeedsAppleSignInError) {
        if (pendingSignInRef.current) return;
        pendingSignInRef.current = { container: error.container, credentials };

        error.container.whenUserSignsIn().then(async () => {
          if (!pendingSignInRef.current) return;
          const { container, credentials: creds } = pendingSignInRef.current;
          pendingSignInRef.current = null;
          setNeedsAppleSignIn(false);
          setHasAttemptedSignIn(false);
          setIsConnecting(true);
          try {
            iCloudDidSignIn(container);
            const newService = new ICloudService();
            await newService.connect(creds, masterKey);
            finishSuccessfulConnect(newService);
          } catch (err) {
            if (import.meta.env.DEV) console.error('iCloud post-sign-in connect error:', err);
            const msg = err instanceof Error ? err.message : t('providers.icloud.connectionFailed');
            setConnectionError(msg);
            toast({ title: t('storage.connectionFailed'), description: msg, variant: 'destructive' });
          } finally {
            setIsConnecting(false);
          }
        }).catch((err: any) => {
          if (import.meta.env.DEV) console.error('Apple ID sign-in failed or cancelled:', err);
          pendingSignInRef.current = null;
          setNeedsAppleSignIn(false);
          setHasAttemptedSignIn(false);
          setIsConnecting(false);
        });

        // Always show the sign-in UI so the visibilitychange/focus auto-complete listener
        // is active. This guarantees we can detect sign-in completion even if
        // whenUserSignsIn() never resolves (e.g. sign-in opens as tab, not popup).
        setNeedsAppleSignIn(true);
        setIsConnecting(false);

        // Try to auto-open the popup as a UX optimization. If it opens, the user signs in
        // directly; if not, they use the fallback "Sign in" button in the needsAppleSignIn UI.
        window.setTimeout(() => {
          tryOpenSignInPopup({ waitForLink: true, timeoutMs: 3000 }).then((opened) => {
            if (opened) {
              // Popup opened — show the Continue button right away as a fallback.
              setHasAttemptedSignIn(true);
            } else {
              toast({
                title: t('storage.connectionError'),
                description: t('providers.icloud.signInLinkNotReady'),
                variant: 'destructive',
              });
            }
          });
        }, 200);
        return;
      }

      if (import.meta.env.DEV) console.error('iCloud connection error:', error);
      const errorMessage = error instanceof Error ? error.message : t('providers.icloud.connectionFailed');
      setConnectionError(errorMessage);
      toast({
        title: t('storage.connectionFailed'),
        description: errorMessage,
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (import.meta.env.DEV) {
      if (import.meta.env.DEV) console.log('🔌 Disconnecting iCloud - clearing all credentials');
    }
    
    // CRITICAL STEP 1: Disable ALL sync operations BEFORE anything else
    // This prevents auto-sync from re-uploading entries during disconnect
    storageServiceV2.disableSync();
    
    // CRITICAL STEP 2: Clear pending operations to prevent stale uploads on reconnect
    await storageServiceV2.clearLocalSyncState();
    
    // STEP 3: Unregister from ConnectionStateManager FIRST (this also disables auto-reconnect)
    connectionStateManager.unregisterProvider('iCloud');
    
    // STEP 4: Check remaining providers AFTER unregistering to get accurate count
    const remainingProviders = connectionStateManager.getConnectedProviderNames();
    
    // CRITICAL STEP 5: Only reset encryption state if NO providers remain
    // Resetting when other providers are connected causes master key loss and decryption failures
    if (remainingProviders.length === 0) {
      storageServiceV2.resetEncryptionState(false, false, 'disconnect');
      if (import.meta.env.DEV) console.log('🔐 Reset encryption state - no providers remaining');
    } else {
      if (import.meta.env.DEV) console.log('🔐 Keeping encryption state - other providers still connected:', remainingProviders);
    }
    
    // STEP 5: Disconnect service
    if (service) {
      await service.disconnect();
    }
    
    // STEP 6: Clear credentials from BOTH storage systems using force methods
    CloudCredentialStorage.forceRemoveCredentials('icloud');     // E2E mode - force remove
    SimpleModeCredentialStorage.clearICloudCredentials();        // Simple mode
    
    // Verify credentials are actually cleared
    if (import.meta.env.DEV) {
      const e2eStillExists = CloudCredentialStorage.hasCredentials('icloud');
      const simpleStillExists = SimpleModeCredentialStorage.hasICloudCredentials();
      if (e2eStillExists || simpleStillExists) {
        if (import.meta.env.DEV) console.error('❌ CRITICAL: Failed to clear credentials!', { e2eStillExists, simpleStillExists });
      } else {
        if (import.meta.env.DEV) console.log('✅ Credentials successfully cleared from both storage systems');
      }
    }
    
    // STEP 7: Update local UI state
    setService(null);
    setIsConnected(false);
    credentialsLoadedRef.current = false;
    setApiToken("");
    setContainerId("");
    setEnvironment('development');
    onConfigChange?.(false);
    
    // STEP 8: Re-enable sync ONLY if another provider is still connected
    // Note: remainingProviders already computed after unregister above
    if (remainingProviders.length > 0) {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log('✅ Re-enabling sync - other providers still connected:', remainingProviders);
      }
      storageServiceV2.enableSync();
    } else {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log('ℹ️ Sync remains disabled - no other providers connected');
      }
    }

    toast({
      title: t('providers.icloud.disconnected'),
      description: t('providers.icloud.disconnectedDesc'),
    });
  };

  // iCloud is not supported on Android — hide completely
  if (!isPlatformSupported) {
    return null;
  }

  return (
    <Card className="p-6">
      {/* Header - stack on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        {/* Provider info with wrapping badges */}
        <div className="flex flex-wrap items-center gap-2">
          <ICloudIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold whitespace-nowrap">{t('storage.icloud')}</h3>
          {isConnected && (
            <>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="w-3 h-3 mr-1" />
                {t('storage.connected')}
              </Badge>
              {isPrimaryLocal && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="default"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Star className="w-3 h-3 mr-1" />
                      {t('storage.activeSync')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('storage.activeSyncDesc')}
                  </TooltipContent>
                </Tooltip>
              )}
              {!isPrimaryLocal && connectionStateManager.getConnectedProviderNames().length > 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="bg-muted text-muted-foreground border-dashed"
                    >
                      {t('storage.inactiveSync')}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('storage.inactiveSyncDesc')}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
        {/* Disconnect button in header - matches Google Drive/Dropbox */}
        {isConnected && (
          <Button variant="outline" size="sm" onClick={handleDisconnect} className="self-start sm:self-auto">
            {t('storage.disconnect')}
          </Button>
        )}
      </div>

      {isConnected ? (
        <p className="text-sm text-muted-foreground">
          {isPrimaryLocal
            ? t('storage.icloudSyncActive')
            : t('storage.providerConnectedInactive')
          }
        </p>
      ) : (() => {
        // App pre-configured by developer via env vars → simple one-click connect for users
        const isAppConfigured = !!(
          import.meta.env.VITE_APPLE_CLOUDKIT_CONTAINER_ID &&
          import.meta.env.VITE_APPLE_CLOUDKIT_API_TOKEN
        );

        if (isAppConfigured) {
          // Fallback only when the sign-in popup could not open (e.g. link not ready, popup blocked).
          if (needsAppleSignIn) {
            return (
              <div className="space-y-4">
                <div
                  id="apple-sign-in-button"
                  className="fixed -left-[9999px] -top-[9999px] w-px h-px overflow-hidden"
                  aria-hidden
                />
                <p className="text-sm text-muted-foreground">
                  {t('providers.icloud.signInLinkNotReady')}
                </p>
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleSignInClick}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {t('providers.icloud.signInWithAppleButton')}
                </Button>
                {hasAttemptedSignIn && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleContinueAfterSignIn}
                    disabled={isConnecting}
                  >
                    {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('providers.icloud.continueAfterSignIn')}
                  </Button>
                )}
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground underline"
                    onClick={() => {
                      pendingSignInRef.current = null;
                      setNeedsAppleSignIn(false);
                      setHasAttemptedSignIn(false);
                      setConnectionError(null);
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {/* CloudKit JS needs this element to exist before first connect so it can render the sign-in link. */}
              <div
                id="apple-sign-in-button"
                className="fixed -left-[9999px] -top-[9999px] w-px h-px overflow-hidden"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">
                {t('providers.icloud.syncDesc')}
              </p>

              {getEncryptionMode() === 'simple' && (
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-400 text-xs">
                    <strong>{t('providers.icloud.simpleMode')}</strong> {t('providers.icloud.simpleModeDesc')}
                  </AlertDescription>
                </Alert>
              )}

              {connectionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={() => handleConnect()}
                disabled={isConnecting || isCloudKitOriginRejected()}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                {t('providers.icloud.connectButton')}
              </Button>
            </div>
          );
        }

        // No env vars — developer/self-hosting setup form
        return (
          <Collapsible open={isSetupExpanded} onOpenChange={setIsSetupExpanded}>
            <CollapsibleTrigger className="w-full">
              <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950/20 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors">
                <div className="flex items-start justify-between w-full">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <AlertDescription className="text-sm text-blue-800 dark:text-blue-400 text-left">
                      <strong>{t('providers.icloud.devSetupRequired')}</strong>
                      <p className="mt-1">{t('providers.icloud.devSetupRequiredDesc')}</p>
                    </AlertDescription>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-blue-600 transition-transform ${isSetupExpanded ? 'rotate-180' : ''}`} />
                </div>
              </Alert>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="space-y-4">
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800 dark:text-blue-400">
                    {t('providers.icloud.requiresDevAccount')}
                    <a
                      href="https://developer.apple.com/documentation/cloudkitjs/cloudkit/configuring_cloudkit_js"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline ml-1"
                    >
                      {t('common.learnMore')}
                    </a>
                  </AlertDescription>
                </Alert>

                {getEncryptionMode() === 'simple' && (
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-400 text-xs">
                      <strong>{t('providers.icloud.simpleMode')}</strong> {t('providers.icloud.simpleModeDesc')}
                    </AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="containerId">{t('providers.icloud.containerId')}</Label>
                  <Input
                    id="containerId"
                    value={containerId}
                    onChange={(e) => setContainerId(e.target.value)}
                    placeholder={t('providers.icloud.containerIdPlaceholder')}
                    disabled={isConnecting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('providers.icloud.containerIdDesc')}
                  </p>
                </div>

                <div>
                  <Label htmlFor="apiToken">{t('providers.icloud.apiToken')}</Label>
                  <Input
                    id="apiToken"
                    type="password"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder={t('providers.icloud.apiTokenPlaceholder')}
                    disabled={isConnecting}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('providers.icloud.apiTokenDesc')}
                  </p>
                </div>

                <div>
                  <Label htmlFor="environment">{t('providers.icloud.environmentLabel')}</Label>
                  <select
                    id="environment"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value as 'development' | 'production')}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    disabled={isConnecting}
                  >
                    <option value="development">{t('providers.icloud.development')}</option>
                    <option value="production">{t('providers.icloud.production')}</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('providers.icloud.environmentDesc')}
                  </p>
                </div>

                {connectionError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{connectionError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={() => handleConnect()}
                  disabled={isConnecting || !apiToken.trim() || !containerId.trim() || isCloudKitOriginRejected()}
                  className="w-full"
                >
                  {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('providers.icloud.connectButton')}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })()}
    </Card>
  );
};
