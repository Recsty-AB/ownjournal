import { GoogleDriveSync } from "@/components/storage/GoogleDriveSync";
import { DropboxSync } from "@/components/storage/DropboxSync";
import { NextcloudSync } from "@/components/storage/NextcloudSync";
import { ICloudSync } from "@/components/storage/ICloudSync";
import { FEATURES, isAppleFeatureAvailable } from "@/config/features";
import { ProviderTransfer } from "@/components/settings/ProviderTransfer";
import { JournalPasswordDialog } from "@/components/auth/JournalPasswordDialog";
import { CloudEncryptedDataDialog } from "@/components/settings/CloudEncryptedDataDialog";
import { IncompatibleKeyDialog } from "@/components/settings/IncompatibleKeyDialog";
import { storageServiceV2 } from "@/services/storageServiceV2";
import { connectionStateManager } from "@/services/connectionStateManager";
import { useRef, useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useTranslation } from "react-i18next";
import { retrievePassword, storePassword, clearPassword } from "@/utils/passwordStorage";
import { CloudCredentialStorage } from "@/utils/cloudCredentialStorage";
import { SimpleModeCredentialStorage } from "@/utils/simpleModeCredentialStorage";
import { getEncryptionMode, setEncryptionMode, isE2EEnabled } from "@/utils/encryptionModeStorage";
import { getCurrentUserId } from "@/utils/userScope";
import { translateCloudError } from "@/utils/translateCloudError";
import { isNextcloudEncryptionError } from "@/utils/cloudErrorCodes";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Shield, Lock, Trash2, Database, Star, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export const StorageSettings = () => {
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(() => {
    // Initialize from storageServiceV2 immediately
    return storageServiceV2.getMasterKey();
  });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showCloudEncryptedDialog, setShowCloudEncryptedDialog] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  // Initialize from ConnectionStateManager - the single source of truth
  const [connectedProviders, setConnectedProviders] = useState<Record<string, boolean>>(() => {
    const names = connectionStateManager.getConnectedProviderNames();
    return {
      googledrive: names.includes('Google Drive'),
      icloud: FEATURES.ICLOUD_ENABLED && isAppleFeatureAvailable() && names.includes('iCloud'),
      dropbox: names.includes('Dropbox'),
      nextcloud: names.includes('Nextcloud'),
    };
  });
  // Track cloud connected count as reactive state (for reliable E2E disable)
  const [cloudConnectedCount, setCloudConnectedCount] = useState(() => 
    connectionStateManager.getConnectedCount()
  );
  const [encryptionMode, setEncryptionModeState] = useState(getEncryptionMode());
  const [isResetting, setIsResetting] = useState(false);
  // Track pending sync request (provider waiting for master key in E2E mode)
  const [pendingSyncProvider, setPendingSyncProvider] = useState<{
    providerKey: string;
    displayName: string;
  } | null>(null);
  // Track incompatible key error dialog
  const [showIncompatibleKeyDialog, setShowIncompatibleKeyDialog] = useState(false);
  const [incompatibleKeyProvider, setIncompatibleKeyProvider] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const handleEncryptionModeChange = async (newMode: 'simple' | 'e2e') => {
    // CRITICAL: Block E2E selection if connected in Simple mode (use reactive state)
    if (newMode === 'e2e' && encryptionMode === 'simple') {
      if (cloudConnectedCount > 0) {
        toast({
          title: t('storage.cannotSwitchToE2E'),
          description: t('storage.disconnectFirst'),
          variant: 'destructive',
        });
        return;
      }
    }
    
    // CRITICAL: Prevent mode switch during active sync to avoid data corruption
    if (storageServiceV2.isSyncInProgress()) {
      toast({
        title: t('storage.syncInProgress'),
        description: t('storage.waitForSyncComplete'),
        variant: 'destructive',
      });
      return;
    }
    
    // Check if there are existing entries before allowing mode switch
    try {
      const entries = await storageServiceV2.getAllEntries();
      
      if (entries.length > 0 && encryptionMode !== newMode) {
        toast({
          title: t('storage.cannotSwitchFromE2E'),
          description: `${t('common.error')}: ${entries.length} entries exist`,
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      // Only allow switch if we're in simple mode and can't read
      // If we're in E2E mode and can't read, that's suspicious
      if (encryptionMode === 'e2e') {
        toast({
          title: t('common.error'),
          description: t('storage.cannotSwitchFromE2E'),
          variant: "destructive",
        });
        return;
      }
      if (import.meta.env.DEV) console.log('Could not check entries, allowing mode switch:', error);
    }
    
    setEncryptionMode(newMode);
    setEncryptionModeState(newMode);
    
    if (newMode === 'e2e') {
      // Switching to E2E mode - check if password already exists
      const storedPassword = await retrievePassword();
      
      if (storedPassword) {
        // Password exists - auto-initialize
        try {
          setIsInitializing(true);
          await storageServiceV2.initialize(storedPassword);
          const key = storageServiceV2.getMasterKey();
          if (key) {
            setMasterKey(key);
            toast({
              title: t('storage.e2eMode'),
              description: t('storage.passwordStoredSecurely'),
            });
          }
        } catch (error) {
          if (import.meta.env.DEV) console.error('Failed to initialize with stored password:', error);
          setShowPasswordDialog(true);
        } finally {
          setIsInitializing(false);
        }
      } else if (!masterKey) {
        // No stored password - need to set one
        toast({
          title: t('encryption.setPassword'),
          description: t('encryption.e2eExplanation'),
        });
        setShowPasswordDialog(true);
      }
    } else if (newMode === 'simple') {
      // Switching to Simple mode - clear master key from memory only
      // DON'T clear stored password (so user can switch back easily)
      storageServiceV2.clearMasterKey();
      setMasterKey(null);
      toast({
        title: t('storage.simpleMode'),
        description: t('storage.simpleModeDesc'),
      });
    }
  };
  
  // Sync masterKey state with storageServiceV2 using event-based approach
  useEffect(() => {
    // Check initial key
    const existingKey = storageServiceV2.getMasterKey();
    if (existingKey && !masterKey) {
      if (import.meta.env.DEV) console.log('🔑 Syncing master key from storage service to StorageSettings');
      setMasterKey(existingKey);
    }
    
    // Subscribe to master key changes (event-based, no polling)
    const unsubscribe = storageServiceV2.onMasterKeyChanged((key) => {
      if (import.meta.env.DEV) console.log('🔑 Master key changed notification received');
      setMasterKey(key);
    });
    
    return () => unsubscribe();
  }, []); // Run once on mount
  
  // Track primary provider name for stable prop passing
  const [primaryProviderName, setPrimaryProviderName] = useState<string | null>(() => {
    return connectionStateManager.getPrimaryProviderName();
  });
  
  // Subscribe to ConnectionStateManager for connection updates (replaces polling)
  useEffect(() => {
    const updateFromManager = () => {
      const names = connectionStateManager.getConnectedProviderNames();
      const count = connectionStateManager.getConnectedCount();
      if (import.meta.env.DEV) {
        console.log('📡 [StorageSettings] Connection state update:', names, 'count:', count);
      }
      setConnectedProviders({
        googledrive: names.includes('Google Drive'),
        icloud: FEATURES.ICLOUD_ENABLED && isAppleFeatureAvailable() && names.includes('iCloud'),
        dropbox: names.includes('Dropbox'),
        nextcloud: names.includes('Nextcloud'),
      });
      // Update cloud connected count for reliable E2E disable
      setCloudConnectedCount(count);
      // Update primary provider name for stable prop passing
      setPrimaryProviderName(connectionStateManager.getPrimaryProviderName());
    };
    
    // Update immediately
    updateFromManager();
    
    // Subscribe to changes
    const unsubscribe = connectionStateManager.subscribe(updateFromManager);
    
    return () => unsubscribe();
  }, []);

  // Second chance: when Storage is opened with user + masterKey but zero connections, try ensureConnections once
  const secondChanceEnsureAttemptedRef = useRef(false);
  useEffect(() => {
    const userId = getCurrentUserId();
    const key = masterKey;
    const count = connectionStateManager.getConnectedCount();
    if (userId !== null && key && count === 0 && !secondChanceEnsureAttemptedRef.current) {
      secondChanceEnsureAttemptedRef.current = true;
      if (import.meta.env.DEV) console.log('🔄 [StorageSettings] Second chance: ensureConnections (user + masterKey, 0 connections)');
      connectionStateManager.ensureConnections(key);
    }
  }, [masterKey]);
  
  // Listen for password re-entry requests (e.g., after provider migration)
  // Key for forcing dialog remount to ensure clean state after migration
  const [passwordDialogKey, setPasswordDialogKey] = useState(0);
  
  useEffect(() => {
    const handlePasswordReentry = () => {
      if (import.meta.env.DEV) {
        console.log('🔔 Password re-entry requested (e.g., after migration)');
        console.log('🎯 Current primary provider:', connectionStateManager.getPrimaryProviderName());
      }
      // Force remount of password dialog with fresh state
      setPasswordDialogKey(prev => prev + 1);
      setShowPasswordDialog(true);
    };
    
    window.addEventListener('require-password-reentry', handlePasswordReentry);
    return () => window.removeEventListener('require-password-reentry', handlePasswordReentry);
  }, []);
  
  // Listen for encryption state changes (e.g., when password is cleared in EncryptionSettings)
  // This is the SINGLE SOURCE OF TRUTH listener for all encryption mode changes
  useEffect(() => {
    const handleEncryptionStateChanged = () => {
      // CRITICAL: Always read from localStorage (source of truth)
      // Don't trust event.detail which may be stale during async operations
      const currentMode = getEncryptionMode();
      const currentKey = storageServiceV2.getMasterKey();
      
      if (import.meta.env.DEV) {
        console.log('🔄 [StorageSettings] Encryption state changed, reading from localStorage:', currentMode, 'hasMasterKey:', !!currentKey);
      }
      
      // Update local state to reflect the true mode from localStorage
      setEncryptionModeState(currentMode);
      if (!currentKey) {
        setMasterKey(null);
      }
    };
    
    window.addEventListener('encryption-state-changed', handleEncryptionStateChanged);
    return () => window.removeEventListener('encryption-state-changed', handleEncryptionStateChanged);
  }, []);
  
  // Trigger pending sync when master key becomes available after password entry
  useEffect(() => {
    if (masterKey && pendingSyncProvider) {
      const { providerKey, displayName } = pendingSyncProvider;
      setPendingSyncProvider(null); // Clear immediately to prevent duplicate triggers
      
      if (import.meta.env.DEV) console.log(`🔑 Master key available - triggering pending sync for ${displayName}`);
      
      // Trigger sync for the pending provider
      const performPendingSync = async () => {
        markSyncedInSession(providerKey);
        toast({ title: t('syncStatus.syncing'), description: displayName });
        
        try {
          const storedPassword = await retrievePassword();
          if (!storedPassword) throw new Error('Password not found');
          
          await storageServiceV2.onCloudProviderConnected(storedPassword);
          const entryCount = await storageServiceV2.getAllEntries().then(e => e.length).catch(() => 0);
          toast({ title: t('storage.synced'), description: `${displayName} - ${entryCount} ${t('export.entries')}` });
        } catch (error) {
          syncedInSession.current.delete(providerKey);
          const desc = error instanceof Error ? translateCloudError(error, t) : t('common.error');
          const isNcEnc = isNextcloudEncryptionError(error);
          toast({ 
            title: isNcEnc ? t('index.nextcloudEncryptionError') : t('storage.syncFailed'), 
            description: desc,
            variant: 'destructive',
            ...(isNcEnc ? {
              duration: 30000,
              action: (
                <ToastAction
                  altText={t('index.nextcloudEncryptionLearnMore')}
                  onClick={() => window.dispatchEvent(new CustomEvent('open-help', { detail: { tab: 'troubleshooting', accordion: 'nextcloud-encryption' } }))}
                >
                  {t('index.nextcloudEncryptionLearnMore')}
                </ToastAction>
              ),
            } : {}),
          });
        }
      };
      
      performPendingSync();
    }
  }, [masterKey, pendingSyncProvider, toast, t]);
  
  // Track if we've synced in THIS session (not localStorage - session only)
  const syncedInSession = useRef<Set<string>>(new Set());
  
  const hasSyncedInSession = (provider: string): boolean => {
    return syncedInSession.current.has(provider);
  };
  
  const markSyncedInSession = (provider: string) => {
    syncedInSession.current.add(provider);
  };
  
  // Track which providers were connected on mount (to detect TRUE new connections, not remounts)
  // CRITICAL FIX: Initialize from ConnectionStateManager to prevent false "new connection" detection
  const mountedProvidersRef = useRef<Set<string> | null>(null);
  if (mountedProvidersRef.current === null) {
    const set = new Set<string>();
    const names = connectionStateManager.getConnectedProviderNames();
    for (const name of names) {
      if (name === 'Google Drive') set.add('googledrive');
      else if (name === 'Dropbox') set.add('dropbox');
      else if (name === 'Nextcloud') set.add('nextcloud');
      else if (name === 'iCloud') set.add('icloud');
    }
    mountedProvidersRef.current = set;
  }
  
  // Create config change handler - handles both password check and sync
  // MEMOIZED to prevent infinite re-renders in child components
  const createConfigChangeHandler = useCallback((providerName: string, displayName: string) => {
    return (connected: boolean, isOAuthComplete?: boolean) => {
      // Update connected state first
      setConnectedProviders(prev => ({ ...prev, [providerName]: connected }));
      
      // CRITICAL FIX: Use isOAuthComplete flag directly instead of fragile wasConnected detection
      // The connectionStateManager.subscribe callback updates connectedProviders BEFORE this is called,
      // so wasConnected would always be true by the time we check it.
      if (!isOAuthComplete || !connected) {
        if (import.meta.env.DEV) console.log(`ℹ️ ${displayName}: No sync needed (isOAuthComplete=${isOAuthComplete}, connected=${connected})`);
        return;
      }
      
      if (import.meta.env.DEV) console.log(`🆕 ${displayName}: OAuth complete - triggering sync`);
      
      // Mark in mounted providers to prevent duplicate triggers on remount
      mountedProvidersRef.current!.add(providerName);
      
      // Schedule sync logic outside of event handler to avoid issues
      setTimeout(async () => {
        // New connection detected! Check encryption mode and master key
        const currentMode = getEncryptionMode();
        const currentMasterKey = storageServiceV2.getMasterKey();
        
        // CRITICAL: Check if we're in pending-oauth state first
        // In this state, password is already stored - just call onCloudProviderConnected
        if (currentMode === 'e2e' && storageServiceV2.isPendingOAuth) {
          if (import.meta.env.DEV) console.log(`🔑 ${displayName}: Completing deferred E2E initialization...`);
          // onCloudProviderConnected will use the stored pendingE2EPassword
          // This is handled in the sync block below
        } else if (currentMode === 'e2e' && !currentMasterKey) {
          // E2E mode but no master key - try to auto-initialize from stored password first
          if (import.meta.env.DEV) console.log(`🔐 ${displayName}: E2E mode, no master key - checking for stored password...`);
          
          const storedPassword = await retrievePassword();
          if (storedPassword) {
            // Password exists - try to initialize automatically
            try {
              await storageServiceV2.initialize(storedPassword);
              const newKey = storageServiceV2.getMasterKey();
              if (newKey) {
                setMasterKey(newKey);
                if (import.meta.env.DEV) console.log(`✅ ${displayName}: Auto-initialized from stored password`);
                // Continue to sync below (don't return)
              } else {
                throw new Error('Master key not available after initialization');
              }
            } catch (error) {
              if (import.meta.env.DEV) console.log(`⚠️ Auto-init failed, prompting for password:`, error);
              setPendingSyncProvider({ providerKey: providerName, displayName });
              handleRequirePassword();
              return;
            }
          } else {
            // No stored password - need to prompt, store pending sync for later
            if (import.meta.env.DEV) console.log(`🔐 ${displayName}: No stored password - requesting password with pending sync`);
            setPendingSyncProvider({ providerKey: providerName, displayName });
            handleRequirePassword();
            return;
          }
        }
        
        // Check if we can sync (different logic for Simple vs E2E mode)
        const canSync = storageServiceV2.canInitialSync();
        const syncedThisSession = hasSyncedInSession(providerName);
        
        // Only auto-sync if this is the first/primary provider
        const currentlyConnectedCount = connectionStateManager.getConnectedCount();
        const isPrimaryProvider = connectionStateManager.isPrimaryProvider(displayName);
        const isFirstProvider = currentlyConnectedCount === 1; // Just connected, so count is 1
        
        // Only sync if: this is the first/only provider, OR it's already marked as primary
        const shouldAutoSync = isFirstProvider || isPrimaryProvider;
        
        if (canSync && !syncedThisSession && shouldAutoSync) {
          if (import.meta.env.DEV) console.log(`🚀 Auto-sync for ${displayName} (primary/first provider, mode=${currentMode})`);
          toast({ title: t('syncStatus.syncing'), description: `${t('syncStatus.connectedProviders', { providers: displayName })}` });
          markSyncedInSession(providerName);
          
          try {
            if (currentMode === 'simple') {
              // Simple mode - no password needed
              if (import.meta.env.DEV) console.log(`✅ ${displayName} connected in Simple mode - starting sync without password`);
              const result = await storageServiceV2.onCloudProviderConnected(); // No password param
              
              // Check if cloud has encrypted data
              if (result.requiresPassword && result.reason === 'cloud_has_encrypted_data') {
                syncedInSession.current.delete(providerName);
                setShowCloudEncryptedDialog(true);
                return;
              }
            } else {
              // E2E mode - check if pending OAuth (password already stored in storageService)
              // or need to retrieve from secure storage
              if (storageServiceV2.isPendingOAuth) {
                // Password is stored in storageServiceV2.pendingE2EPassword
                // onCloudProviderConnected will use it automatically
                if (import.meta.env.DEV) console.log(`🔑 Completing deferred E2E init for ${displayName}...`);
                await storageServiceV2.onCloudProviderConnected(); // No password needed - uses stored one
              } else {
                // Normal flow - retrieve password from secure storage
                const storedPassword = await retrievePassword();
                if (!storedPassword) {
                  throw new Error('Password not found - please reconnect');
                }
                
                if (import.meta.env.DEV) console.log(`🔑 Loading cloud encryption key for ${displayName}...`);
                await storageServiceV2.onCloudProviderConnected(storedPassword);
              }
            }
            
            // Force entries reload to ensure UI updates
            const entryCount = await storageServiceV2.getAllEntries().then(e => e.length).catch(() => 0);
            if (import.meta.env.DEV) console.log(`✅ Sync complete - ${entryCount} entries in storage`);
            
            toast({ 
              title: t('storage.synced'), 
              description: `${displayName} - ${entryCount} ${t('export.entries')}`,
            });
          } catch (error) {
            syncedInSession.current.delete(providerName);
            const syncDesc = error instanceof Error ? translateCloudError(error, t) : t('common.error');
            const isNcSync = isNextcloudEncryptionError(error);
            toast({ 
              title: isNcSync ? t('index.nextcloudEncryptionError') : t('storage.syncFailed'),
              description: syncDesc,
              variant: 'destructive',
              ...(isNcSync ? {
                duration: 30000,
                action: (
                  <ToastAction
                    altText={t('index.nextcloudEncryptionLearnMore')}
                    onClick={() => window.dispatchEvent(new CustomEvent('open-help', { detail: { tab: 'troubleshooting', accordion: 'nextcloud-encryption' } }))}
                  >
                    {t('index.nextcloudEncryptionLearnMore')}
                  </ToastAction>
                ),
              } : {}),
            });
          }
        } else if (!shouldAutoSync && canSync) {
          // Connected as secondary provider - notify user
          if (import.meta.env.DEV) console.log(`ℹ️ ${displayName} connected as secondary provider - no auto-sync`);
          toast({ 
            title: t('storage.connectedAsSecondary', { provider: displayName }),
            description: t('storage.switchToPrimaryToSync'),
          });
        }
      }, 100);
    };
  }, [toast, t]); // Only depend on stable refs
  
  // Handle password requirement - uses centralized single source of truth
  // Handle password requirement - uses centralized single source of truth
  const handleRequirePassword = async () => {
    // CRITICAL: Always check storage service directly first
    const actualMasterKey = storageServiceV2.getMasterKey();
    if (actualMasterKey) {
      if (import.meta.env.DEV) console.warn('Master key exists in storage service, ignoring password request');
      // Sync state if needed
      if (!masterKey) {
        setMasterKey(actualMasterKey);
      }
      return;
    }
    
    if (isInitializing) {
      if (import.meta.env.DEV) console.warn('Already initializing password, ignoring duplicate request');
      return;
    }
    
    if (masterKey) {
      if (import.meta.env.DEV) console.warn('Master key already exists in state, ignoring password request');
      return;
    }
    
    // CRITICAL: Use centralized password request (checks if actually needed first)
    // This dispatches 'require-password' which Index.tsx listens for
    const { encryptionStateManager } = await import('@/services/encryptionStateManager');
    await encryptionStateManager.requestPasswordIfNeeded('StorageSettings-handleRequirePassword');
  };
  
  // Handle password set - initialize storage service
  const handlePasswordSet = async (password: string) => {
    if (isInitializing) {
      if (import.meta.env.DEV) console.warn('Password initialization already in progress');
      throw new Error('Initialization in progress');
    }
    
    setIsInitializing(true);
    try {
      // CRITICAL: Ensure E2E mode is persisted BEFORE calling initialize()
      // so that isE2EEnabled() returns true and master key is created
      const { setEncryptionMode } = await import('@/utils/encryptionModeStorage');
      setEncryptionMode('e2e');
      
      if (import.meta.env.DEV) console.log('🔐 Initializing storage with password in E2E mode...');
      await storageServiceV2.initialize(password);
      
      // CRITICAL: Check for pending-oauth state FIRST
      // In this state, password is stored but master key won't exist until OAuth completes
      if (storageServiceV2.isPendingOAuth) {
        if (import.meta.env.DEV) console.log('⏳ Initialization in pending-oauth state - password stored for later');
        
        // Store password securely for later use
        await storePassword(password);
        
        // Close dialog and show appropriate message
        setShowPasswordDialog(false);
        
        toast({
          title: t('storage.passwordStoredSecurely'),
          description: t('storage.awaitingOAuthComplete', 'Password saved. Connection will complete after cloud authorization.'),
        });
        return; // Exit early - no master key to check for
      }
      
      // Not pending-oauth - expect master key immediately
      // Use exponential backoff retry to handle async initialization
      let newMasterKey: CryptoKey | null = null;
      const maxAttempts = 5;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        newMasterKey = storageServiceV2.getMasterKey();
        if (newMasterKey) break;
        
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
        const delay = 100 * Math.pow(2, attempt - 1);
        if (import.meta.env.DEV) {
          console.log(`⏳ Waiting for master key (attempt ${attempt}/${maxAttempts}, ${delay}ms)...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      if (!newMasterKey) {
        throw new Error('Failed to get master key after initialization');
      }
      
      if (import.meta.env.DEV) console.log('✅ Master key initialized successfully');
      
      // Store password securely for auto-login
      await storePassword(password);
      
      // Update master key state synchronously
      setMasterKey(newMasterKey);
      
      // Close dialog immediately - don't wait for async operations
      setShowPasswordDialog(false);
      
      // Show success after a brief moment (don't block dialog close)
      setTimeout(() => {
        toast({
          title: t('common.save'),
          description: t('storage.passwordStoredSecurely'),
        });
      }, 100);
      
    } catch (error) {
      if (import.meta.env.DEV) console.error('Password set error:', error);
      
      // Check for INCOMPATIBLE_KEY_FORMAT error first - show special dialog
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('INCOMPATIBLE_KEY_FORMAT') || errorMessage.includes('incompatible format')) {
        // Get the current primary provider name for the dialog
        const providerName = connectionStateManager.getPrimaryProviderName() || 'Cloud Storage';
        setIncompatibleKeyProvider(providerName);
        setShowPasswordDialog(false); // Close password dialog
        setShowIncompatibleKeyDialog(true); // Show incompatible key dialog
        return; // Don't rethrow - we're handling this with a dialog
      }
      
      // CRITICAL: Use encryptionStateManager for proper error handling
      // Only clear password on DECRYPTION_FAILED, not on other errors
      const { encryptionStateManager } = await import('@/services/encryptionStateManager');
      const { passwordCleared, shouldPromptPassword } = encryptionStateManager.handleInitializationError(
        error instanceof Error ? error : new Error(String(error))
      );
      
      if (passwordCleared) {
        // Password was wrong - rollback to simple mode
        const { setEncryptionMode } = await import('@/utils/encryptionModeStorage');
        setEncryptionMode('simple');
        storageServiceV2.clearMasterKey();
        
        toast({
          title: t('encryption.incorrectPassword'),
          description: t('encryption.incorrectPasswordDesc'),
          variant: "destructive",
        });
      } else if (error instanceof Error && error.message === 'CLOUD_KEY_REQUIRED') {
        toast({
          title: t('encryption.encryptedEntriesNeedCloud', 'Encrypted entries need cloud access'),
          description: t('encryption.encryptedEntriesNeedCloudDesc', 'You have encrypted entries from a previous sync. Reconnect to the same cloud storage, or reset all data to start fresh.'),
          variant: "default",
          duration: 15000,
        });
      } else if (error instanceof Error && error.message === 'ENTRIES_WITHOUT_KEY') {
        toast({
          title: t('encryption.entriesWithoutKey', 'Encryption key missing'),
          description: t('encryption.entriesWithoutKeyDesc', 'Your cloud storage has encrypted entries but the encryption key is missing. This may happen if the key was deleted.'),
          variant: "destructive",
        });
      } else if (error instanceof Error && error.message === 'NETWORK_ERROR_RETRY') {
        toast({
          title: t('common.networkError', 'Network error'),
          description: t('common.networkErrorRetry', 'Could not connect to cloud storage. Please check your connection and try again.'),
          variant: "destructive",
        });
      } else {
        const otherErrorMessage = error instanceof Error ? error.message : t('common.error');
        toast({
          title: t('auth.authError'),
          description: otherErrorMessage,
          variant: "destructive",
        });
      }
      
      // CRITICAL: Refresh connected providers state after any error
      // This prevents the selector from disappearing due to stale state
      const names = connectionStateManager.getConnectedProviderNames();
      if (import.meta.env.DEV) {
        console.log('🔄 [StorageSettings] Refreshing provider state after error:', names);
      }
      setConnectedProviders({
        googledrive: names.includes('Google Drive'),
        icloud: FEATURES.ICLOUD_ENABLED && isAppleFeatureAvailable() && names.includes('iCloud'),
        dropbox: names.includes('Dropbox'),
        nextcloud: names.includes('Nextcloud'),
      });
      setPrimaryProviderName(connectionStateManager.getPrimaryProviderName());
      
      // Rethrow to signal error to dialog (keeps dialog open with error)
      throw error;
    } finally {
      setIsInitializing(false);
    }
  };
  
  // Handle disconnect to reconnect in E2E mode from CloudEncryptedDataDialog
  const handleDisconnectForE2E = async () => {
    setShowCloudEncryptedDialog(false);
    
    // Get the current primary provider and disconnect it
    const primaryName = connectionStateManager.getPrimaryProviderName();
    if (primaryName) {
      try {
        // Get the provider service and disconnect
        const service = connectionStateManager.getProvider(primaryName);
        connectionStateManager.unregisterProvider(primaryName);
        const disconnectFn = (service as { disconnect?: () => void | Promise<void> })?.disconnect;
        if (disconnectFn) {
          try { await Promise.resolve(disconnectFn.call(service)); } catch {}
        }
        
        // Clear credentials based on provider type
        if (primaryName === 'Google Drive') { 
          CloudCredentialStorage.clearCredentials('google-drive'); 
          SimpleModeCredentialStorage.clearGoogleDriveCredentials(); 
        } else if (primaryName === 'Dropbox') { 
          CloudCredentialStorage.clearCredentials('dropbox'); 
          SimpleModeCredentialStorage.clearDropboxCredentials(); 
        } else if (primaryName === 'Nextcloud') { 
          CloudCredentialStorage.clearCredentials('nextcloud'); 
          localStorage.removeItem('nextcloud_simple_credentials'); 
        } else if (primaryName === 'iCloud') { 
          CloudCredentialStorage.clearCredentials('icloud'); 
          SimpleModeCredentialStorage.clearICloudCredentials(); 
        }
        
        // Refresh connected state
        setConnectedProviders({
          googledrive: false,
          icloud: false,
          dropbox: false,
          nextcloud: false,
        });
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to disconnect provider:', error);
      }
    }
    
    toast({
      title: t('storage.disconnectedForE2E'),
      description: t('storage.disconnectedForE2EDesc'),
    });
  };
  
  // Handle starting fresh (delete cloud data) from CloudEncryptedDataDialog
  const handleStartFresh = async () => {
    try {
      // Delete all entries and encryption key
      await storageServiceV2.deleteAllEntries();
      
      // Clear stored password
      await clearPassword();
      
      // Clear master key
      storageServiceV2.clearMasterKey();
      setMasterKey(null);
      toast({
        title: t('cloudEncrypted.startFresh'),
        description: t('cloudEncrypted.startFreshDesc'),
      });
      setShowCloudEncryptedDialog(false);
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('common.error'),
        variant: "destructive",
      });
    }
  };
  
  // Handle disconnect and reset for incompatible key error
  const handleIncompatibleKeyReset = async () => {
    try {
      // Get the current primary provider and disconnect it
      const primaryName = connectionStateManager.getPrimaryProviderName();
      if (primaryName) {
        const service = connectionStateManager.getProvider(primaryName);
        connectionStateManager.unregisterProvider(primaryName);
        const disconnectFn = (service as { disconnect?: () => void | Promise<void> })?.disconnect;
        if (disconnectFn) {
          try { await Promise.resolve(disconnectFn.call(service)); } catch {}
        }
        
        // Clear credentials based on provider type
        if (primaryName === 'Google Drive') { 
          CloudCredentialStorage.clearCredentials('google-drive'); 
          SimpleModeCredentialStorage.clearGoogleDriveCredentials(); 
        } else if (primaryName === 'Dropbox') { 
          CloudCredentialStorage.clearCredentials('dropbox'); 
          SimpleModeCredentialStorage.clearDropboxCredentials(); 
        } else if (primaryName === 'Nextcloud') { 
          CloudCredentialStorage.clearCredentials('nextcloud'); 
          localStorage.removeItem('nextcloud_simple_credentials'); 
        } else if (primaryName === 'iCloud') { 
          CloudCredentialStorage.clearCredentials('icloud'); 
          SimpleModeCredentialStorage.clearICloudCredentials(); 
        }
      }
      
      // Clear master key and password
      storageServiceV2.clearMasterKey();
      setMasterKey(null);
      await clearPassword();
      
      // Refresh connected providers state
      setConnectedProviders({
        googledrive: false,
        icloud: false,
        dropbox: false,
        nextcloud: false,
      });
      setPrimaryProviderName(null);
      setIncompatibleKeyProvider(null);
      
      toast({
        title: t('storage.disconnected'),
        description: t('index.incompatibleSolution'),
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to reset for incompatible key:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('common.error'),
        variant: "destructive",
      });
    }
  };
  
  // Handle resetting all data (dangerous operation)
  const handleResetAllData = async () => {
    setIsResetting(true);
    try {
      // Delete all entries
      await storageServiceV2.deleteAllEntries();
      
      // Clear stored password
      await clearPassword();
      
      // Clear master key
      storageServiceV2.clearMasterKey();
      setMasterKey(null);
      
      // Reset to simple mode
      setEncryptionMode('simple');
      setEncryptionModeState('simple');
      
      toast({
        title: t('storage.resetAllData'),
        description: t('storage.resetAllDataWarning'),
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to reset data:', error);
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : t('common.error'),
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <JournalPasswordDialog
        key={passwordDialogKey}
        open={showPasswordDialog}
        onOpenChange={(open) => {
          // Only allow closing if not initializing
          if (!isInitializing) {
            setShowPasswordDialog(open);
          }
        }}
        onPasswordSet={handlePasswordSet}
        onDismiss={() => {
          // Close the dialog
          setShowPasswordDialog(false);
          // Dispatch event to clear pending OAuth state in all provider components
          window.dispatchEvent(new CustomEvent('password-dialog-cancelled'));
          if (import.meta.env.DEV) console.log('🔔 Password dialog cancelled - event dispatched');
        }}
      />
      
      <CloudEncryptedDataDialog
        open={showCloudEncryptedDialog}
        onOpenChange={setShowCloudEncryptedDialog}
        onDisconnect={handleDisconnectForE2E}
        onStartFresh={handleStartFresh}
      />
      
      <IncompatibleKeyDialog
        open={showIncompatibleKeyDialog}
        onOpenChange={setShowIncompatibleKeyDialog}
        providerName={incompatibleKeyProvider}
        onDisconnectAndReset={handleIncompatibleKeyReset}
      />
      
      {/* Encryption Mode Selector */}
      <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('storage.encryptionMode')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('storage.encryptionModeDesc')}
          </p>
        </div>
        
        <RadioGroup value={encryptionMode} onValueChange={handleEncryptionModeChange}>
          <div className="space-y-3">
            <div className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
              encryptionMode === 'e2e' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
            }`}>
              <RadioGroupItem 
                value="simple" 
                id="mode-simple" 
                className="mt-1" 
                disabled={encryptionMode === 'e2e'}
              />
              <div className="space-y-1 flex-1">
                <Label 
                  htmlFor="mode-simple" 
                  className={`text-sm font-medium ${
                    encryptionMode === 'e2e' ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  {t('storage.simpleMode')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('storage.simpleModeDesc')}
                </p>
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded text-xs space-y-1">
                  <p className="font-medium text-amber-800 dark:text-amber-400">⚠️ {t('storage.securityWarning')}:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-500">
                    <li>{t('storage.cloudCredentialsWarning')}</li>
                    <li>{t('storage.deviceAccessWarning')}</li>
                    <li>{t('storage.recommendE2E')}</li>
                  </ul>
                </div>
                {encryptionMode === 'e2e' && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                    {t('storage.cannotSwitchFromE2E')}
                  </p>
                )}
              </div>
            </div>
            
            <div className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
              encryptionMode === 'simple' && cloudConnectedCount > 0
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-muted/50'
            }`}>
              <RadioGroupItem 
                value="e2e" 
                id="mode-e2e" 
                className="mt-1"
                disabled={encryptionMode === 'simple' && cloudConnectedCount > 0}
              />
              <div className="space-y-1 flex-1">
                <Label htmlFor="mode-e2e" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {t('storage.e2eMode')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('storage.e2eModeDesc')}
                </p>
                <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded text-xs space-y-1">
                  <p className="font-medium text-emerald-800 dark:text-emerald-400">✓ {t('storage.enhancedSecurity')}:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-emerald-700 dark:text-emerald-500">
                    <li>{t('storage.cloudCredentialsWarning')}</li>
                    <li>{t('storage.deviceAccessWarning')}</li>
                    <li>{t('storage.recommendE2E')}</li>
                  </ul>
                </div>
                {encryptionMode === 'simple' && cloudConnectedCount > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                    {t('storage.cannotSwitchToE2E')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </RadioGroup>
      </div>
      
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {t('storage.cloudStorageIntro')}
        </p>
      </div>

      {/* Active Provider Selector - only show when 2+ providers connected */}
      {(() => {
        // Use React state for consistent rendering instead of direct manager call
        const connectedNames: string[] = [];
        if (connectedProviders.googledrive) connectedNames.push('Google Drive');
        if (FEATURES.ICLOUD_ENABLED && isAppleFeatureAvailable() && connectedProviders.icloud) connectedNames.push('iCloud');
        if (connectedProviders.dropbox) connectedNames.push('Dropbox');
        if (connectedProviders.nextcloud) connectedNames.push('Nextcloud');
        
        if (connectedNames.length < 2) return null;
        
        const handlePrimaryChange = async (providerName: string) => {
          // In E2E mode, validate that the target provider has the encryption key
          if (isE2EEnabled()) {
            const provider = connectionStateManager.getProvider(providerName);
            if (provider) {
              try {
                toast({
                  title: t('storage.verifyingProvider'),
                  description: t('storage.checkingEncryptionKey'),
                });
                
                const keyData = await provider.download('encryption-key.json');
                if (!keyData) {
                  toast({
                    title: t('storage.noKeyOnProvider'),
                    description: t('storage.noKeyOnProviderDesc', { provider: providerName }),
                    variant: "destructive",
                  });
                  return; // Don't switch
                }
              } catch (error) {
                toast({
                  title: t('storage.cannotVerifyProvider'),
                  description: t('storage.providerVerifyFailed', { provider: providerName }),
                  variant: "destructive",
                });
                return;
              }
            }
          }
          
          // Set the preference in ConnectionStateManager
          connectionStateManager.setPreferredPrimaryProvider(providerName);
          
          // CRITICAL: Explicitly update React state for immediate UI refresh
          setPrimaryProviderName(providerName);
          
          // Reset encryption state to load key from new primary
          storageServiceV2.resetEncryptionState();
          
          toast({
            title: t('storage.primaryChanged', { provider: providerName }),
          });
        };
        
        // Copy encryption key to another provider
        const handleCopyKeyToProvider = async (targetProviderName: string) => {
          const primaryProvider = connectionStateManager.getPrimaryProvider();
          const primaryName = connectionStateManager.getPrimaryProviderName();
          if (!primaryProvider || !primaryName) {
            toast({
              title: t('storage.noKeyToCopy'),
              description: t('storage.noPrimaryProvider'),
              variant: "destructive",
            });
            return;
          }
          
          try {
            toast({
              title: t('storage.copyingKey'),
              description: t('storage.copyingKeyDesc', { source: primaryName, target: targetProviderName }),
            });
            
            const keyData = await primaryProvider.download('encryption-key.json');
            if (!keyData) {
              toast({
                title: t('storage.noKeyToCopy'),
                variant: "destructive",
              });
              return;
            }
            
            const targetProvider = connectionStateManager.getProvider(targetProviderName);
            if (targetProvider) {
              await targetProvider.upload('encryption-key.json', keyData);
              toast({
                title: t('storage.keyCopied'),
                description: t('storage.keyCopiedDesc', { provider: targetProviderName }),
              });
            }
          } catch (error) {
            toast({
              title: t('storage.copyKeyFailed'),
              description: error instanceof Error ? error.message : t('common.error'),
              variant: "destructive",
            });
          }
        };
        
        return (
          <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-primary" />
                {t('storage.activeProvider')}
              </Label>
              <Select value={primaryProviderName || ''} onValueChange={handlePrimaryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('storage.selectActiveProvider')} />
                </SelectTrigger>
                <SelectContent>
                  {connectedNames.map(name => (
                    <SelectItem key={name} value={name}>
                      <span className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        {name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {t('storage.activeProviderDesc')}
              </p>
            </div>
            
            {/* Copy encryption key button for E2E mode */}
            {isE2EEnabled() && connectedNames.length >= 2 && (
              <div className="pt-2 border-t">
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                  {t('storage.copyEncryptionKey')}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {connectedNames
                    .filter(name => name !== primaryProviderName)
                    .map(name => (
                      <Button
                        key={name}
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyKeyToProvider(name)}
                      >
                        {t('storage.copyKeyTo', { provider: name })}
                      </Button>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('storage.copyKeyExplanation')}
                </p>
              </div>
            )}
          </div>
        );
      })()}

      <div className="space-y-4">
        <GoogleDriveSync 
          masterKey={masterKey} 
          onRequirePassword={handleRequirePassword}
          onConfigChange={createConfigChangeHandler('googledrive', 'Google Drive')}
          isPrimary={primaryProviderName === 'Google Drive'}
        />
        {FEATURES.ICLOUD_ENABLED && isAppleFeatureAvailable() && (
          <ICloudSync 
            masterKey={masterKey} 
            onRequirePassword={handleRequirePassword}
            onConfigChange={createConfigChangeHandler('icloud', 'iCloud')}
            isPrimary={primaryProviderName === 'iCloud'}
          />
        )}
        <DropboxSync 
          masterKey={masterKey} 
          onRequirePassword={handleRequirePassword}
          onConfigChange={createConfigChangeHandler('dropbox', 'Dropbox')}
          isPrimary={primaryProviderName === 'Dropbox'}
        />
        <NextcloudSync 
          masterKey={masterKey} 
          onRequirePassword={handleRequirePassword}
          onConfigChange={createConfigChangeHandler('nextcloud', 'Nextcloud')}
          isPrimary={primaryProviderName === 'Nextcloud'}
        />
      </div>

      <div className="mt-6">
        <ProviderTransfer />
      </div>

      {encryptionMode === 'e2e' && (
        <div className="mt-6 p-4 bg-muted rounded-lg border">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            {t('storage.e2eMode')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('encryption.e2eExplanation')}
          </p>
        </div>
      )}
      
      {/* Danger Zone - Reset All Data */}
      <div className="mt-6 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-destructive">
          <Trash2 className="h-4 w-4" />
          {t('storage.dangerZone')}
        </h4>
        <p className="text-xs text-muted-foreground mb-4">
          {t('storage.resetAllDataDesc')}
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isResetting}>
              <Trash2 className="h-3 w-3 mr-2" />
              {t('storage.resetAllData')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('storage.resetAllDataConfirm')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p>{t('storage.resetAllDataWarning')}</p>
                  
                  <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                      <strong>{t('storage.backupRecommendation')}</strong>
                      <p className="mt-1 text-sm">{t('storage.backupInstructions')}</p>
                    </AlertDescription>
                  </Alert>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAllData} className="bg-destructive hover:bg-destructive/90">
                {t('storage.resetButton')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
