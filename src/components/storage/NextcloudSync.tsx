import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle, Settings, HelpCircle, Copy, ExternalLink, Star, QrCode, Loader2, Eye, EyeOff } from "lucide-react";
import { NextcloudIcon } from "./ProviderIcons";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, Trans } from "react-i18next";
import { NextcloudDirectService } from "@/services/nextcloudDirectService";
import { CloudCredentialStorage, type NextcloudCredentials as NextcloudCreds } from "@/utils/cloudCredentialStorage";
import { SimpleModeCredentialStorage } from "@/utils/simpleModeCredentialStorage";
import { nextcloudConfigSchema, connectionRateLimiter, normalizeServerUrl } from "@/utils/cloudValidation";
import { storageServiceV2 } from "@/services/storageServiceV2";
import { cloudStorageService } from "@/services/cloudStorageService";
import { getEncryptionMode } from "@/utils/encryptionModeStorage";
import { connectionStateManager } from "@/services/connectionStateManager";
import { usePlatform } from "@/hooks/usePlatform";
import { isQrScanningAvailable, scanNextcloudQr } from "@/utils/nextcloudQrScanner";

// Reusable copy-to-clipboard component for inline commands
const CopyableCode = ({ 
  code, 
  onCopy 
}: { 
  code: string; 
  onCopy: () => void;
}) => (
  <span className="inline-flex items-center gap-1">
    <code className="bg-muted px-2 py-0.5 rounded text-xs">{code}</code>
    <Button
      size="sm"
      variant="ghost"
      className="h-5 w-5 p-0 hover:bg-muted"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code);
        onCopy();
      }}
    >
      <Copy className="w-3 h-3" />
    </Button>
  </span>
);

interface NextcloudConfig {
  serverUrl: string;
  username: string;
  appPassword: string;
}

interface NextcloudSyncProps {
  onConfigChange?: (isConnected: boolean, isOAuthComplete?: boolean) => void;
  masterKey: CryptoKey | null;
  onRequirePassword?: () => void;  // No callback parameter - pure state flow
  isPrimary?: boolean;
}

export const NextcloudSync = ({ onConfigChange, masterKey, onRequirePassword, isPrimary }: NextcloudSyncProps) => {
  const [service] = useState(() => new NextcloudDirectService());
  const [config, setConfig] = useState<NextcloudConfig>({
    serverUrl: "",
    username: "",
    appPassword: ""
  });
  // Initialize isConnected from ConnectionStateManager only - single source of truth
  const [isConnected, setIsConnected] = useState(() => {
    return connectionStateManager.isConnected('Nextcloud');
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrimaryLocal, setIsPrimaryLocal] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [connectionError, setConnectionError] = useState<{ type: string; message: string } | null>(null);
  const [showCorsHelp, setShowCorsHelp] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [pendingConnection, setPendingConnection] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showAppPassword, setShowAppPassword] = useState(false);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isMobile } = usePlatform();

  // Track if we're currently requesting password to prevent duplicates
  const isRequestingPasswordRef = useRef(false);
  // Track if window binding has been set up to avoid duplicates
  const windowBindingSetRef = useRef(false);
  // Track last successful connection to enable recovery
  const lastValidConfigRef = useRef<NextcloudConfig | null>(null);
  // Health check interval
  const healthCheckIntervalRef = useRef<number | null>(null);

  // Use ref to track isConnected to avoid stale closure in subscription
  const isConnectedRef = useRef(isConnected);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Listen for password dialog cancellation to clear pending connection state
  useEffect(() => {
    const handlePasswordCancelled = () => {
      if (import.meta.env.DEV) console.log('🔄 [Nextcloud] Password dialog cancelled - clearing pending state');
      
      // Clear pending connection state
      setPendingConnection(false);
      
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
      const managerConnected = connectionStateManager.isConnected('Nextcloud');
      const primary = connectionStateManager.isPrimaryProvider('Nextcloud');
      setIsPrimaryLocal(primary);
      
      // Use ref to avoid stale closure
      const currentlyConnected = isConnectedRef.current;
      
      // If manager says disconnected but we thought we were connected, update state
      if (!managerConnected && currentlyConnected) {
        if (import.meta.env.DEV) console.log('🔔 [Nextcloud] External disconnect detected via manager');
        setIsConnected(false);
        // Reset config form for re-entry
        setConfig({ serverUrl: "", username: "", appPassword: "" });
      } else if (managerConnected && !currentlyConnected) {
        setIsConnected(true);
        // CRITICAL: Sync display config from running service
        const displayConfig = connectionStateManager.getProviderDisplayConfig('Nextcloud');
        if (displayConfig && displayConfig.serverUrl) {
          setConfig(prev => ({
            ...prev,
            serverUrl: displayConfig.serverUrl || '',
            username: displayConfig.username || '',
          }));
        }
      }
    };
    
    // Initial check
    handleManagerUpdate();
    
    const unsubscribe = connectionStateManager.subscribe(handleManagerUpdate);
    return () => unsubscribe();
  }, []); // Empty deps - use ref for current state

  // Listen for encryption-initialized event to process pending connections
  useEffect(() => {
    const handleEncryptionInitialized = async (event: CustomEvent) => {
      if (pendingConnection && event.detail.hasMasterKey) {
        if (import.meta.env.DEV) console.log('🔑 [Nextcloud] Encryption initialized event - processing pending connection');
        const key = storageServiceV2.getMasterKey();
        if (key) {
          setPendingConnection(false);
          // Retry connection now that master key is available
          if (config.serverUrl && config.username && config.appPassword) {
            handleConnect();
          }
        }
      }
    };
    
    window.addEventListener('encryption-initialized', handleEncryptionInitialized as EventListener);
    return () => window.removeEventListener('encryption-initialized', handleEncryptionInitialized as EventListener);
  }, [pendingConnection, config]);

  // Load configuration from local encrypted storage - runs on every masterKey change
  useEffect(() => {
    const loadConfig = async () => {
      // CRITICAL: Check ConnectionStateManager first - it's the single source of truth
      const isAlreadyConnected = connectionStateManager.isConnected('Nextcloud');
      if (isAlreadyConnected) {
        if (import.meta.env.DEV) console.log('✅ Active Nextcloud connection detected via ConnectionStateManager');
        setIsConnected(true);
        // FIX: Do NOT call onConfigChange here - this is a remount, not a new connection
        // The parent already subscribes to ConnectionStateManager for state updates
        
        // Retrieve display config from the running service for UI display
        const displayConfig = connectionStateManager.getProviderDisplayConfig('Nextcloud');
        if (displayConfig && displayConfig.serverUrl) {
          setConfig(prev => ({
            ...prev,
            serverUrl: displayConfig.serverUrl || '',
            username: displayConfig.username || '',
            // appPassword stays empty (never expose password)
          }));
          if (import.meta.env.DEV) console.log('✅ Display config retrieved from running service:', displayConfig.serverUrl);
          return; // Skip credential loading - service is already running with correct config
        }
        
        // If display config not available from service, continue to load from storage for display
        if (import.meta.env.DEV) console.log('ℹ️ No display config from service, loading from storage');
      }
      
      // CRITICAL: Skip if explicitly disabled (user previously disconnected)
      if (connectionStateManager.isExplicitlyDisabled('Nextcloud')) {
        if (import.meta.env.DEV) console.log('🚫 [Nextcloud] Explicitly disabled, skipping credential load');
        return;
      }
      
      const currentMode = getEncryptionMode();
      
      // In E2E mode, require master key
      if (currentMode === 'e2e') {
        const actualMasterKey = masterKey || storageServiceV2.getMasterKey();
        if (!actualMasterKey) {
          if (import.meta.env.DEV) console.log('ℹ️ No master key available yet (E2E mode requires it)');
          // Don't reset isConnected - just wait for masterKey to become available
          return;
        }
        
        if (!CloudCredentialStorage.hasCredentials('nextcloud')) {
          
          // Check if credentials exist in Simple mode storage (from mode switch)
          const simpleCreds = SimpleModeCredentialStorage.loadNextcloudCredentials();
          if (simpleCreds) {
            if (import.meta.env.DEV) console.log('ℹ️ Found Simple mode credentials, will migrate to E2E');
            try {
              const loadedConfig = {
                serverUrl: simpleCreds.serverUrl,
                username: simpleCreds.username,
                appPassword: simpleCreds.appPassword,
              };
              
              // Migrate to E2E storage
              const actualMasterKey = masterKey || storageServiceV2.getMasterKey();
              if (actualMasterKey) {
                const credentials: NextcloudCreds = {
                  provider: 'nextcloud',
                  serverUrl: loadedConfig.serverUrl,
                  username: loadedConfig.username,
                  appPassword: loadedConfig.appPassword,
                };
                await CloudCredentialStorage.saveCredentials(credentials, actualMasterKey);
                SimpleModeCredentialStorage.clearNextcloudCredentials();
                if (import.meta.env.DEV) console.log('✅ Migrated Simple mode credentials to E2E');
              }
              
              setConfig(loadedConfig);
              if (!isAlreadyConnected) {
                service.connect(loadedConfig);
              }
              setIsConnected(true);
              return;
            } catch (error) {
              console.error('Failed to migrate Simple mode credentials:', error);
            }
          }
          
          if (import.meta.env.DEV) console.log('ℹ️ No Nextcloud credentials stored');
          // CRITICAL: Only reset state if ConnectionStateManager also says disconnected
          if (!isAlreadyConnected) {
            setIsConnected(false);
            setConfig({ serverUrl: "", username: "", appPassword: "" });
          }
          return;
        }

        const credentials = await CloudCredentialStorage.loadCredentials<NextcloudCreds>(
          'nextcloud',
          actualMasterKey
        );
        if (credentials) {
          const loadedConfig = {
            serverUrl: credentials.serverUrl,
            username: credentials.username,
            appPassword: credentials.appPassword,
          };
          
          setConfig(loadedConfig);
          if (!isAlreadyConnected) {
            service.connect(loadedConfig);
            // Register with ConnectionStateManager
            connectionStateManager.registerProvider('Nextcloud', service);
            storageServiceV2.enableSync();
          }
          
          setIsConnected(true);
          setShowConfig(false);
          lastValidConfigRef.current = loadedConfig;
          onConfigChange?.(true);
          
          // CRITICAL: Dispatch trigger-sync to download entries immediately after credential restore
          console.log('📥 [Nextcloud] Dispatching trigger-sync after E2E credential restore');
          queueMicrotask(() => { window.dispatchEvent(new CustomEvent('trigger-sync')); });
          
          try {
            const testResult = await service.test();
            if (!testResult) {
              console.warn('⚠️ Nextcloud credentials loaded but server test failed');
            } else {
              console.log('✅ Nextcloud connection verified');
            }
          } catch (error) {
            console.error('❌ Nextcloud connection test failed:', error);
          }
          
          setPendingConnection(false);
          isRequestingPasswordRef.current = false;
        } else {
          // Credentials exist but failed to decrypt - likely wrong password
          if (import.meta.env.DEV) {
            console.warn('⚠️ Failed to decrypt Nextcloud credentials (wrong key?)');
          }
          
          // Show user-friendly error explaining the issue
          toast({
            title: t('encryption.decryptionFailedTitle'),
            description: t('nextcloudErrors.credentialDecryptFailed'),
            variant: "destructive"
          });
          
          // CRITICAL: Only reset state if ConnectionStateManager also says disconnected
          if (!isAlreadyConnected) {
            setIsConnected(false);
            setConfig({ serverUrl: "", username: "", appPassword: "" });
          }
        }
      } else {
        // Simple mode - load credentials from SimpleModeCredentialStorage
        const simpleCreds = SimpleModeCredentialStorage.loadNextcloudCredentials();
        if (simpleCreds) {
          const loadedConfig = {
            serverUrl: simpleCreds.serverUrl,
            username: simpleCreds.username,
            appPassword: simpleCreds.appPassword,
          };
          
          setConfig(loadedConfig);
          if (!isAlreadyConnected) {
            service.connect(loadedConfig);
            // Register with ConnectionStateManager
            connectionStateManager.registerProvider('Nextcloud', service);
            storageServiceV2.enableSync();
          }
          
          setIsConnected(true);
          setShowConfig(false);
          lastValidConfigRef.current = loadedConfig;
          onConfigChange?.(true);
          
          // CRITICAL: Dispatch trigger-sync to download entries immediately after credential restore
          console.log('📥 [Nextcloud] Dispatching trigger-sync after Simple mode credential restore');
          queueMicrotask(() => { window.dispatchEvent(new CustomEvent('trigger-sync')); });
          
          try {
            const testResult = await service.test();
            if (testResult) {
              if (import.meta.env.DEV) console.log('✅ Nextcloud connection verified (Simple mode)');
            }
          } catch (error) {
            console.error('❌ Nextcloud connection test failed:', error);
          }
        }
      }
    };
    
    loadConfig();
  }, [masterKey]);
  
  
  // Auto-retry connection when masterKey becomes available
  useEffect(() => {
    if (masterKey && pendingConnection && !isConnecting) {
      console.log('✅ Master key now available, auto-retrying Nextcloud connection');
      isRequestingPasswordRef.current = false; // Reset flag
      setPendingConnection(false);
      // Small delay to ensure React has fully updated
      setTimeout(() => {
        handleConnect();
      }, 100);
    }
  }, [masterKey, pendingConnection, isConnecting]);

  const testConnection = async (testConfig: NextcloudConfig): Promise<{ success: boolean; errorType?: string; errorMessage?: string }> => {
    try {
      const testService = new NextcloudDirectService();
      testService.connect(testConfig);
      const success = await testService.test();
      
      if (success) {
        return { success: true };
      } else {
        return { 
          success: false, 
          errorType: 'unknown',
          errorMessage: t('nextcloudErrors.connectionTestFailed')
        };
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Nextcloud connection test failed:', error);
      }
      
      // Detect CORS errors
      const errorMessage = error instanceof Error ? error.message : '';
      const errorName = error instanceof Error ? error.name : '';
      
      // Detect SSL certificate errors first (highest priority)
      if (errorMessage.includes('SSL_CERTIFICATE_ERROR')) {
        return {
          success: false,
          errorType: 'ssl',
          errorMessage: t('nextcloudErrors.sslCertificateError')
        };
      }
      
      if (
        errorName === 'TypeError' ||
        errorMessage.includes('CORS') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Failed to fetch')
      ) {
        return {
          success: false,
          errorType: 'cors',
          errorMessage: t('nextcloudErrors.corsIssueDetected')
        };
      }
      
      // Detect authentication errors
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        return {
          success: false,
          errorType: 'auth',
          errorMessage: t('nextcloudErrors.authFailed')
        };
      }
      
      return { 
        success: false, 
        errorType: 'unknown',
        errorMessage: errorMessage || t('nextcloudErrors.connectionFailed')
      };
    }
  };

  const handleConnect = async () => {
    const currentMode = getEncryptionMode();
    
    // In E2E mode, require master key
    if (currentMode === 'e2e' && !masterKey) {
      // CRITICAL: Check if initialization is already in progress
      // If so, just wait - don't request password again
      if (storageServiceV2.isInitializationInProgress) {
        console.log('🔄 [Nextcloud] Initialization in progress - waiting');
        setPendingConnection(true);
        return;
      }
      
      // Also check if master key already exists in storage service
      const existingKey = storageServiceV2.getMasterKey();
      if (existingKey) {
        console.log('🔑 [Nextcloud] Master key exists in storageService - proceeding');
        // Continue with existing key - we'll pick it up below
      } else {
        console.log('🔐 [Nextcloud] Master key required for E2E mode');
        setPendingConnection(true);
        
        // CRITICAL: Use centralized password request (checks if actually needed first)
        import('@/services/encryptionStateManager').then(({ encryptionStateManager }) => {
          encryptionStateManager.requestPasswordIfNeeded('NextcloudSync-handleConnect');
        });
        onRequirePassword?.();
        return;
      }
    }
    
    // In Simple mode, proceed without master key
    if (currentMode === 'simple') {
      console.log('✅ Simple mode - proceeding without encryption');
    }
    
    isRequestingPasswordRef.current = false;

    // Validate all inputs
    const validation = nextcloudConfigSchema.safeParse(config);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          // Use message as translation key
          errors[err.path[0] as string] = t(err.message);
        }
      });
      setValidationErrors(errors);
      toast({
        title: t('nextcloud.invalidConfig'),
        description: Object.values(errors)[0],
        variant: "destructive"
      });
      return;
    }
    setValidationErrors({});

    // Rate limiting
    if (!connectionRateLimiter.canAttempt('nextcloud')) {
      const remainingMs = connectionRateLimiter.getRemainingTime('nextcloud');
      const remainingSec = Math.ceil(remainingMs / 1000);
      toast({
        title: t('nextcloud.tooManyAttempts'),
        description: t('nextcloud.waitSeconds', { seconds: remainingSec }),
        variant: "destructive"
      });
      return;
    }

    setIsConnecting(true);

    try {
      // Test the connection first
      const result = await testConnection(config);
      
      if (!result.success) {
        setConnectionError({
          type: result.errorType || 'unknown',
          message: result.errorMessage || t('nextcloudErrors.connectionFailedShort')
        });
        
        // Show CORS help dialog automatically if CORS issue detected
        if (result.errorType === 'cors') {
          setShowCorsHelp(true);
        }
        
        throw new Error(result.errorMessage || t('nextcloudErrors.connectionFailedShort'));
      }

      // CRITICAL: Use the validated/transformed config (includes normalized URL with https://)
      // Type assertion is safe here because validation.success is true
      const validatedConfig = validation.data as NextcloudConfig;
      
      // Save configuration (encrypted in E2E mode, plain in Simple mode)
      const currentMode = getEncryptionMode();
      
      if (currentMode === 'e2e') {
        const actualMasterKey = masterKey || storageServiceV2.getMasterKey();
        if (!actualMasterKey) {
          throw new Error(t('nextcloudErrors.masterKeyRequired'));
        }
        
        const credentials: NextcloudCreds = {
          provider: 'nextcloud',
          serverUrl: validatedConfig.serverUrl,
          username: validatedConfig.username,
          appPassword: validatedConfig.appPassword,
        };
        await CloudCredentialStorage.saveCredentials(credentials, actualMasterKey);
      } else {
        // Simple mode - save credentials via SimpleModeCredentialStorage
        const credentials: NextcloudCreds = {
          provider: 'nextcloud',
          serverUrl: validatedConfig.serverUrl,
          username: validatedConfig.username,
          appPassword: validatedConfig.appPassword,
        };
        SimpleModeCredentialStorage.saveNextcloudCredentials(credentials);
      }
      
      // Connect the service with the VALIDATED config (includes https://)
      service.connect(validatedConfig);
      
      // Update local state with normalized URL for correct UI display
      setConfig(validatedConfig);
      
      // Store last valid config for recovery
      lastValidConfigRef.current = validatedConfig;
      
      // CRITICAL: Register with ConnectionStateManager
      connectionStateManager.registerProvider('Nextcloud', service);
      storageServiceV2.enableSync();
      
      setIsConnected(true);
      setShowConfig(false);
      setConnectionError(null);
      setRetryCount(0);
      connectionRateLimiter.reset('nextcloud');
      
      // Now call onConfigChange - pass true for isOAuthComplete since this is a manual connection
      onConfigChange?.(true, true);
      
      // CRITICAL: Dispatch trigger-sync to download entries immediately after connection
      console.log('📥 [Nextcloud] Dispatching trigger-sync to reload entries');
      queueMicrotask(() => { window.dispatchEvent(new CustomEvent('trigger-sync')); });

      // Check if this is the primary provider to show appropriate message
      const isPrimary = connectionStateManager.isPrimaryProvider('Nextcloud');

      toast({
        title: t('providers.nextcloud.connectedSuccess'),
        description: isPrimary 
          ? t('providers.nextcloud.connectedSuccessDesc')
          : t('storage.connectedAsBackup')
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('nextcloudErrors.connectionFailedShort');
      toast({
        title: t('providers.nextcloud.connectionFailed'),
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
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
      console.log('🔌 Disconnecting Nextcloud - clearing all credentials');
    }
    
    // CRITICAL STEP 1: Disable ALL sync operations BEFORE anything else
    // This prevents auto-sync from re-uploading entries during disconnect
    storageServiceV2.disableSync();
    
    // CRITICAL STEP 2: Clear pending operations to prevent stale uploads on reconnect
    await storageServiceV2.clearLocalSyncState();
    
    // STEP 3: Unregister from ConnectionStateManager FIRST (this also disables auto-reconnect)
    connectionStateManager.unregisterProvider('Nextcloud');
    
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
    service.disconnect();
    
    // STEP 6: Clear last valid config to prevent auto-recovery
    lastValidConfigRef.current = null;
    
    // STEP 7: Clear health check
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    // STEP 8: Clear credentials from BOTH storage systems using force methods
    CloudCredentialStorage.forceRemoveCredentials('nextcloud');      // E2E mode - force remove
    SimpleModeCredentialStorage.clearNextcloudCredentials();         // Simple mode
    
    // Verify credentials are actually cleared
    if (import.meta.env.DEV) {
      const e2eStillExists = CloudCredentialStorage.hasCredentials('nextcloud');
      const simpleStillExists = SimpleModeCredentialStorage.hasNextcloudCredentials();
      if (e2eStillExists || simpleStillExists) {
        console.error('❌ CRITICAL: Failed to clear credentials!', { e2eStillExists, simpleStillExists });
      } else {
        console.log('✅ Credentials successfully cleared from both storage systems');
      }
    }
    
    // STEP 9: Update local UI state
    setConfig({ serverUrl: "", username: "", appPassword: "" });
    setIsConnected(false);
    setValidationErrors({});
    connectionRateLimiter.reset('nextcloud');
    onConfigChange?.(false);
    
    // STEP 10: Re-enable sync ONLY if another provider is still connected
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
      title: t('providers.nextcloud.disconnected'),
      description: t('providers.nextcloud.disconnectedDesc')
    });
  };

  // Silent connection health monitoring and auto-recovery
  // This runs in background without affecting UI state
  useEffect(() => {
    if (!isConnected || !config.serverUrl) {
      // Clear health check when not connected
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      return;
    }

    let consecutiveFailures = 0;
    const MAX_FAILURES_BEFORE_LOG = 3; // Only log after multiple failures

    // Perform health check every 60 seconds (reduced frequency)
    const performHealthCheck = async () => {
      try {
        const isHealthy = await service.test();
        if (isHealthy) {
          // Reset failure counter on success
          consecutiveFailures = 0;
        } else if (lastValidConfigRef.current) {
          consecutiveFailures++;
          
          // Only log and recover after multiple consecutive failures
          if (consecutiveFailures >= MAX_FAILURES_BEFORE_LOG) {
            if (import.meta.env.DEV) {
              console.warn('⚠️ Multiple health check failures, attempting silent recovery...');
            }
            // Silently reconnect with last valid config
            service.connect(lastValidConfigRef.current);
            
            // CRITICAL: Update component state to match service state
            setIsConnected(true);
            
            // ConnectionStateManager already has this provider registered
            // No need to manually update window bindings - manager handles it
            if (import.meta.env.DEV) {
              console.log('🔄 Nextcloud connection silently recovered via service.connect()');
            }
            consecutiveFailures = 0; // Reset after recovery attempt
          }
        }
      } catch (error) {
        consecutiveFailures++;
        
        // Only log and recover after multiple consecutive failures
        if (consecutiveFailures >= MAX_FAILURES_BEFORE_LOG && lastValidConfigRef.current) {
          if (import.meta.env.DEV) {
            console.error('Health check error (after multiple failures):', error);
            console.log('🔄 Attempting silent connection recovery');
          }
          service.connect(lastValidConfigRef.current);
          
          // CRITICAL: Update component state to match service state
          setIsConnected(true);
          
          // ConnectionStateManager already has this provider registered
          // No need to manually update window bindings
          consecutiveFailures = 0; // Reset after recovery attempt
        }
      }
    };

    // Initial health check after 30 seconds (give connection time to stabilize)
    const initialCheck = setTimeout(performHealthCheck, 30000);
    
    // Set up periodic health checks every 60 seconds (less aggressive)
    healthCheckIntervalRef.current = window.setInterval(performHealthCheck, 60000);

    return () => {
      clearTimeout(initialCheck);
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [isConnected, config.serverUrl, service]);

  // Set up window binding - ONLY when truly connected
  // Note: This useEffect maintains the binding, but handleConnect creates it initially
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Only create binding if not already created and we're connected
    if (isConnected && config.serverUrl && !windowBindingSetRef.current) {
      // Check if there's already a connected binding - verify it actually works before trusting
      const existingBindingConnected = (window as any).nextcloudSync?.isConnected === true;
      if (existingBindingConnected) {
        // Verify the connection actually works before trusting the binding
        const existingService = (window as any).nextcloudSync?.service;
        if (existingService && typeof existingService.test === 'function') {
          existingService.test().then((testResult: boolean) => {
            if (testResult) {
              windowBindingSetRef.current = true;
              console.log('🔗 Nextcloud binding verified and preserved');
            } else {
              console.warn('⚠️ Existing binding shows connected but test failed - will recreate');
              windowBindingSetRef.current = false;
            }
          }).catch(() => {
            console.warn('⚠️ Existing binding test threw error - will recreate');
            windowBindingSetRef.current = false;
          });
        } else {
          windowBindingSetRef.current = true; // Mark as set if no test available
          console.log('🔗 Nextcloud binding already exists, preserving it');
        }
        return;
      }
      
      // Only create new binding if no existing connected binding and our service is connected
      if (service.isConnected) {
        (window as any).nextcloudSync = {
          name: 'Nextcloud',
          get isConnected() {
            return service.isConnected;
          },
          service,
          upload: service.upload.bind(service),
          download: service.download.bind(service),
          listFiles: service.listFiles.bind(service),
          delete: service.delete.bind(service),
          exists: service.exists.bind(service),
        };
        
        windowBindingSetRef.current = true;
        console.log('🔗 Nextcloud binding established (from useEffect)');
      }
    }
    
    // FIXED: Only remove binding when explicitly disconnected AND credentials are completely gone
    // Don't remove during temporary decryption failures or masterKey changes
    if (!isConnected && !config.serverUrl && windowBindingSetRef.current && 
        !CloudCredentialStorage.hasCredentials('nextcloud')) {
      delete (window as any).nextcloudSync;
      windowBindingSetRef.current = false;
      console.log('🔌 Nextcloud binding removed (credentials deleted)');
    }
    
    // Cleanup on unmount - DO NOT remove window binding
    // The binding must persist even when component unmounts so sync can continue
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      // Note: We intentionally do NOT delete window.nextcloudSync here
      // It should persist for background sync operations even after Settings closes
    };
  }, [isConnected, config.serverUrl, service]);

  const uploadToNextcloud = async (fileName: string, content: string): Promise<void> => {
    if (!isConnected) {
      throw new Error(t('nextcloud.notConnected'));
    }
    
    await service.upload(fileName, content);
  };

  const downloadFromNextcloud = async (fileName: string): Promise<string | null> => {
    if (!isConnected) {
      throw new Error(t('nextcloud.notConnected'));
    }
    
    return await service.download(fileName);
  };

  const listFiles = async (directoryPath: string) => {
    if (!isConnected) {
      throw new Error(t('nextcloud.notConnected'));
    }
    
    return await service.listFiles(directoryPath);
  };

  const deleteFile = async (fileName: string) => {
    if (!isConnected) {
      throw new Error(t('nextcloud.notConnected'));
    }
    
    await service.delete(fileName);
  };

  const fileExists = async (fileName: string) => {
    if (!isConnected) {
      return false;
    }
    
    return await service.exists(fileName);
  };

  // NOTE: Window binding is managed in the main useEffect above (lines 406-446)
  // DO NOT set window.nextcloudSync here as it conflicts with the proper provider object

  if (!showConfig && !isConnected) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <NextcloudIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('providers.nextcloud.title')}</h3>
        </div>
        <p className="text-muted-foreground mb-4">
          {t('providers.nextcloud.description')}
        </p>
        <Button onClick={() => setShowConfig(true)} className="w-full">
          <Settings className="w-4 h-4 mr-2" />
          {t('providers.nextcloud.configure')}
        </Button>
      </Card>
    );
  }

  if (isConnected && !showConfig) {
    return (
      <Card className="p-6">
        {/* Header - stack on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          {/* Provider info with wrapping badges */}
          <div className="flex flex-wrap items-center gap-2">
            <NextcloudIcon className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold whitespace-nowrap">{t('providers.nextcloud.title')}</h3>
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('providers.nextcloud.connected')}
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
        <p className="text-sm text-muted-foreground mb-2">
          {t('providers.nextcloud.server')} {config.serverUrl}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('providers.nextcloud.user')} {config.username}
        </p>
      </Card>
    );
  }

  return (
      <Card className="p-6">
      {/* Header - stack on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        {/* Provider info with wrapping badges */}
        <div className="flex flex-wrap items-center gap-2">
          <NextcloudIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold whitespace-nowrap">{t('providers.nextcloud.title')}</h3>
          {isConnected && (
            <>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="w-3 h-3 mr-1" />
                {t('providers.nextcloud.connected')}
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
        
        <Button variant="outline" size="sm" onClick={() => setShowCorsHelp(true)}>
          <HelpCircle className="w-4 h-4 mr-2" />
          {t('nextcloudHelp.setupHelp')}
        </Button>
        <Dialog open={showCorsHelp} onOpenChange={setShowCorsHelp}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto z-[120]" aria-describedby="nextcloud-help-dialog-description">
            <DialogHeader>
              <DialogTitle>{t('nextcloudHelp.dialogTitle')}</DialogTitle>
              <DialogDescription id="nextcloud-help-dialog-description">
                {t('nextcloudHelp.dialogDescription')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t('nextcloudHelp.whyNeeded')}</strong> {t('nextcloudHelp.whyNeededDesc')}
                </AlertDescription>
              </Alert>


              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="method-1">
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{t('nextcloudHelp.apacheUsers')}</Badge>
                      <span>{t('nextcloudHelp.apacheMethod')}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-3">
                    <p className="text-sm text-muted-foreground">
                      {t('nextcloudHelp.apacheDesc')}
                    </p>
                    
                    <div className="space-y-4">
                      {/* Step 1: Enable modules */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{t('nextcloudHelp.enableModulesFirst')}</p>
                        <div className="relative">
                          <code className="block bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                            sudo a2enmod headers rewrite setenvif && sudo systemctl restart apache2
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-1.5 right-2"
                            onClick={() => {
                              navigator.clipboard.writeText('sudo a2enmod headers rewrite setenvif && sudo systemctl restart apache2');
                              toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') });
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Step 2: Add config - with visual guide */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{t('nextcloudHelp.apacheInstructions')}</p>
                        
                        {/* Which file to edit? - now part of Step 2 */}
                        <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                          <p className="font-medium text-sm">{t('nextcloudHelp.whichFileToEdit')}</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>
                              <strong>{t('nextcloudHelp.letsEncryptSetup')}:</strong> {t('nextcloudHelp.letsEncryptFile')} <code className="ml-1 text-xs bg-muted px-1 rounded">*-le-ssl.conf</code>
                            </li>
                            <li>
                              <strong>{t('nextcloudHelp.standardSetup')}:</strong> {t('nextcloudHelp.standardFile')} <code className="ml-1 text-xs bg-muted px-1 rounded">default-ssl.conf</code>
                            </li>
                            <li>
                              <strong>{t('nextcloudHelp.singleFileSetup')}:</strong> {t('nextcloudHelp.singleFileDesc')}
                            </li>
                          </ul>
                          <p className="text-xs text-muted-foreground mt-2 flex items-center flex-wrap gap-1">
                            {t('nextcloudHelp.findYourFile')}: <CopyableCode 
                              code="ls -l /etc/apache2/sites-enabled/" 
                              onCopy={() => toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') })}
                            />
                          </p>
                        </div>
                        
                        {/* Step 2b: Edit the file */}
                        <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                          <p className="font-medium text-sm">{t('nextcloudHelp.step2bEditFile')}</p>
                          <p className="text-sm text-muted-foreground">{t('nextcloudHelp.editFileInstruction')}</p>
                          <div className="relative">
                            <code className="block bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                              sudo nano /etc/apache2/sites-enabled/YOUR_FILE.conf
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              className="absolute top-1.5 right-2"
                              onClick={() => {
                                navigator.clipboard.writeText('sudo nano /etc/apache2/sites-enabled/YOUR_FILE.conf');
                                toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') });
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground italic">
                            {t('nextcloudHelp.replaceFilename')}
                          </p>
                        </div>
                        
                        {/* Where to paste visual guide */}
                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg space-y-2">
                          <p className="font-medium text-sm flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-500" />
                            {t('nextcloudHelp.whereToPaste')}
                          </p>
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`<VirtualHost *:443>
    ServerName your-domain.com
    DocumentRoot /var/www/...
    
    # ... existing config ...
    
    # ▼▼▼ PASTE CORS CONFIG HERE ▼▼▼
    SetEnvIf Origin "^https://..." CORS_ALLOW
    Header always set Access-Control-Allow-Origin ...
    ...
    # ▲▲▲ END OF CORS CONFIG ▲▲▲
    
</VirtualHost>  ← Before this closing tag`}
                          </pre>
                        </div>
                        
                        {/* Simple config (recommended for personal servers) */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                                {t('nextcloudHelp.recommended')}
                              </Badge>
                              <span className="font-medium text-sm">{t('nextcloudHelp.simpleConfig')}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const code = `# Simple CORS config (works with web + mobile apps)
<IfModule mod_headers.c>
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE"
    Header always set Access-Control-Allow-Headers "authorization, content-type, depth, user-agent, x-file-size, x-requested-with, if-modified-since, x-file-name, cache-control"
    Header always set Access-Control-Max-Age "3600"
</IfModule>

# Handle OPTIONS preflight - return 200 without auth
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} OPTIONS
    RewriteRule ^(.*)$ $1 [R=200,L]
</IfModule>`;
                                navigator.clipboard.writeText(code);
                                toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') });
                              }}
                            >
                              <Copy className="w-4 h-4 mr-1" />
                              {t('nextcloudHelp.copyConfig')}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">{t('nextcloudHelp.simpleConfigDesc')}</p>
                          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`# Simple CORS config (works with web + mobile apps)
<IfModule mod_headers.c>
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE"
    Header always set Access-Control-Allow-Headers "authorization, content-type, depth, user-agent, x-file-size, x-requested-with, if-modified-since, x-file-name, cache-control"
    Header always set Access-Control-Max-Age "3600"
</IfModule>

# Handle OPTIONS preflight - return 200 without auth
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_METHOD} OPTIONS
    RewriteRule ^(.*)$ $1 [R=200,L]
</IfModule>`}
                          </pre>
                        </div>
                        
                        {/* Advanced config (for shared servers) */}
                        <Accordion type="single" collapsible className="border rounded-lg">
                          <AccordionItem value="advanced" className="border-none">
                            <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                              <div className="flex items-center justify-between gap-2 w-full">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{t('nextcloudHelp.advanced')}</Badge>
                                  <span>{t('nextcloudHelp.secureConfig')}</span>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-3 pb-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                                <p className="text-xs text-muted-foreground">{t('nextcloudHelp.secureConfigDesc')}</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const escapedOrigin = window.location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                    const code = `# Step A: Allow both web and mobile app origins
SetEnvIf Origin "^${escapedOrigin}$" CORS_ALLOW=1
SetEnvIf Origin "^https?://localhost" CORS_ALLOW=1
SetEnvIf Origin "^capacitor://localhost" CORS_ALLOW=1
SetEnvIf Origin "^http://localhost" CORS_ALLOW=1

# Step B: Reflect the Origin back (supports multiple origins securely)
Header always set Access-Control-Allow-Origin "%{HTTP_ORIGIN}e" env=CORS_ALLOW
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE" env=CORS_ALLOW
Header always set Access-Control-Allow-Headers "authorization, content-type, depth, user-agent, x-file-size, x-requested-with, if-modified-since, x-file-name, cache-control" env=CORS_ALLOW
Header always set Access-Control-Allow-Credentials "true" env=CORS_ALLOW
Header always set Access-Control-Max-Age "3600" env=CORS_ALLOW

# Step C: Handle OPTIONS preflight - return 200 immediately WITHOUT authentication
RewriteEngine On
RewriteCond %{ENV:CORS_ALLOW} 1
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ $1 [R=200,L]`;
                                    navigator.clipboard.writeText(code);
                                    toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') });
                                  }}
                                >
                                  <Copy className="w-4 h-4 mr-1" />
                                  {t('nextcloudHelp.copyConfig')}
                                </Button>
                              </div>
                              <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`# Step A: Allow both web and mobile app origins
SetEnvIf Origin "^${window.location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')}$" CORS_ALLOW=1
SetEnvIf Origin "^https?://localhost" CORS_ALLOW=1
SetEnvIf Origin "^capacitor://localhost" CORS_ALLOW=1
SetEnvIf Origin "^http://localhost" CORS_ALLOW=1

# Step B: Reflect the Origin back (supports multiple origins securely)
Header always set Access-Control-Allow-Origin "%{HTTP_ORIGIN}e" env=CORS_ALLOW
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE" env=CORS_ALLOW
Header always set Access-Control-Allow-Headers "authorization, content-type, depth, user-agent, x-file-size, x-requested-with, if-modified-since, x-file-name, cache-control" env=CORS_ALLOW
Header always set Access-Control-Allow-Credentials "true" env=CORS_ALLOW
Header always set Access-Control-Max-Age "3600" env=CORS_ALLOW

# Step C: Handle OPTIONS preflight - return 200 immediately WITHOUT authentication
RewriteEngine On
RewriteCond %{ENV:CORS_ALLOW} 1
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ $1 [R=200,L]`}
                              </pre>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                      
                      <div className="space-y-2 text-sm mt-4">
                        <p className="font-semibold">{t('nextcloudHelp.afterConfig')}</p>
                        <ol className="list-decimal list-inside space-y-2 ml-2">
                          <li>{t('nextcloudHelp.saveFile')}</li>
                          <li className="flex items-center flex-wrap gap-1">
                            {t('nextcloudHelp.testConfig')} <CopyableCode 
                              code="sudo apachectl configtest" 
                              onCopy={() => toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') })}
                            />
                          </li>
                          <li className="flex items-center flex-wrap gap-1">
                            {t('nextcloudHelp.restartApache')} <CopyableCode 
                              code="sudo systemctl restart apache2" 
                              onCopy={() => toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') })}
                            />
                          </li>
                          <li>{t('nextcloudHelp.testConnection')}</li>
                        </ol>
                      </div>
                      
                      <div className="space-y-2 text-sm mt-4 p-3 bg-muted/50 rounded-lg">
                        <p className="font-semibold">{t('nextcloudHelp.expectedOutput')}</p>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            <div>
                              <code className="bg-muted px-1.5 py-0.5 rounded">Syntax OK</code>
                              <span className="text-muted-foreground ml-2">— {t('nextcloudHelp.syntaxOkDesc')}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            <div>
                              <code className="bg-muted px-1.5 py-0.5 rounded">AH00558</code>
                              <span className="text-muted-foreground ml-2">— {t('nextcloudHelp.ah00558Desc')}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-red-600 dark:text-red-400">✗</span>
                            <div>
                              <code className="bg-muted px-1.5 py-0.5 rounded">Invalid command</code>
                              <span className="text-muted-foreground ml-2">— {t('nextcloudHelp.invalidCommandDesc')}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-red-600 dark:text-red-400">✗</span>
                            <div>
                              <code className="bg-muted px-1.5 py-0.5 rounded">Syntax error</code>
                              <span className="text-muted-foreground ml-2">— {t('nextcloudHelp.syntaxErrorDesc')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm mt-4 p-3 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                        <p className="font-semibold flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          {t('nextcloudHelp.troubleshooting')}
                        </p>
                        <div className="space-y-3 text-xs">
                          <div>
                            <p className="font-medium">{t('nextcloudHelp.options401Title')}</p>
                            <p className="text-muted-foreground">{t('nextcloudHelp.options401Fix')}</p>
                          </div>
                          <div>
                            <p className="font-medium">{t('nextcloudHelp.corsHeaderMissingTitle')}</p>
                            <p className="text-muted-foreground">{t('nextcloudHelp.corsHeaderMissingFix')}</p>
                          </div>
                          <div>
                            <p className="font-medium">{t('nextcloudHelp.rewriteNotWorkingTitle')}</p>
                            <p className="text-muted-foreground">{t('nextcloudHelp.rewriteNotWorkingFix')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="method-2">
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{t('nextcloudHelp.nginxUsers')}</Badge>
                      <span>{t('nextcloudHelp.nginxMethod')}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-3">
                    <p className="text-sm text-muted-foreground">
                      {t('nextcloudHelp.nginxDesc')}
                    </p>
                    
                    <div className="space-y-4">
                      {/* Step 1: Find and edit config file */}
                      <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                        <p className="font-medium text-sm">{t('nextcloudHelp.step1FindFile')}</p>
                        <p className="text-sm text-muted-foreground">{t('nextcloudHelp.nginxFindFileInstruction')}</p>
                        <div className="relative">
                          <code className="block bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                            ls /etc/nginx/sites-enabled/
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-1.5 right-2"
                            onClick={() => {
                              navigator.clipboard.writeText('ls /etc/nginx/sites-enabled/');
                              toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') });
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Step 2: Edit the file */}
                      <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                        <p className="font-medium text-sm">{t('nextcloudHelp.step2bEditFile')}</p>
                        <p className="text-sm text-muted-foreground">{t('nextcloudHelp.nginxEditFileInstruction')}</p>
                        <div className="relative">
                          <code className="block bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                            sudo nano /etc/nginx/sites-enabled/YOUR_FILE
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-1.5 right-2"
                            onClick={() => {
                              navigator.clipboard.writeText('sudo nano /etc/nginx/sites-enabled/YOUR_FILE');
                              toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') });
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                          {t('nextcloudHelp.replaceFilename')}
                        </p>
                      </div>
                      
                      {/* Where to paste visual guide */}
                      <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg space-y-2">
                        <p className="font-medium text-sm flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-blue-500" />
                          {t('nextcloudHelp.whereToPaste')}
                        </p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`server {
    listen 443 ssl;
    server_name your-domain.com;
    
    # ... existing config ...
    
    # ▼▼▼ PASTE CORS CONFIG HERE ▼▼▼
    set $cors_origin "";
    if ($http_origin ~ "^(...)$") { ... }
    ...
    # ▲▲▲ END OF CORS CONFIG ▲▲▲
    
    location / {
        ...
    }
}`}
                        </pre>
                      </div>
                      
                      {/* Simple config (recommended for personal servers) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                              {t('nextcloudHelp.recommended')}
                            </Badge>
                            <span className="font-medium text-sm">{t('nextcloudHelp.simpleConfig')}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const code = `# Simple CORS config (works with web + mobile apps)
add_header 'Access-Control-Allow-Origin' '*' always;
add_header 'Access-Control-Allow-Methods' 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE' always;
add_header 'Access-Control-Allow-Headers' 'authorization, content-type, depth, user-agent, x-file-size, x-requested-with, if-modified-since, x-file-name, cache-control' always;
add_header 'Access-Control-Max-Age' '3600' always;

# Handle OPTIONS preflight - return 204 immediately
if ($request_method = 'OPTIONS') {
    return 204;
}`;
                              navigator.clipboard.writeText(code);
                              toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') });
                            }}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            {t('nextcloudHelp.copyConfig')}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{t('nextcloudHelp.simpleConfigDescNginx')}</p>
                        <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`# Simple CORS config (works with web + mobile apps)
add_header 'Access-Control-Allow-Origin' '*' always;
add_header 'Access-Control-Allow-Methods' 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE' always;
add_header 'Access-Control-Allow-Headers' 'authorization, content-type, depth, user-agent, x-file-size, x-requested-with, if-modified-since, x-file-name, cache-control' always;
add_header 'Access-Control-Max-Age' '3600' always;

# Handle OPTIONS preflight - return 204 immediately
if ($request_method = 'OPTIONS') {
    return 204;
}`}
                        </pre>
                      </div>
                      
                      {/* Advanced config (for shared servers) */}
                      <Accordion type="single" collapsible className="border rounded-lg">
                        <AccordionItem value="advanced" className="border-none">
                          <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                            <div className="flex items-center justify-between gap-2 w-full">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{t('nextcloudHelp.advanced')}</Badge>
                                <span>{t('nextcloudHelp.secureConfig')}</span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                              <p className="text-xs text-muted-foreground">{t('nextcloudHelp.secureConfigDescNginx')}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const escapedOrigin = window.location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                  const code = `# Step A: Allow both web and mobile app origins
set $cors_origin "";
if ($http_origin ~ "^(${escapedOrigin}|https?://localhost|capacitor://localhost|http://localhost)$") {
    set $cors_origin $http_origin;
}

# Step B: Set CORS headers (only if origin matched)
if ($cors_origin != "") {
    add_header 'Access-Control-Allow-Origin' $cors_origin always;
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE' always;
    add_header 'Access-Control-Allow-Headers' 'authorization, content-type, depth, user-agent, x-file-size, x-requested-with, if-modified-since, x-file-name, cache-control' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Max-Age' '3600' always;
    add_header 'Access-Control-Expose-Headers' 'ETag, Content-Length' always;
}

# Step C: Handle OPTIONS preflight - return 204 immediately
if ($request_method = 'OPTIONS') {
    return 204;
}`;
                                  navigator.clipboard.writeText(code);
                                  toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') });
                                }}
                              >
                                <Copy className="w-4 h-4 mr-1" />
                                {t('nextcloudHelp.copyConfig')}
                              </Button>
                            </div>
                            <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`# Step A: Allow both web and mobile app origins
set $cors_origin "";
if ($http_origin ~ "^(${window.location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')}|https?://localhost|capacitor://localhost|http://localhost)$") {
    set $cors_origin $http_origin;
}

# Step B: Set CORS headers (only if origin matched)
if ($cors_origin != "") {
    add_header 'Access-Control-Allow-Origin' $cors_origin always;
    add_header 'Access-Control-Allow-Methods' 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE' always;
    add_header 'Access-Control-Allow-Headers' 'authorization, content-type, depth, user-agent, x-file-size, x-requested-with, if-modified-since, x-file-name, cache-control' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Max-Age' '3600' always;
    add_header 'Access-Control-Expose-Headers' 'ETag, Content-Length' always;
}

# Step C: Handle OPTIONS preflight - return 204 immediately
if ($request_method = 'OPTIONS') {
    return 204;
}`}
                            </pre>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                      
                      <div className="space-y-2 text-sm mt-4">
                        <p className="font-semibold">{t('nextcloudHelp.afterConfig')}</p>
                        <ol className="list-decimal list-inside space-y-2 ml-2">
                          <li>{t('nextcloudHelp.saveFile')}</li>
                          <li className="flex items-center flex-wrap gap-1">
                            {t('nextcloudHelp.testNginx')} <CopyableCode 
                              code="sudo nginx -t" 
                              onCopy={() => toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') })}
                            />
                          </li>
                          <li className="flex items-center flex-wrap gap-1">
                            {t('nextcloudHelp.reloadNginx')} <CopyableCode 
                              code="sudo systemctl reload nginx" 
                              onCopy={() => toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') })}
                            />
                          </li>
                          <li>{t('nextcloudHelp.testConnection')}</li>
                        </ol>
                      </div>
                      
                      <div className="space-y-2 text-sm mt-4 p-3 bg-muted/50 rounded-lg">
                        <p className="font-semibold">{t('nextcloudHelp.expectedOutput')}</p>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            <div>
                              <code className="bg-muted px-1.5 py-0.5 rounded">nginx: the configuration file ... syntax is ok</code>
                              <span className="text-muted-foreground ml-2">— {t('nextcloudHelp.nginxSyntaxOkDesc')}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-green-600 dark:text-green-400">✓</span>
                            <div>
                              <code className="bg-muted px-1.5 py-0.5 rounded">nginx: configuration file ... test is successful</code>
                              <span className="text-muted-foreground ml-2">— {t('nextcloudHelp.nginxTestOkDesc')}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-red-600 dark:text-red-400">✗</span>
                            <div>
                              <code className="bg-muted px-1.5 py-0.5 rounded">nginx: [emerg] unknown directive</code>
                              <span className="text-muted-foreground ml-2">— {t('nextcloudHelp.nginxUnknownDirectiveDesc')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm mt-4 p-3 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                        <p className="font-semibold flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          {t('nextcloudHelp.troubleshooting')}
                        </p>
                        <div className="space-y-3 text-xs">
                          <div>
                            <p className="font-medium">{t('nextcloudHelp.options401Title')}</p>
                            <p className="text-muted-foreground">{t('nextcloudHelp.nginxOptions401Fix')}</p>
                          </div>
                          <div>
                            <p className="font-medium">{t('nextcloudHelp.corsHeaderMissingTitle')}</p>
                            <p className="text-muted-foreground">{t('nextcloudHelp.nginxCorsHeaderMissingFix')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="method-3">
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{t('nextcloudHelp.sslIssues')}</Badge>
                      <span>{t('nextcloudHelp.sslMethod')}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-3">
                    <p className="text-sm text-muted-foreground">
                      {t('nextcloudHelp.sslDesc')}
                    </p>
                    
                    <div className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          <strong>{t('nextcloudHelp.commonSslIssues')}</strong><br/>
                          • {t('nextcloudHelp.expiredCert')}<br/>
                          • {t('nextcloudHelp.selfSignedCert')}<br/>
                          • {t('nextcloudHelp.invalidCert')}<br/>
                          • {t('nextcloudHelp.missingIntermediateCerts')}
                        </AlertDescription>
                      </Alert>
                      
                      <div className="space-y-2">
                        <p className="font-semibold text-sm">{t('nextcloudHelp.howToCheckSsl')}</p>
                        <ol className="list-decimal list-inside space-y-2 ml-2 text-sm">
                          <li>
                            {t('nextcloudHelp.openNextcloudUrl', { url: 'https://your-server.com' })}
                          </li>
                          <li>
                            {t('nextcloudHelp.clickPadlock')}
                          </li>
                          <li>
                            {t('nextcloudHelp.checkCertDetails')}
                            <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                              <li>{t('nextcloudHelp.isExpired')}</li>
                              <li>{t('nextcloudHelp.doesDomainMatch')}</li>
                              <li>{t('nextcloudHelp.isSelfSigned')}</li>
                            </ul>
                          </li>
                        </ol>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="font-semibold text-sm">{t('nextcloudHelp.howToFixSsl')}</p>
                        
                        <div className="bg-muted p-3 rounded text-sm space-y-2">
                          <p><strong>{t('nextcloudHelp.forExpiredCerts')}</strong></p>
                          <p>{t('nextcloudHelp.ifUsingLetsEncrypt')}</p>
                          <div className="relative">
                            <pre className="bg-background p-2 rounded text-xs mt-1 pr-10">
sudo certbot renew
sudo systemctl reload apache2  # or nginx</pre>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-1 right-1 h-6 w-6 p-0"
                              onClick={() => {
                                navigator.clipboard.writeText(`sudo certbot renew\nsudo systemctl reload apache2  # or nginx`);
                                toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') });
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="bg-muted p-3 rounded text-sm space-y-2">
                          <p><strong>{t('nextcloudHelp.forSelfSignedCerts')}</strong></p>
                          <p>{t('nextcloudHelp.getFreeCert')}</p>
                          <div className="relative">
                            <pre className="bg-background p-2 rounded text-xs mt-1 pr-10">
{`# Install certbot
sudo apt install certbot python3-certbot-apache

# Get certificate (Apache)
sudo certbot --apache -d your-domain.com

# Or for Nginx
sudo certbot --nginx -d your-domain.com`}</pre>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-1 right-1 h-6 w-6 p-0"
                              onClick={() => {
                                navigator.clipboard.writeText(`# Install certbot\nsudo apt install certbot python3-certbot-apache\n\n# Get certificate (Apache)\nsudo certbot --apache -d your-domain.com\n\n# Or for Nginx\nsudo certbot --nginx -d your-domain.com`);
                                toast({ title: t('nextcloudHelp.copied'), description: t('nextcloudHelp.copiedDesc') });
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <Alert className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {t('nextcloudHelp.sslFixNote')}
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              
              {/* Getting Started Guide for Beginners */}
              <Accordion type="single" collapsible className="mt-4 border rounded-lg">
                <AccordionItem value="getting-started" className="border-0">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{t('nextcloudHelp.gettingStarted')}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4 text-sm">
                      <p className="text-muted-foreground">{t('nextcloudHelp.gettingStartedDesc')}</p>
                      
                      {/* Step 1: Server URL */}
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        <p className="font-semibold text-primary">{t('nextcloudHelp.step1Title')}</p>
                        <p>{t('nextcloudHelp.step1Desc')}</p>
                      </div>
                      
                      {/* Step 2: Username */}
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        <p className="font-semibold text-primary">{t('nextcloudHelp.step2Title')}</p>
                        <p>{t('nextcloudHelp.step2Desc')}</p>
                      </div>
                      
                      {/* Step 3: App Password */}
                      <div className="bg-muted p-3 rounded-lg space-y-2">
                        <p className="font-semibold text-primary">{t('nextcloudHelp.step3Title')}</p>
                        <p className="font-medium">{t('nextcloudHelp.step3CreatePassword')}</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>{t('nextcloudHelp.step3Instructions1')}</li>
                          <li>{t('nextcloudHelp.step3Instructions2')}</li>
                          <li>{t('nextcloudHelp.step3Instructions3')}</li>
                          <li>{t('nextcloudHelp.step3Instructions4')}</li>
                          <li>{t('nextcloudHelp.step3Instructions5')}</li>
                          <li>{t('nextcloudHelp.step3Instructions6')}</li>
                        </ol>
                        <Alert className="mt-2 border-primary/20 bg-primary/5">
                          <AlertCircle className="h-4 w-4 text-primary" />
                          <AlertDescription className="text-xs">
                            {t('nextcloudHelp.step3Tip')}
                          </AlertDescription>
                        </Alert>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>{t('nextcloudHelp.needMoreHelp')}</strong><br/>
                  • <a href="https://docs.nextcloud.com/server/latest/admin_manual/" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{t('nextcloudHelp.checkHostingDocs')}</a><br/>
                  • {t('nextcloudHelp.askSysAdmin')}<br/>
                  • <Trans 
                      i18nKey="nextcloudHelp.consultNextcloudDocs"
                      components={{
                        docLink: <a href="https://docs.nextcloud.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary" />
                      }}
                    />
                </AlertDescription>
              </Alert>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {connectionError && connectionError.type === 'cors' && (
        <Alert className="mb-4 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-sm">
            <strong>{t('nextcloudHelp.corsBlocked')}</strong> Click "Setup Help" above for step-by-step instructions.
          </AlertDescription>
        </Alert>
      )}

      {connectionError && connectionError.type === 'auth' && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm">
            <strong>{t('nextcloudHelp.authFailed')}</strong>
          </AlertDescription>
        </Alert>
      )}

      {connectionError && connectionError.type === 'ssl' && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm">
            <strong>{t('nextcloudHelp.sslError')}</strong> Click "Setup Help" above for instructions on fixing SSL certificate issues.
          </AlertDescription>
        </Alert>
      )}

      {isConnected ? (
        // Connected state - clean display
        <div className="space-y-4">
          {/* CORS Error Banner - shown when server connection issue detected */}
          {connectionError?.type === 'cors' && (
            <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-2">
                <p className="font-semibold">{t('nextcloudHelp.corsTitle')}</p>
                <p>
                  {t('nextcloudHelp.corsDescriptionPart1')}
                  <strong>{t('nextcloudHelp.corsDescriptionBold')}</strong>
                  {t('nextcloudHelp.corsDescriptionPart2')}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowCorsHelp(true)}
                  className="mt-2"
                >
                  <HelpCircle className="h-3 w-3 mr-1" />
                  {t('nextcloudHelp.howToFix')}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          <p className="text-sm text-muted-foreground">
            {t('providers.nextcloud.syncingWith')} <strong>{config.serverUrl}</strong>
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleDisconnect} className="flex-1">
              {t('providers.nextcloud.disconnect')}
            </Button>
          </div>
        </div>
      ) : (
        // Not connected - show form
        <div className="space-y-4">
        {/* QR Code Scanner Section - Mobile Only */}
        {isMobile && isQrScanningAvailable() && (
          <>
            {/* Description above the button */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <QrCode className="w-6 h-6 text-primary" />
                <h4 className="font-semibold text-base">{t('nextcloud.scanQrCode')}</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('nextcloud.scanQrCodeDesc')}
              </p>
            </div>
            
            {/* Prominent action button */}
            <Button 
              className="w-full py-6 text-base"
              onClick={async () => {
                setIsScanning(true);
                try {
                  const result = await scanNextcloudQr();
                  if (result.success && result.config) {
                    setConfig({
                      serverUrl: result.config.serverUrl,
                      username: result.config.username,
                      appPassword: result.config.appPassword,
                    });
                    setValidationErrors({});
                    
                    // Auto-scroll to Connect button after fields are filled
                    setTimeout(() => {
                      connectButtonRef.current?.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                      });
                    }, 100);
                    
                    toast({
                      title: t('nextcloud.qrSuccess'),
                      description: t('nextcloud.qrSuccessDesc'),
                    });
                  } else if (result.error === 'cancelled') {
                    // User cancelled - no toast needed
                  } else if (result.error === 'permission_denied') {
                    toast({
                      title: t('nextcloud.qrScanFailed'),
                      description: t('nextcloud.qrCameraPermissionDenied'),
                      variant: "destructive",
                    });
                  } else if (result.error === 'invalid_format') {
                    toast({
                      title: t('nextcloud.qrScanFailed'),
                      description: t('nextcloud.qrInvalidFormat'),
                      variant: "destructive",
                    });
                  } else {
                    toast({
                      title: t('nextcloud.qrScanFailed'),
                      description: result.errorMessage || t('common.unknownError'),
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  console.error('QR scan error:', error);
                  toast({
                    title: t('nextcloud.qrScanFailed'),
                    description: t('common.unknownError'),
                    variant: "destructive",
                  });
                } finally {
                  setIsScanning(false);
                }
              }}
              disabled={isScanning}
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t('nextcloud.qrScanning')}
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5 mr-2" />
                  {t('nextcloud.openCameraToScan')}
                </>
              )}
            </Button>
            
            {/* Separator */}
            <div className="relative flex items-center justify-center py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <span className="relative bg-background px-3 text-xs text-muted-foreground">
                {t('nextcloud.orEnterManually')}
              </span>
            </div>
          </>
        )}
        
        {getEncryptionMode() === 'simple' && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-400 text-xs">
              <strong>{t('nextcloud.simpleModeWarning')}</strong>
            </AlertDescription>
          </Alert>
        )}
        
        <div>
          <Label htmlFor="serverUrl">{t('nextcloud.serverUrlLabel')}</Label>
          <Input
            id="serverUrl"
            type="url"
            placeholder={t('nextcloud.serverUrlPlaceholder')}
            value={config.serverUrl}
            onChange={(e) => {
              setConfig({ ...config, serverUrl: e.target.value });
              // Clear validation error when user types
              if (validationErrors.serverUrl) {
                setValidationErrors({ ...validationErrors, serverUrl: '' });
              }
            }}
            className={validationErrors.serverUrl ? "border-red-500" : ""}
          />
          {validationErrors.serverUrl && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {validationErrors.serverUrl}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {t('nextcloud.serverUrlHelper')}
          </p>
        </div>

        <div>
          <Label htmlFor="username">{t('nextcloud.usernameLabel')}</Label>
          <Input
            id="username"
            type="text"
            placeholder={t('nextcloud.usernamePlaceholder')}
            value={config.username}
            onChange={(e) => {
              setConfig({ ...config, username: e.target.value });
              if (validationErrors.username) {
                setValidationErrors({ ...validationErrors, username: '' });
              }
            }}
            className={validationErrors.username ? "border-red-500" : ""}
          />
          {validationErrors.username && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {validationErrors.username}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="appPassword">{t('nextcloud.appPasswordLabel')}</Label>
          <div className="relative">
            <Input
              id="appPassword"
              type={showAppPassword ? "text" : "password"}
              placeholder={t('nextcloud.appPasswordPlaceholder')}
              value={config.appPassword}
              onChange={(e) => {
                setConfig({ ...config, appPassword: e.target.value });
                if (validationErrors.appPassword) {
                  setValidationErrors({ ...validationErrors, appPassword: '' });
                }
              }}
              className={`pr-10 ${validationErrors.appPassword ? "border-destructive" : ""}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowAppPassword(!showAppPassword)}
              tabIndex={-1}
            >
              {showAppPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
          {validationErrors.appPassword && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {validationErrors.appPassword}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {t('nextcloudHelp.generateAppPassword')}
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button 
            ref={connectButtonRef}
            onClick={handleConnect} 
            disabled={isConnecting}
            className="flex-1"
          >
            {isConnecting ? t('providers.nextcloud.connecting') : t('providers.nextcloud.connect')}
          </Button>
          
          <Button variant="outline" onClick={() => setShowConfig(false)}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
      )}
    </Card>
  );
};