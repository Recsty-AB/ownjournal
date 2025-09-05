import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, ExternalLink, AlertCircle, Star } from "lucide-react";
import { DropboxIcon } from "./ProviderIcons";
import { useToast } from "@/hooks/use-toast";
import { CloudCredentialStorage, type DropboxCredentials } from "@/utils/cloudCredentialStorage";
import { SimpleModeCredentialStorage } from "@/utils/simpleModeCredentialStorage";
import { DropboxService } from "@/services/dropboxService";
import { connectionStateManager } from "@/services/connectionStateManager";
import { storageServiceV2 } from "@/services/storageServiceV2";
import { cloudStorageService } from "@/services/cloudStorageService";
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
  getOAuthRedirectUri,
  markOAuthCodeProcessed,
  isOAuthCodeProcessed
} from "@/utils/oauth";
import { getEncryptionMode, isE2EEnabled } from "@/utils/encryptionModeStorage";
import { useTranslation } from "react-i18next";
import { oauthConfig, isDropboxConfigured } from "@/config/oauth";
import { isSigningOut } from "@/utils/signOutState";

interface DropboxSyncProps {
  onConfigChange?: (isConnected: boolean, isOAuthComplete?: boolean) => void;
  masterKey: CryptoKey | null;
  onRequirePassword?: (retryAction?: () => void) => void;
  isPrimary?: boolean;
}

export const DropboxSync = ({ onConfigChange, masterKey, onRequirePassword, isPrimary }: DropboxSyncProps) => {
  // Initialize isConnected from ConnectionStateManager only - single source of truth
  const [isConnected, setIsConnected] = useState(() => {
    return connectionStateManager.isConnected('Dropbox');
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [service] = useState(() => new DropboxService());
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isPrimaryLocal, setIsPrimaryLocal] = useState(false);
  const [pendingConnection, setPendingConnection] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Ref to prevent double OAuth processing
  const processingOAuthRef = useRef(false);
  const processedCodesRef = useRef<Set<string>>(new Set());

  // Track if credentials have been loaded to prevent duplicate calls
  const credentialsLoadedRef = useRef(false);
  
  // Track OAuth call count for debugging
  const oauthCallCountRef = useRef(0);

  // Use ref to track isConnected to avoid stale closure in subscription
  const isConnectedRef = useRef(isConnected);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Subscribe to ConnectionStateManager for external disconnect events and primary status
  useEffect(() => {
    const handleManagerUpdate = () => {
      const managerConnected = connectionStateManager.isConnected('Dropbox');
      const primary = connectionStateManager.isPrimaryProvider('Dropbox');
      setIsPrimaryLocal(primary);
      
      // Use ref to avoid stale closure
      const currentlyConnected = isConnectedRef.current;
      
      // If manager says disconnected but we thought we were connected, update state
      if (!managerConnected && currentlyConnected) {
        if (import.meta.env.DEV) console.log('🔔 [Dropbox] External disconnect detected via manager');
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

  // Listen for password dialog cancellation to clear pending OAuth state
  useEffect(() => {
    const handlePasswordCancelled = () => {
      if (import.meta.env.DEV) console.log('🔄 [Dropbox] Password dialog cancelled - clearing pending state');
      
      // Clear pending connection state
      setPendingConnection(false);
      
      // Clear pending OAuth params to allow fresh OAuth attempt
      setPendingOAuthParams(null);
      
      // Clear the pending OAuth marker
      sessionStorage.removeItem('pending-oauth-provider');
      
      // Reset processing refs to allow new OAuth flow
      processingOAuthRef.current = false;
      
      // Reset connecting state
      setIsConnecting(false);
      
      // Notify parent that connection was cancelled
      onConfigChange?.(false);
    };
    
    window.addEventListener('password-dialog-cancelled', handlePasswordCancelled);
    return () => window.removeEventListener('password-dialog-cancelled', handlePasswordCancelled);
  }, [onConfigChange]);

  // Auto-retry connection when masterKey becomes available after password entry
  useEffect(() => {
    if (masterKey && pendingConnection && !isConnecting) {
      console.log('✅ [Dropbox] Master key now available, auto-retrying connection');
      setPendingConnection(false);
      // Small delay to ensure React has fully updated
      setTimeout(() => {
        handleConnect();
      }, 100);
    }
  }, [masterKey, pendingConnection, isConnecting]);

  // Listen for encryption-initialized event to process pending connections
  useEffect(() => {
    const handleEncryptionInitialized = (event: CustomEvent) => {
      if (pendingConnection && event.detail.hasMasterKey && !isConnecting) {
        console.log('🔑 [Dropbox] Encryption initialized - processing pending connection');
        const key = storageServiceV2.getMasterKey();
        if (key) {
          setPendingConnection(false);
          setTimeout(() => handleConnect(), 100);
        }
      }
    };
    
    window.addEventListener('encryption-initialized', handleEncryptionInitialized as EventListener);
    return () => window.removeEventListener('encryption-initialized', handleEncryptionInitialized as EventListener);
  }, [pendingConnection, isConnecting]);

  // Load credentials from storage (E2E encrypted or Simple Mode)
  useEffect(() => {
    const loadCredentials = async () => {
      // DEBUG: Log credential loading state for debugging persistence issues
      if (import.meta.env.DEV) {
        console.log('📦 [Dropbox] loadCredentials called', {
          isConnectedViaManager: connectionStateManager.isConnected('Dropbox'),
          isExplicitlyDisabled: connectionStateManager.isExplicitlyDisabled('Dropbox'),
          encryptionMode: getEncryptionMode(),
          hasMasterKey: !!masterKey,
          hasSimpleModeCredentials: !!SimpleModeCredentialStorage.loadDropboxCredentials(),
          hasE2ECredentials: CloudCredentialStorage.hasCredentials('dropbox'),
        });
      }
      
      // CRITICAL: Check ConnectionStateManager first - it's the single source of truth
      if (connectionStateManager.isConnected('Dropbox')) {
        if (import.meta.env.DEV) console.log('🔗 [Dropbox] Already connected via ConnectionStateManager, skipping credential load');
        setIsConnected(true);
        credentialsLoadedRef.current = true;
        // FIX: Do NOT call onConfigChange here - this is a remount, not a new connection
        // The parent already subscribes to ConnectionStateManager for state updates
        return;
      }
      
      // CRITICAL: Skip if explicitly disabled (user previously disconnected)
      if (connectionStateManager.isExplicitlyDisabled('Dropbox')) {
        if (import.meta.env.DEV) console.log('🚫 [Dropbox] Explicitly disabled, skipping credential load');
        return;
      }
      
      // Skip if already loaded AND still connected
      // IMPORTANT: If masterKey just became available, allow retry even if previously loaded
      if (credentialsLoadedRef.current && isConnected) {
        return;
      }
      
      let creds: DropboxCredentials | null = null;
      
      // Try E2E mode first if masterKey available
      if (masterKey && isE2EEnabled()) {
        creds = await CloudCredentialStorage.loadCredentials<DropboxCredentials>(
          'dropbox',
          masterKey
        );
      }
      
      // If no E2E creds and in Simple Mode, try Simple Mode storage
      if (!creds && !isE2EEnabled()) {
        creds = SimpleModeCredentialStorage.loadDropboxCredentials();
      }
      
      if (creds) {
        // Check if token expires soon
        const expiresIn = creds.expiresAt - Date.now();
        if (expiresIn < 5 * 60 * 1000) {
          setNeedsRefresh(true);
        }
        
        try {
          await service.connect(creds, masterKey);
          
          // CRITICAL: Validate connection actually works
          const isValid = await service.validateConnection();
          if (!isValid) {
            console.log('🔴 [Dropbox] Credentials invalid on load - auto-disconnecting');
            // Credentials are invalid, clear them
            CloudCredentialStorage.forceRemoveCredentials('dropbox');
            SimpleModeCredentialStorage.clearDropboxCredentials();
            setIsConnected(false);
            setNeedsRefresh(false);
            onConfigChange?.(false);
            return;
          }
          
          console.log('✅ [Dropbox] Connected successfully from stored credentials');
          credentialsLoadedRef.current = true;
          
          // CRITICAL: Register with ConnectionStateManager
          connectionStateManager.registerProvider('Dropbox', service);
          storageServiceV2.enableSync();
          
          setIsConnected(true);
          setNeedsRefresh(false);
          onConfigChange?.(true);
        } catch (error) {
          console.error('🔴 [Dropbox] Connection failed on load:', error);
          // Connection failed - credentials are likely invalid
          if (error instanceof Error && error.message.includes('INVALID_CREDENTIALS')) {
            CloudCredentialStorage.forceRemoveCredentials('dropbox');
            SimpleModeCredentialStorage.clearDropboxCredentials();
          }
          setIsConnected(false);
          setNeedsRefresh(false);
          onConfigChange?.(false);
        }
      }
    };

    loadCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterKey]); // Only re-run when masterKey changes, NOT onConfigChange

  // Store OAuth params if masterKey not available yet
  const [pendingOAuthParams, setPendingOAuthParams] = useState<{ code: string; state: string } | null>(null);

  // Listen for encryption-initialized event to process pending OAuth params
  useEffect(() => {
    const handleEncryptionInitialized = async (event: CustomEvent) => {
      if (pendingOAuthParams && event.detail.hasMasterKey) {
        if (import.meta.env.DEV) console.log('🔑 [Dropbox] Encryption initialized event - processing pending OAuth params');
        // CRITICAL FIX: Get the key directly from storageServiceV2, not from masterKey prop
        // The prop may not have updated yet due to async React state updates
        const key = storageServiceV2.getMasterKey();
        if (key && pendingOAuthParams) {
          processingOAuthRef.current = true;
          processedCodesRef.current.add(pendingOAuthParams.code);
          markOAuthCodeProcessed(pendingOAuthParams.code);
          setIsConnecting(true);
          
          try {
            // CRITICAL: Pass the key explicitly to ensure E2E credentials are saved correctly
            await exchangeCodeForTokens(pendingOAuthParams.code, pendingOAuthParams.state, key);
            setPendingOAuthParams(null);
            // Clear the pending OAuth marker on success
            sessionStorage.removeItem('pending-oauth-provider');
            cleanOAuthUrl();
          } catch (error) {
            console.error('🔴 [Dropbox] Failed to exchange pending OAuth tokens:', error);
            setPendingOAuthParams(null);
            // Clear the pending OAuth marker on error
            sessionStorage.removeItem('pending-oauth-provider');
            if (!isSigningOut()) {
              toast({
                title: t('storage.connectionFailed'),
                description: t('storage.dropboxAuthFailed'),
                variant: "destructive",
              });
            }
          } finally {
            setIsConnecting(false);
            processingOAuthRef.current = false;
          }
        }
      }
    };
    
    window.addEventListener('encryption-initialized', handleEncryptionInitialized as EventListener);
    return () => window.removeEventListener('encryption-initialized', handleEncryptionInitialized as EventListener);
  }, [pendingOAuthParams, t, toast]);

  // CRITICAL: Listen for encryption-pending-oauth event
  // This fires when user enters password but we're waiting for OAuth completion
  // In this state, we should proceed with token exchange - onCloudProviderConnected will handle key derivation
  useEffect(() => {
    const handleEncryptionPendingOAuth = async () => {
      // Only proceed if we have pending OAuth params to process
      if (!pendingOAuthParams) {
        if (import.meta.env.DEV) console.log('🔍 [Dropbox] encryption-pending-oauth received but no pending params');
        return;
      }
      
      // Check if already processing
      if (processingOAuthRef.current) {
        if (import.meta.env.DEV) console.log('🔍 [Dropbox] encryption-pending-oauth - already processing');
        return;
      }
      
      // Check if code already processed
      if (isOAuthCodeProcessed(pendingOAuthParams.code) || processedCodesRef.current.has(pendingOAuthParams.code)) {
        if (import.meta.env.DEV) console.log('⏭️ [Dropbox] encryption-pending-oauth - code already processed');
        setPendingOAuthParams(null);
        return;
      }
      
      if (import.meta.env.DEV) {
        console.log('🔑 [Dropbox] encryption-pending-oauth received - processing OAuth now');
        console.log('   Password is stored in storageServiceV2, key will be derived after token exchange');
      }
      
      processingOAuthRef.current = true;
      processedCodesRef.current.add(pendingOAuthParams.code);
      markOAuthCodeProcessed(pendingOAuthParams.code);
      setIsConnecting(true);
      
      try {
        // Exchange tokens WITHOUT the master key
        // The exchangeCodeForTokens will:
        // 1. Exchange OAuth code for tokens
        // 2. Connect service to Dropbox (only needs access token)
        // 3. Call onCloudProviderConnected() which will:
        //    - Use pendingE2EPassword stored in storageServiceV2
        //    - Derive master key using cloud salt
        //    - Dispatch encryption-initialized with hasMasterKey: true
        // 4. After key is derived, save credentials with encryption
        
        // But wait - we need the key to save credentials!
        // The solution: pass null key, exchange tokens, connect service, 
        // then onCloudProviderConnected derives key, then we save credentials
        
        // Actually, we need to modify the approach:
        // Exchange tokens, connect service WITHOUT saving encrypted creds,
        // then onCloudProviderConnected gets the key, then save creds with key
        await exchangeCodeForTokensWithDeferredCredentials(pendingOAuthParams.code, pendingOAuthParams.state);
        setPendingOAuthParams(null);
        sessionStorage.removeItem('pending-oauth-provider');
        cleanOAuthUrl();
      } catch (error) {
        console.error('🔴 [Dropbox] Failed to process pending OAuth (deferred key):', error);
        setPendingOAuthParams(null);
        sessionStorage.removeItem('pending-oauth-provider');
        if (!isSigningOut()) {
          toast({
            title: t('storage.connectionFailed'),
            description: t('storage.dropboxAuthFailed'),
            variant: "destructive",
          });
        }
      } finally {
        setIsConnecting(false);
        processingOAuthRef.current = false;
      }
    };
    
    window.addEventListener('encryption-pending-oauth', handleEncryptionPendingOAuth);
    return () => window.removeEventListener('encryption-pending-oauth', handleEncryptionPendingOAuth);
  }, [pendingOAuthParams, t, toast]);

  // CRITICAL: Process pending OAuth when masterKey prop becomes available
  // This handles the case where password is entered AFTER OAuth redirect stored params
  useEffect(() => {
    const processPendingWithNewKey = async () => {
      // Exit early if no pending params or no masterKey
      if (!pendingOAuthParams || !masterKey) return;
      
      // Check if already processing
      if (processingOAuthRef.current) return;
      
      // Check if code already processed
      if (isOAuthCodeProcessed(pendingOAuthParams.code) || processedCodesRef.current.has(pendingOAuthParams.code)) {
        if (import.meta.env.DEV) console.log('⏭️ [Dropbox] Master key available but code already processed');
        setPendingOAuthParams(null);
        return;
      }
      
      if (import.meta.env.DEV) console.log('🔑 [Dropbox] Master key now available via props - processing pending OAuth');
      
      processingOAuthRef.current = true;
      processedCodesRef.current.add(pendingOAuthParams.code);
      markOAuthCodeProcessed(pendingOAuthParams.code);
      setIsConnecting(true);
      
      try {
        await exchangeCodeForTokens(pendingOAuthParams.code, pendingOAuthParams.state, masterKey);
        setPendingOAuthParams(null);
        sessionStorage.removeItem('pending-oauth-provider');
        cleanOAuthUrl();
      } catch (error) {
        console.error('🔴 [Dropbox] Token exchange failed (masterKey prop change):', error);
        setPendingOAuthParams(null);
        if (!isSigningOut()) {
          toast({
            title: t('storage.connectionFailed'),
            description: t('storage.dropboxAuthFailed'),
            variant: "destructive",
          });
        }
      } finally {
        setIsConnecting(false);
        processingOAuthRef.current = false;
      }
    };
    
    processPendingWithNewKey();
  }, [masterKey, pendingOAuthParams, t, toast]);

  // Handle OAuth redirect with master key dependency
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    
    // EARLY EXIT: If no OAuth params in URL and no pending params, nothing to do
    if (!code && !error && !pendingOAuthParams) {
      return;
    }
    
    // Guard against multiple simultaneous processing
    if (processingOAuthRef.current) {
      if (import.meta.env.DEV) console.log('🔍 [Dropbox] handleOAuthRedirect - already processing, skipping');
      return;
    }
    
    // Increment call counter for debugging
    oauthCallCountRef.current += 1;
    
    const handleOAuthRedirect = async () => {
      // First, check if we have pending OAuth params from previous attempt
      if (pendingOAuthParams && masterKey) {
        // Check if already processed this code (sessionStorage persists across reloads)
        if (isOAuthCodeProcessed(pendingOAuthParams.code) || processedCodesRef.current.has(pendingOAuthParams.code)) {
          console.log('⏭️ [Dropbox] Code already processed (persisted), skipping');
          setPendingOAuthParams(null);
          cleanOAuthUrl();
          return;
        }
        
        if (import.meta.env.DEV) console.log('🔑 [Dropbox] Processing pending OAuth params now that master key is available');
        processingOAuthRef.current = true;
        processedCodesRef.current.add(pendingOAuthParams.code);
        markOAuthCodeProcessed(pendingOAuthParams.code);
        setIsConnecting(true);
        
        try {
          await exchangeCodeForTokens(pendingOAuthParams.code, pendingOAuthParams.state);
          setPendingOAuthParams(null);
          cleanOAuthUrl();
        } catch (error) {
          console.error('🔴 [Dropbox] Token exchange failed:', error);
          setPendingOAuthParams(null);
          if (!isSigningOut()) {
            toast({
              title: t('storage.connectionFailed'),
              description: t('storage.dropboxAuthFailed'),
              variant: "destructive",
            });
          }
        } finally {
          setIsConnecting(false);
          processingOAuthRef.current = false;
        }
        return;
      }

      const errorDescription = params.get('error_description');
      
      // Handle OAuth errors
      if (error) {
        // Only handle if this is a Dropbox-related error
        const provider = state ? getProviderFromState(state) : null;
        if (provider && provider !== 'dropbox') {
          console.log(`⏭️ [Dropbox] Skipping error handling - belongs to ${provider}`);
          return;
        }
        console.log('🧹 [Dropbox] Cleaning OAuth URL immediately');
        cleanOAuthUrl();
        console.log('🔴 [Dropbox] OAuth error:', error, errorDescription);
        const safeMessage = errorDescription?.includes('access_denied') 
          ? t('providers.oauth.accessDenied')
          : t('providers.oauth.authFailed');
        toast({
          title: t('storage.oauthError'),
          description: safeMessage,
          variant: "destructive",
        });
        return;
      }
      
      // Process OAuth callback
      if (code && state) {
        // Check if this callback is for Dropbox
        const provider = getProviderFromState(state);
        if (provider !== 'dropbox') {
          console.log(`⏭️ [Dropbox] Skipping OAuth callback - belongs to ${provider}`);
          return;
        }
        
        // Clean URL immediately after confirming this is for us
        console.log('🧹 [Dropbox] Cleaning OAuth URL immediately');
        cleanOAuthUrl();
        
        // Check if already processed this code (sessionStorage persists across reloads)
        if (isOAuthCodeProcessed(code) || processedCodesRef.current.has(code)) {
          console.log('⏭️ [Dropbox] Code already processed (persisted), skipping');
          return;
        }
        
        const encryptionMode = getEncryptionMode();
        console.log('🔍 [Dropbox] OAuth callback detected, mode:', encryptionMode, 'masterKey:', !!masterKey);
        
        // In E2E mode, require master key
        if (encryptionMode === 'e2e' && !masterKey) {
          // CRITICAL FIX: Check for session markers that survive page reload
          // storageServiceV2.isPendingOAuth is in-memory and resets after reload
          // But session storage markers persist - use them to detect onboarding OAuth return
          // CRITICAL: Also check hasStoredPassword() - this survives page reload when session markers might be cleared
          const { hasStoredPassword } = await import('@/utils/passwordStorage');
          const isOnboardingOAuthReturn = 
            sessionStorage.getItem('onboarding-oauth-in-progress') !== null ||
            sessionStorage.getItem('onboarding-pending-oauth') !== null ||
            sessionStorage.getItem('pending-oauth-provider') !== null ||
            hasStoredPassword(); // Password persists in localStorage even when session markers are cleared
          
          if (storageServiceV2.isPendingOAuth || isOnboardingOAuthReturn) {
            if (import.meta.env.DEV) console.log('🔑 [Dropbox] Detected onboarding OAuth return - proceeding with deferred credentials');
            processingOAuthRef.current = true;
            processedCodesRef.current.add(code);
            markOAuthCodeProcessed(code);
            setIsConnecting(true);
            
            try {
              await exchangeCodeForTokensWithDeferredCredentials(code, state);
            } catch (error) {
              console.error('🔴 [Dropbox] Token exchange failed (pending-oauth):', error);
              if (!isSigningOut()) {
                toast({
                  title: t('storage.connectionFailed'),
                  description: t('storage.dropboxAuthFailed'),
                  variant: "destructive",
                });
              }
            } finally {
              setIsConnecting(false);
              processingOAuthRef.current = false;
            }
            return;
          }
          
          // CRITICAL: Check if initialization is already in progress
          // If so, just wait - don't request password again
          if (storageServiceV2.isInitializationInProgress) {
            console.log('🔄 [Dropbox] Initialization in progress - waiting instead of requesting password');
            setPendingOAuthParams({ code, state });
            // DON'T dispatch require-password - just wait for masterKey prop to update
            return;
          }
          
          // Also check if master key already exists in storage service (might not have propagated yet)
          const existingKey = storageServiceV2.getMasterKey();
          if (existingKey) {
            if (import.meta.env.DEV) console.log('🔑 [Dropbox] Master key exists in storageService - processing immediately');
            // Process with existing key
            processingOAuthRef.current = true;
            processedCodesRef.current.add(code);
            markOAuthCodeProcessed(code);
            setIsConnecting(true);
            try {
              await exchangeCodeForTokens(code, state);
            } catch (error) {
              console.error('🔴 [Dropbox] Token exchange failed:', error);
              if (!isSigningOut()) {
                toast({
                  title: t('storage.connectionFailed'),
                  description: t('storage.dropboxAuthFailed'),
                  variant: "destructive",
                });
              }
            } finally {
              setIsConnecting(false);
              processingOAuthRef.current = false;
            }
            return;
          }
          
          console.log('🔒 [Dropbox] E2E mode but master key not available - storing params');
          setPendingOAuthParams({ code, state });
          
          // CRITICAL: Signal to storageServiceV2 that there's pending OAuth
          // This marker persists after URL cleanup so initialization can detect it
          sessionStorage.setItem('pending-oauth-provider', 'dropbox');
          
          // CRITICAL: Use centralized password request (checks if actually needed first)
          import('@/services/encryptionStateManager').then(({ encryptionStateManager }) => {
            encryptionStateManager.requestPasswordIfNeeded('DropboxSync-OAuth');
          });
          onConfigChange?.(true);
          return;
        }
        
        // Simple mode or E2E with key - process immediately
        console.log('🚀 [Dropbox] Processing OAuth code immediately');
        processingOAuthRef.current = true;
        processedCodesRef.current.add(code);
        markOAuthCodeProcessed(code);
        setIsConnecting(true);
        
        try {
          await exchangeCodeForTokens(code, state);
        } catch (error) {
          console.error('🔴 [Dropbox] Token exchange failed:', error);
          if (!isSigningOut()) {
            const safeMessage = error instanceof Error && error.message?.includes('OAuth') 
              ? t('providers.oauth.dropboxAuthFailed')
              : t('providers.dropbox.connectionFailed');
            toast({
              title: t('storage.connectionFailed'),
              description: safeMessage,
              variant: "destructive",
            });
          }
        } finally {
          setIsConnecting(false);
          processingOAuthRef.current = false;
        }
      }
    };

    handleOAuthRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterKey, pendingOAuthParams]);

  // keyOverride allows passing the master key explicitly when the prop hasn't updated yet
  const exchangeCodeForTokens = async (code: string, state: string, keyOverride?: CryptoKey | null): Promise<void> => {
    const clientId = oauthConfig.dropbox.clientId;

    if (!isDropboxConfigured()) {
      throw new Error('Dropbox OAuth not configured - missing client ID');
    }

    // Retrieve and validate PKCE verifier + state
    const codeVerifier = retrievePKCEVerifier('dropbox', state);
    if (!codeVerifier) {
      throw new Error('PKCE verification failed - invalid or missing code verifier');
    }

    const redirectUri = getOAuthRedirectUri('dropbox');
    console.log('🔐 [Dropbox] Token exchange redirect URI:', redirectUri);
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier, // PKCE verification
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OAuth token exchange failed: ${errorData.error_description || errorData.error || response.statusText}`
      );
    }

    const data = await response.json();
    
    // Validate token response structure
    const validatedTokens = validateTokenResponse(data);
    
    const creds: DropboxCredentials = {
      provider: 'dropbox',
      accessToken: validatedTokens.access_token,
      refreshToken: validatedTokens.refresh_token,
      expiresAt: Date.now() + (validatedTokens.expires_in * 1000),
    };

    // CRITICAL FIX: Use keyOverride if provided, otherwise fall back to masterKey prop
    // This ensures E2E credentials are saved correctly when called from encryption-initialized handler
    const effectiveKey = keyOverride ?? masterKey;
    
    // Save credentials based on encryption mode
    if (isE2EEnabled() && effectiveKey) {
      console.log('🔐 [Dropbox] Saving credentials with E2E encryption');
      await CloudCredentialStorage.saveCredentials(creds, effectiveKey);
    } else {
      console.log('📦 [Dropbox] Saving credentials in Simple mode');
      SimpleModeCredentialStorage.saveDropboxCredentials(creds);
    }
    
    await service.connect(creds, effectiveKey);
    
    // CRITICAL: Register with ConnectionStateManager - single source of truth
    console.log('✅ [Dropbox] Service connected, now registering with manager...');
    connectionStateManager.registerProvider('Dropbox', service);
    storageServiceV2.enableSync();
    console.log('✅ [Dropbox] Registered with ConnectionStateManager');
    
    // Clear onboarding flags since we're now connected
    sessionStorage.removeItem('onboarding-in-progress');
    sessionStorage.removeItem('onboarding-provider');
    sessionStorage.removeItem('onboarding-encryption-mode');
    sessionStorage.removeItem('onboarding-pending-oauth');
    sessionStorage.removeItem('pending-oauth-provider');
    
    setIsConnected(true);
    // CRITICAL: Pass true for isOAuthComplete to signal this is a fresh OAuth connection
    onConfigChange?.(true, true);
    console.log('✅ [Dropbox] Connection state updated and parent notified (OAuth complete)');
    
    // CRITICAL: Dispatch onboarding-oauth-complete event for SyncCheckStep
    // This notifies the onboarding wizard that OAuth flow completed successfully
    const wasOnboardingOAuth = sessionStorage.getItem('onboarding-oauth-in-progress');
    if (wasOnboardingOAuth) {
      console.log('📣 [Dropbox] Dispatching onboarding-oauth-complete event');
      window.dispatchEvent(new CustomEvent('onboarding-oauth-complete'));
      sessionStorage.removeItem('onboarding-oauth-in-progress');
    }
    
    // NOTE: StorageSettings.createConfigChangeHandler handles sync via onCloudProviderConnected
    // We don't call it here to avoid duplicate sync calls - parent handles it via onConfigChange

    // CRITICAL: Dispatch trigger-sync to download entries immediately after OAuth connection
    // This ensures encrypted entries are detected and the notification is shown
    console.log('📥 [Dropbox] Dispatching trigger-sync to reload entries');
    queueMicrotask(() => { window.dispatchEvent(new CustomEvent('trigger-sync')); });

    // Check if this is the primary provider to show appropriate message
    const isPrimary = connectionStateManager.isPrimaryProvider('Dropbox');

    // Show neutral connection message - sync is handled by StorageSettings
    toast({
      title: t('storage.dropboxConnected'),
      description: isPrimary 
        ? t('storage.readyForSync')
        : t('storage.connectedAsBackup')
    });
  };

  /**
   * Exchange OAuth code for tokens with DEFERRED credential saving
   * Used when encryption-pending-oauth fires - we don't have the master key yet
   * The flow is:
   * 1. Exchange OAuth code for tokens
   * 2. Connect service to Dropbox (only needs access token)
   * 3. Call onCloudProviderConnected() which derives the master key
   * 4. Save encrypted credentials with the now-available key
   */
  const exchangeCodeForTokensWithDeferredCredentials = async (code: string, state: string): Promise<void> => {
    const clientId = oauthConfig.dropbox.clientId;

    if (!isDropboxConfigured()) {
      throw new Error('Dropbox OAuth not configured - missing client ID');
    }

    // Retrieve and validate PKCE verifier + state
    const codeVerifier = retrievePKCEVerifier('dropbox', state);
    if (!codeVerifier) {
      throw new Error('PKCE verification failed - invalid or missing code verifier');
    }

    const redirectUri = getOAuthRedirectUri('dropbox');
    console.log('🔐 [Dropbox] (Deferred) Token exchange redirect URI:', redirectUri);
    
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OAuth token exchange failed: ${errorData.error_description || errorData.error || response.statusText}`
      );
    }

    const data = await response.json();
    const validatedTokens = validateTokenResponse(data);
    
    const creds: DropboxCredentials = {
      provider: 'dropbox',
      accessToken: validatedTokens.access_token,
      refreshToken: validatedTokens.refresh_token,
      expiresAt: Date.now() + (validatedTokens.expires_in * 1000),
    };

    console.log('🔐 [Dropbox] (Deferred) Connecting service WITHOUT master key...');
    
    // Connect service - this only needs the access token, not the master key
    await service.connect(creds, null);
    
    // Register with ConnectionStateManager BEFORE calling onCloudProviderConnected
    // This ensures the provider is available for cloud key operations
    console.log('✅ [Dropbox] (Deferred) Service connected, registering with manager...');
    connectionStateManager.registerProvider('Dropbox', service);
    storageServiceV2.enableSync();
    
    // NOW call onCloudProviderConnected - this will:
    // 1. Use pendingE2EPassword from storageServiceV2, OR retrieve from persistent storage
    // 2. Load/create cloud encryption key
    // 3. Derive master key using cloud salt
    // 4. Dispatch encryption-initialized with hasMasterKey: true
    console.log('🔑 [Dropbox] (Deferred) Calling onCloudProviderConnected to derive master key...');
    
    // CRITICAL FIX: Retrieve password from persistent storage if not in-memory
    // After page reload, pendingE2EPassword is lost but storePassword() persists
    const { retrievePassword } = await import('@/utils/passwordStorage');
    const storedPassword = await retrievePassword();
    if (import.meta.env.DEV) console.log('🔐 [Dropbox] (Deferred) Retrieved stored password:', storedPassword ? 'yes' : 'no');
    
    const result = await storageServiceV2.onCloudProviderConnected(storedPassword);
    
    if (result.requiresPassword) {
      console.log('🔐 [Dropbox] (Deferred) Still needs password:', result.reason);
      onRequirePassword?.();
      return;
    }
    
    // NOW get the master key that was just derived
    const derivedKey = storageServiceV2.getMasterKey();
    if (derivedKey) {
      console.log('🔐 [Dropbox] (Deferred) Master key derived, saving encrypted credentials...');
      await CloudCredentialStorage.saveCredentials(creds, derivedKey);
    } else {
      console.warn('⚠️ [Dropbox] (Deferred) No master key after onCloudProviderConnected - credentials not encrypted');
    }
    
    // CRITICAL: Check onboarding flag BEFORE clearing any session storage
    const wasOnboardingOAuth = sessionStorage.getItem('onboarding-oauth-in-progress');
    if (import.meta.env.DEV) console.log('🔍 [Dropbox] (Deferred) onboarding-oauth-in-progress flag:', wasOnboardingOAuth);
    
    // Clear onboarding flags since we're now connected
    sessionStorage.removeItem('onboarding-in-progress');
    sessionStorage.removeItem('onboarding-provider');
    sessionStorage.removeItem('onboarding-encryption-mode');
    sessionStorage.removeItem('onboarding-pending-oauth');
    sessionStorage.removeItem('pending-oauth-provider');
    
    // Dispatch onboarding-oauth-complete AFTER checking flag but BEFORE clearing it
    if (wasOnboardingOAuth) {
      console.log('📣 [Dropbox] (Deferred) Dispatching onboarding-oauth-complete event');
      window.dispatchEvent(new CustomEvent('onboarding-oauth-complete'));
      sessionStorage.removeItem('onboarding-oauth-in-progress');
    }
    
    setIsConnected(true);
    onConfigChange?.(true, true);
    console.log('✅ [Dropbox] (Deferred) Connection complete with E2E encryption');

    // CRITICAL: Dispatch trigger-sync to download entries immediately after OAuth connection
    // This ensures encrypted entries are detected and the notification is shown
    console.log('📥 [Dropbox] (Deferred) Dispatching trigger-sync to reload entries');
    queueMicrotask(() => { window.dispatchEvent(new CustomEvent('trigger-sync')); });

    const isPrimary = connectionStateManager.isPrimaryProvider('Dropbox');
    toast({
      title: t('storage.dropboxConnected'),
      description: isPrimary 
        ? t('storage.readyForSync')
        : t('storage.connectedAsBackup')
    });
  };

  // Native OAuth handler for Capacitor platforms (Android/iOS)
  const handleNativeOAuth = async (clientId: string) => {
    setIsConnecting(true);
    
    try {
      const { AuthService } = await import('@/services/authService');
      const authService = AuthService.getInstance();
      
      const redirectUri = getOAuthRedirectUri('dropbox');
      console.log('📱 [Dropbox] Native OAuth with redirect URI:', redirectUri);
      
      const result = await authService.authenticate({
        provider: 'dropbox',
        clientId,
        authUrl: 'https://www.dropbox.com/oauth2/authorize',
        tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
        scopes: [], // Dropbox doesn't use scope parameter in the same way
        redirectUri,
      });
      
      if (result.success && result.tokens) {
        // Save credentials and connect
        const credentials: DropboxCredentials = {
          provider: 'dropbox',
          accessToken: result.tokens.access_token,
          refreshToken: result.tokens.refresh_token || '',
          expiresAt: Date.now() + (result.tokens.expires_in || 14400) * 1000,
        };
        
        const currentMode = getEncryptionMode();
        const keyToUse = currentMode === 'e2e' ? (masterKey || storageServiceV2.getMasterKey()) : null;
        
        // Save credentials
        if (keyToUse && currentMode === 'e2e') {
          await CloudCredentialStorage.saveCredentials(credentials, keyToUse);
        } else if (currentMode === 'simple') {
          SimpleModeCredentialStorage.saveDropboxCredentials(credentials);
        }
        
        // Connect the service
        await service.connect(credentials, keyToUse);
        
        // Register with ConnectionStateManager
        connectionStateManager.registerProvider('Dropbox', service);
        storageServiceV2.enableSync();
        
        setIsConnected(true);
        credentialsLoadedRef.current = true;
        onConfigChange?.(true, true);
        
        // Trigger cloud provider connected event for encryption key derivation
        await storageServiceV2.onCloudProviderConnected();
        
        // Force entry reload in Index.tsx after native OAuth connection
        console.log('📥 [Dropbox] Dispatching trigger-sync to reload entries');
        queueMicrotask(() => { window.dispatchEvent(new CustomEvent('trigger-sync')); });
        
        // Show success toast
        const isPrimary = connectionStateManager.isPrimaryProvider('Dropbox');
        toast({
          title: t('storage.dropboxConnected'),
          description: isPrimary 
            ? t('storage.readyForSync')
            : t('storage.connectedAsBackup')
        });
      } else {
        throw new Error(result.error || 'Native OAuth failed');
      }
    } catch (error) {
      console.error('📱 [Dropbox] Native OAuth failed:', error);
      if (!isSigningOut()) {
        toast({
          title: t('storage.connectionFailed'),
          description: error instanceof Error ? error.message : t('storage.dropboxAuthFailed'),
          variant: "destructive",
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = async () => {
    const clientId = oauthConfig.dropbox.clientId;
    
    if (!isDropboxConfigured()) {
      toast({
        title: t('storage.configError'),
        description: t('storage.dropboxClientIdMissing'),
        variant: "destructive",
      });
      return;
    }

    const currentMode = getEncryptionMode();
    
    // In E2E mode, require master key
    if (currentMode === 'e2e' && !masterKey) {
      console.log('🔐 [Dropbox] Master key required for E2E mode - setting pending connection');
      // CRITICAL: Clear disabled status to allow reconnection after disconnect
      connectionStateManager.enableProvider('Dropbox');
      setPendingConnection(true);
      onRequirePassword?.();
      return;
    }
    
    // In Simple mode, proceed without master key
    if (currentMode === 'simple') {
      console.log('✅ Simple mode - proceeding without encryption');
    }

    // SECURITY: Rate limit OAuth attempts
    if (!checkOAuthRateLimit('dropbox')) {
      toast({
        title: t('storage.tooManyAttempts'),
        description: t('storage.waitBeforeRetry'),
        variant: "destructive",
      });
      return;
    }

    // Check if running on Capacitor native platform (Android/iOS)
    const isNativePlatform = !!(window as any).Capacitor?.isNativePlatform?.();
    
    if (isNativePlatform) {
      console.log('📱 [Dropbox] Using native OAuth flow via authService');
      await handleNativeOAuth(clientId);
      return;
    }

    // Web OAuth flow (uses window.location.href redirect)
    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateOAuthState('dropbox');
      
      // Store PKCE verifier and state in memory (privacy-first)
      storePKCEVerifier('dropbox', codeVerifier, state);
      
      const redirectUri = getOAuthRedirectUri('dropbox');
      console.log('🔐 [Dropbox] Auth redirect URI:', redirectUri);
      const authUrl = `https://www.dropbox.com/oauth2/authorize?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `token_access_type=offline&` +
        `state=${encodeURIComponent(state)}&` +
        `code_challenge=${encodeURIComponent(codeChallenge)}&` +
        `code_challenge_method=S256`;
      
      // Preserve settings dialog state before OAuth redirect
      sessionStorage.setItem('settings-dialog-open', 'true');
      // Mark that Dropbox just connected to prevent immediate rate-limited sync
      sessionStorage.setItem('dropbox-just-connected', Date.now().toString());
      
      window.location.href = authUrl;
    } catch (error) {
      toast({
        title: t('storage.connectionError'),
        description: error instanceof Error ? error.message : t('storage.dropboxConnectionFailed'),
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    // Check for pending uploads and warn user
    const pendingCount = cloudStorageService.getUploadQueueSize();
    if (pendingCount > 0) {
      const confirmed = window.confirm(
        t('storage.pendingUploadsWarning', { count: pendingCount })
      );
      if (!confirmed) return;
    }
    
    if (import.meta.env.DEV) {
      console.log('🔌 Disconnecting Dropbox - clearing all credentials');
    }
    
    // CRITICAL STEP 1: Disable ALL sync operations BEFORE anything else
    // This prevents auto-sync from re-uploading entries during disconnect
    storageServiceV2.disableSync();
    
    // CRITICAL STEP 2: Clear pending operations to prevent stale uploads on reconnect
    await storageServiceV2.clearLocalSyncState();
    
    // STEP 3: Unregister from ConnectionStateManager FIRST (this also disables auto-reconnect)
    connectionStateManager.unregisterProvider('Dropbox');
    
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
    
    // STEP 5: Set local UI state
    setIsConnected(false);
    setNeedsRefresh(false);
    credentialsLoadedRef.current = false;
    onConfigChange?.(false);
    
    // STEP 6: Clear credentials from BOTH storage systems using force methods
    CloudCredentialStorage.forceRemoveCredentials('dropbox');    // E2E mode - force remove
    SimpleModeCredentialStorage.clearDropboxCredentials();       // Simple mode
    
    // Verify credentials are actually cleared
    if (import.meta.env.DEV) {
      const e2eStillExists = CloudCredentialStorage.hasCredentials('dropbox');
      const simpleStillExists = SimpleModeCredentialStorage.hasDropboxCredentials();
      if (e2eStillExists || simpleStillExists) {
        console.error('❌ CRITICAL: Failed to clear credentials!', { e2eStillExists, simpleStillExists });
      } else {
        console.log('✅ Credentials successfully cleared from both storage systems');
      }
    }
    
    // STEP 7: PRIVACY: Revoke tokens on provider's side (best effort, non-blocking)
    try {
      await service.disconnect();
    } catch (error) {
      // Disconnect API call failed, but credentials are already cleared
      if (import.meta.env.DEV) {
        console.warn('Dropbox disconnect API call failed (credentials already cleared):', error);
      }
    }
    
    // STEP 8: Re-enable sync ONLY if another provider is still connected
    // Note: remainingProviders already computed after unregister above
    if (remainingProviders.length > 0) {
      if (import.meta.env.DEV) {
        console.log('✅ Re-enabling sync - other providers still connected:', remainingProviders);
      }
      storageServiceV2.enableSync();
    } else {
      if (import.meta.env.DEV) {
        console.log('ℹ️ Sync remains disabled - no other providers connected');
      }
    }
    
    toast({
      title: t('storage.disconnected'),
      description: t('storage.dropboxDisconnected')
    });
  };

  // ConnectionStateManager now handles window bindings, but we keep this for migration compatibility
  // The manager handles registration/unregistration automatically

  if (!isConnected) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <DropboxIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">{t('storage.dropbox')}</h3>
        </div>
        <p className="text-muted-foreground mb-4">
          {t('storage.dropboxDesc')}
        </p>
        
        {import.meta.env.DEV && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>{t('storage.devMode')}:</strong> {t('storage.dropboxDevInstructions')}
            </AlertDescription>
          </Alert>
        )}
        
        {getEncryptionMode() === 'simple' && (
          <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-400 text-xs">
              <strong>{t('storage.simpleMode')}:</strong> {t('storage.dropboxSimpleModeWarning')}
            </AlertDescription>
          </Alert>
        )}
        
        <Button 
          onClick={handleConnect} 
          disabled={isConnecting}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {isConnecting ? t('storage.connecting') : t('storage.connectDropbox')}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Header - stack on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        {/* Provider info with wrapping badges */}
        <div className="flex flex-wrap items-center gap-2">
          <DropboxIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold whitespace-nowrap">{t('storage.dropbox')}</h3>
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
        </div>
        {/* Disconnect button */}
        <Button variant="outline" size="sm" onClick={handleDisconnect} className="self-start sm:self-auto">
          {t('storage.disconnect')}
        </Button>
      </div>
      {needsRefresh && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {t('storage.refreshingToken')}
          </AlertDescription>
        </Alert>
      )}
      <p className="text-sm text-muted-foreground">
        {isPrimaryLocal 
          ? t('storage.dropboxSyncActive')
          : t('storage.providerConnectedInactive')
        }
      </p>
    </Card>
  );
};