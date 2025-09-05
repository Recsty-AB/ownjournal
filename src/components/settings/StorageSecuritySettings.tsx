import { GoogleDriveSync } from "@/components/storage/GoogleDriveSync";
import { ICloudSync } from "@/components/storage/ICloudSync";
import { DropboxSync } from "@/components/storage/DropboxSync";
import { FEATURES, SAFETY_CONSTANTS } from "@/config/features";
import { NextcloudSync } from "@/components/storage/NextcloudSync";
import { ProviderTransfer } from "@/components/settings/ProviderTransfer";
import { JournalPasswordDialog } from "@/components/auth/JournalPasswordDialog";
import { CloudEncryptedDataDialog } from "@/components/settings/CloudEncryptedDataDialog";
import { MigrationProgressDialog, MigrationProgress } from "@/components/settings/MigrationProgressDialog";
import { storageServiceV2, type DeletionProgress } from "@/services/storageServiceV2";
import { connectionStateManager } from "@/services/connectionStateManager";
import { useRef, useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useTranslation } from "react-i18next";
import { retrievePassword, storePassword, clearPassword, hasStoredPassword, migratePasswordToMode } from "@/utils/passwordStorage";
import { getPasswordPersistenceMode, setPasswordPersistenceMode, type PasswordPersistenceMode } from "@/utils/passwordPersistenceSettings";
import { getEncryptionMode, setEncryptionMode, isE2EEnabled } from "@/utils/encryptionModeStorage";
import { translateCloudError } from "@/utils/translateCloudError";
import { isNextcloudEncryptionError } from "@/utils/cloudErrorCodes";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Shield, Lock, Trash2, Key, ShieldOff, AlertTriangle, Star, Database, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CloudCredentialStorage } from "@/utils/cloudCredentialStorage";
import { SimpleModeCredentialStorage } from "@/utils/simpleModeCredentialStorage";
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

interface StorageSecuritySettingsProps {
  onResetComplete?: () => void;
  onDeleteAllComplete?: () => void;
}

export const StorageSecuritySettings = ({ 
  onResetComplete, 
  onDeleteAllComplete 
}: StorageSecuritySettingsProps) => {
  // Initialize masterKey synchronously from storageServiceV2 to prevent race conditions
  // where child components receive null on first render during OAuth redirects
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(() => {
    return storageServiceV2.getMasterKey();
  });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showCloudEncryptedDialog, setShowCloudEncryptedDialog] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<Record<string, boolean>>({});
  // Track cloud connected count as reactive state (for reliable E2E disable)
  const [cloudConnectedCount, setCloudConnectedCount] = useState(() => 
    connectionStateManager.getConnectedCount()
  );
  const [encryptionMode, setEncryptionModeState] = useState(getEncryptionMode());
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState<DeletionProgress | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [passwordSet, setPasswordSet] = useState(false);
  const [passwordPersistence, setPasswordPersistence] = useState<PasswordPersistenceMode>(getPasswordPersistenceMode);
  const [primaryProviderName, setPrimaryProviderName] = useState<string | null>(() => {
    return connectionStateManager.getPrimaryProviderName();
  });
  
  // Migration state
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [migrationDirection, setMigrationDirection] = useState<'simple-to-e2e' | 'e2e-to-simple'>('simple-to-e2e');
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress>({
    phase: 'preparing',
    currentItem: 0,
    totalItems: 0,
    migratedCount: 0,
    failedCount: 0,
  });
  const [pendingModeSwitch, setPendingModeSwitch] = useState<'simple' | 'e2e' | null>(null);
  
  // Password reset fields
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { toast } = useToast();
  const { t } = useTranslation();
  
  // Subscribe to ConnectionStateManager for real-time updates
  useEffect(() => {
    const updateFromManager = () => {
      const names = connectionStateManager.getConnectedProviderNames();
      const primary = connectionStateManager.getPrimaryProviderName();
      const count = connectionStateManager.getConnectedCount();
      if (import.meta.env.DEV) {
        console.log('🔄 [StorageSecuritySettings] ConnectionStateManager update:', { 
          connected: names, 
          primary,
          count
        });
      }
      setConnectedProviders({
        googledrive: names.includes('Google Drive'),
        icloud: names.includes('iCloud'),
        dropbox: names.includes('Dropbox'),
        nextcloud: names.includes('Nextcloud'),
      });
      setPrimaryProviderName(primary);
      // Update cloud connected count for reliable E2E disable
      setCloudConnectedCount(count);
    };
    
    updateFromManager();
    const unsubscribe = connectionStateManager.subscribe(updateFromManager);
    return () => unsubscribe();
  }, []);
  
  // Handle primary provider change with E2E validation
  const handlePrimaryChange = useCallback(async (providerName: string) => {
    if (isE2EEnabled()) {
      // Validate target has encryption key
      const provider = connectionStateManager.getProvider(providerName);
      if (provider) {
        try {
          await provider.download('encryption-key.json');
        } catch {
          toast({
            title: t('storage.noEncryptionKey'),
            description: t('storage.copyKeyFirst'),
            variant: 'destructive',
          });
          return;
        }
      }
    }
    connectionStateManager.setPreferredPrimaryProvider(providerName);
    setPrimaryProviderName(providerName);
    toast({
      title: t('storage.primaryChanged', { provider: providerName }),
    });
  }, [toast, t]);
  
  // Check if password is stored on mount
  useEffect(() => {
    const checkPassword = async () => {
      const stored = hasStoredPassword();
      const hasMasterKey = storageServiceV2.getMasterKey() !== null;
      const isSet = stored || hasMasterKey;
      setPasswordSet(isSet);
      if (import.meta.env.DEV) console.log('🔐 Password set status:', { stored, hasMasterKey, isSet });
    };
    checkPassword();
  }, []);
  
  // Listen for encryption state changes from other components
  useEffect(() => {
    const handleEncryptionStateChanged = () => {
      // CRITICAL: Always read from localStorage (source of truth)
      const currentMode = getEncryptionMode();
      const currentKey = storageServiceV2.getMasterKey();
      const storedPwd = hasStoredPassword();
      
      if (import.meta.env.DEV) {
        console.log('🔄 [StorageSecuritySettings] Encryption state changed:', { 
          mode: currentMode, 
          hasMasterKey: !!currentKey,
          hasStoredPassword: storedPwd
        });
      }
      
      setEncryptionModeState(currentMode);
      setMasterKey(currentKey);
      setPasswordSet(storedPwd || !!currentKey);
    };
    
    window.addEventListener('encryption-state-changed', handleEncryptionStateChanged);
    return () => window.removeEventListener('encryption-state-changed', handleEncryptionStateChanged);
  }, []);
  
  const handleEncryptionModeChange = async (newMode: 'simple' | 'e2e') => {
    if (encryptionMode === newMode) return;
    
    // CRITICAL: Block E2E selection if connected in Simple mode (use reactive state)
    if (newMode === 'e2e' && encryptionMode === 'simple' && cloudConnectedCount > 0) {
      toast({
        title: t('storage.cannotSwitchToE2E'),
        description: t('storage.disconnectFirst'),
        variant: 'destructive',
      });
      return;
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
    
    // CRITICAL FIX: Persist mode IMMEDIATELY when user selects it
    // This ensures the mode persists even if initialization is pending
    setEncryptionMode(newMode);
    setEncryptionModeState(newMode);
    
    // Check if there are existing entries
    let existingEntries: any[] = [];
    try {
      existingEntries = await storageServiceV2.getAllEntries();
    } catch (error) {
      if (import.meta.env.DEV) console.log('Could not check entries:', error);
      // If we can't read entries, we'll check during migration
    }
    
    if (newMode === 'e2e') {
      // Switching to E2E mode - mode already persisted above
      
      // Check if password already exists
      const storedPassword = await retrievePassword();
      
      if (storedPassword) {
        // Password exists - auto-initialize
        try {
          setIsInitializing(true);
          await storageServiceV2.initialize(storedPassword);
          const key = storageServiceV2.getMasterKey();
          if (key) {
            setMasterKey(key);
            
            // If there are entries, migrate them to E2E
            if (existingEntries.length > 0) {
              setMigrationDirection('simple-to-e2e');
              setPendingModeSwitch('e2e');
              setShowMigrationDialog(true);
              runMigration('simple-to-e2e', key);
            } else {
              // Migrate credentials only
              await connectionStateManager.migrateCredentialsForModeChange('simple', 'e2e', key);
              toast({
                title: t('storage.e2eEnabled'),
                description: t('storage.e2eEnabledDesc'),
              });
            }
          }
        } catch (error) {
          if (import.meta.env.DEV) console.error('Failed to initialize with stored password:', error);
          setShowPasswordDialog(true);
        } finally {
          setIsInitializing(false);
        }
      } else if (!masterKey) {
        // No stored password - need to set one
        // Store pending entries count for migration after password set
        if (existingEntries.length > 0) {
          setPendingModeSwitch('e2e');
        }
        toast({
          title: t('storage.passwordRequired'),
          description: t('storage.passwordRequiredDesc'),
        });
        setShowPasswordDialog(true);
      }
    } else if (newMode === 'simple') {
      // Switching to Simple mode - mode already persisted above
      if (existingEntries.length > 0 && masterKey) {
        // Need to decrypt entries first
        setMigrationDirection('e2e-to-simple');
        setPendingModeSwitch('simple');
        setShowMigrationDialog(true);
        runMigration('e2e-to-simple', masterKey);
      } else {
        // No entries or no master key - just complete the switch
        storageServiceV2.clearMasterKey();
        setMasterKey(null);
        toast({
          title: t('storage.simpleModeEnabled'),
          description: t('storage.simpleModeEnabledDesc'),
        });
      }
    }
  };
  
  // Run migration process
  const runMigration = async (direction: 'simple-to-e2e' | 'e2e-to-simple', key: CryptoKey) => {
    setMigrationProgress({
      phase: 'preparing',
      currentItem: 0,
      totalItems: 0,
      migratedCount: 0,
      failedCount: 0,
    });
    
    try {
      // Get entry count
      const entries = await storageServiceV2.getAllEntries();
      const totalEntries = entries.length;
      
      setMigrationProgress(prev => ({
        ...prev,
        phase: 'entries',
        totalItems: totalEntries,
      }));
      
      // Run the appropriate migration
      let result: { migrated: number; skipped: number; failed: number };
      
      if (direction === 'simple-to-e2e') {
        result = await storageServiceV2.migrateEntriesToE2E();
      } else {
        result = await storageServiceV2.migrateEntriesToSimple();
      }
      
      setMigrationProgress(prev => ({
        ...prev,
        currentItem: totalEntries,
        migratedCount: result.migrated + result.skipped,
        failedCount: result.failed,
        phase: 'credentials',
      }));
      
      // Migrate credentials
      const credResult = await connectionStateManager.migrateCredentialsForModeChange(
        direction === 'simple-to-e2e' ? 'simple' : 'e2e',
        direction === 'simple-to-e2e' ? 'e2e' : 'simple',
        key
      );
      
      setMigrationProgress(prev => ({
        ...prev,
        phase: 'complete',
      }));
      
      // Complete the mode switch
      const targetMode = direction === 'simple-to-e2e' ? 'e2e' : 'simple';
      await completeModeSwitch(targetMode);
      
    } catch (error) {
      if (import.meta.env.DEV) console.error('Migration failed:', error);
      setMigrationProgress(prev => ({
        ...prev,
        phase: 'error',
        errorMessage: error instanceof Error ? error.message : t('common.unknownError'),
      }));
    }
  };
  
  // Complete the mode switch after migration
  const completeModeSwitch = async (mode: 'simple' | 'e2e') => {
    if (mode === 'simple') {
      setEncryptionMode('simple');
      setEncryptionModeState('simple');
      storageServiceV2.clearMasterKey();
      setMasterKey(null);
      toast({
        title: t('storage.simpleModeEnabled'),
        description: t('storage.simpleModeEnabledDesc'),
      });
    } else {
      setEncryptionMode('e2e');
      setEncryptionModeState('e2e');
      toast({
        title: t('storage.e2eEnabled'),
        description: t('storage.e2eEnabledDesc'),
      });
    }
    setPendingModeSwitch(null);
  };
  
  // Sync masterKey state with storageServiceV2 on mount and when it changes
  useEffect(() => {
    let lastKeyValue: string | null = null;
    const syncMasterKey = () => {
      const existingKey = storageServiceV2.getMasterKey();
      if (existingKey) {
        if (existingKey !== lastKeyValue) {
          if (import.meta.env.DEV) console.log('🔑 Syncing master key from storage service to StorageSecuritySettings');
          lastKeyValue = existingKey;
        }
        setMasterKey(existingKey);
      } else {
        if (lastKeyValue !== null) {
          if (import.meta.env.DEV) console.log('ℹ️ No master key in storage service yet');
        }
        lastKeyValue = null;
      }
    };
    syncMasterKey();
    const interval = setInterval(syncMasterKey, 500);
    return () => clearInterval(interval);
  }, []);
  
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
  const createConfigChangeHandler = (providerName: string, displayName: string) => {
    return (connected: boolean, isOAuthComplete?: boolean) => {
      // Track connection state
      const wasConnected = connectedProviders[providerName] || false;
      
      // CRITICAL FIX: Capture connected count BEFORE any state updates
      // This is used later to determine if this is the first provider
      const countBeforeThisConnection = connectionStateManager.getConnectedCount();
      
      // Update connected state immediately
      setConnectedProviders(prev => ({ ...prev, [providerName]: connected }));
      
      // CRITICAL: Force re-query from manager after short delay to ensure UI sync
      if (connected) {
        setTimeout(() => {
          const names = connectionStateManager.getConnectedProviderNames();
          const primary = connectionStateManager.getPrimaryProviderName();
          if (import.meta.env.DEV) {
            console.log('🔄 [StorageSecuritySettings] Forced refresh after connect:', { names, primary });
          }
          setConnectedProviders({
            googledrive: names.includes('Google Drive'),
            icloud: names.includes('iCloud'),
            dropbox: names.includes('Dropbox'),
            nextcloud: names.includes('Nextcloud'),
          });
          setPrimaryProviderName(primary);
        }, 150);
      }
      
      // CRITICAL FIX: If this is an OAuth completion, treat as new connection regardless of mountedProvidersRef
      // This fixes the issue where OAuth redirect causes component remount before callback completes
      if (isOAuthComplete && connected) {
        // Clear from mounted providers to ensure it's treated as new
        mountedProvidersRef.current!.delete(providerName);
        if (import.meta.env.DEV) console.log(`🔐 ${displayName}: OAuth complete - treating as new connection`);
      }
      
      // ONLY act on TRUE new connections (was false, now true, AND not a remount)
      const isNewConnection = !wasConnected && connected && !mountedProvidersRef.current!.has(providerName);
      
      // Track that we've seen this provider to prevent remount triggers
      if (connected) {
        mountedProvidersRef.current!.add(providerName);
      }
      
      if (!isNewConnection) {
        // This is just a remount or state update, skip
        if (import.meta.env.DEV) console.log(`ℹ️ ${displayName}: No action needed (connected=${connected}, was=${wasConnected}, seen=${mountedProvidersRef.current!.has(providerName)})`);
        return;
      }
      
      if (import.meta.env.DEV) console.log(`🆕 ${displayName}: TRUE NEW CONNECTION detected (count before: ${countBeforeThisConnection}) - will trigger sync`);
      
      // New connection detected! Check encryption mode and master key
      const currentMode = getEncryptionMode();
      
      // CRITICAL: Check if we're in pending-oauth state first
      // In this state, password is already stored - just call onCloudProviderConnected
      if (currentMode === 'e2e' && storageServiceV2.isPendingOAuth) {
        if (import.meta.env.DEV) console.log(`🔑 ${displayName}: Completing deferred E2E initialization...`);
        // onCloudProviderConnected will use the stored pendingE2EPassword
        // This is handled in the sync block below
      } else if (currentMode === 'e2e' && !masterKey) {
        // E2E mode but no master key and NOT pending OAuth - show password dialog
        if (import.meta.env.DEV) console.log(`🔐 ${displayName} connected in E2E mode but no master key - requesting password`);
        handleRequirePassword();
        return;
      }
      
      // Check if we can sync (different logic for Simple vs E2E mode)
      const canSync = storageServiceV2.canInitialSync();
      const syncedThisSession = hasSyncedInSession(providerName);
      
      // CRITICAL FIX: Use the count captured BEFORE this provider was added
      // This was the first provider if there were 0 connected before, or 1 after registration
      const isPrimaryProvider = connectionStateManager.isPrimaryProvider(displayName);
      const isFirstProvider = countBeforeThisConnection === 0 || countBeforeThisConnection === 1;
      
      // Only sync if: this is the first/only provider, OR it's already marked as primary
      const shouldAutoSync = isFirstProvider || isPrimaryProvider;
      
      if (canSync && !syncedThisSession && shouldAutoSync) {
        if (import.meta.env.DEV) console.log(`🚀 Auto-sync for ${displayName} (primary/first provider, mode=${currentMode})`);
        toast({ title: t('storage.syncing'), description: t('storage.syncingDesc', { provider: displayName }) });
        markSyncedInSession(providerName);
        
        // Add small delay to ensure window binding is fully set up
        setTimeout(async () => {
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
              description: t('storage.syncedDesc', { provider: displayName, count: entryCount }),
            });
          } catch (error) {
            syncedInSession.current.delete(providerName);
            const desc = error instanceof Error ? translateCloudError(error, t) : t('storage.syncFailedDesc', { provider: displayName });
            // Message-based fallback: show Nextcloud guide when error is wrapped (e.g. "Failed to update sync state: CLOUD_ENCRYPTION_ERROR: ...")
            const msg = (error instanceof Error && error.message) ? error.message.toLowerCase() : '';
            const isSyncStateEncryption = msg.includes('sync-state') && (msg.includes('cloud_encryption_error') || msg.includes('encryption'));
            const guideTitle = t('index.nextcloudEncryptionError');
            const guideDesc = t('index.nextcloudEncryptionErrorDesc');
            const title = isNextcloudEncryptionError(error) || desc === guideDesc || isSyncStateEncryption
              ? guideTitle
              : t('storage.syncFailed');
            const description = title === guideTitle ? guideDesc : desc;
            const isNcGuide = title === guideTitle;
            toast({
              title,
              description,
              variant: 'destructive',
              ...(isNcGuide ? {
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
        }, 100);
      } else if (!shouldAutoSync && canSync) {
        // Connected as secondary provider - show appropriate message
        if (import.meta.env.DEV) console.log(`ℹ️ ${displayName} connected as secondary provider - no auto-sync`);
        toast({ 
          title: t('storage.connectedAsBackup'),
          description: t('storage.setAsPrimaryToSync', { provider: displayName }),
        });
      }
    };
  };
  
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
    await encryptionStateManager.requestPasswordIfNeeded('StorageSecuritySettings-handleRequirePassword');
  };
  
  // Handle password set - initialize storage service
  const handlePasswordSet = async (password: string) => {
    if (isInitializing) {
      if (import.meta.env.DEV) console.warn('Password initialization already in progress');
      throw new Error('Initialization in progress');
    }
    
    setIsInitializing(true);
    try {
      // CRITICAL: Persist E2E mode BEFORE calling initialize()
      // so that isE2EEnabled() returns true and master key is created
      setEncryptionMode('e2e');
      setEncryptionModeState('e2e');
      
      if (import.meta.env.DEV) console.log('🔐 Initializing storage with password in E2E mode...');
      await storageServiceV2.initialize(password);
      
      // CRITICAL: Check for pending-oauth state FIRST
      // In this state, password is stored but master key won't exist until OAuth completes
      if (storageServiceV2.isPendingOAuth) {
        if (import.meta.env.DEV) console.log('⏳ Initialization in pending-oauth state - password stored for later');
        
        await storePassword(password);
        setShowPasswordDialog(false);
        toast({
          title: t('storage.passwordStoredSecurely'),
          description: t('storage.awaitingOAuthComplete', 'Password saved. Connection will complete after cloud authorization.'),
        });
        return;
      }
      
      // Not pending-oauth - expect master key immediately; use exponential backoff retry
      let newMasterKey: CryptoKey | null = null;
      const maxAttempts = 5;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        newMasterKey = storageServiceV2.getMasterKey();
        if (newMasterKey) break;
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
      setPasswordSet(true);
      
      // Close dialog immediately - don't wait for async operations
      setShowPasswordDialog(false);
      
      // Dispatch encryption-initialized event to trigger re-sync in Index.tsx
      window.dispatchEvent(new CustomEvent('encryption-initialized', { 
        detail: { hasMasterKey: true } 
      }));
      
      // Check if we have pending entry migration (Simple→E2E with existing entries)
      if (pendingModeSwitch === 'e2e') {
        try {
          const entries = await storageServiceV2.getAllEntries();
          if (entries.length > 0) {
            // Start migration with the new key
            setMigrationDirection('simple-to-e2e');
            setShowMigrationDialog(true);
            runMigration('simple-to-e2e', newMasterKey);
            return; // Don't show success toast yet, migration dialog will handle it
          }
        } catch (e) {
          if (import.meta.env.DEV) console.log('No entries to migrate');
        }
        // Migrate credentials even if no entries
        await connectionStateManager.migrateCredentialsForModeChange('simple', 'e2e', newMasterKey);
        setPendingModeSwitch(null);
      }
      
      // Show success after a brief moment (don't block dialog close)
      setTimeout(() => {
        toast({
          title: t('storage.passwordSaved'),
          description: t('storage.passwordSavedDesc'),
        });
      }, 100);
      
    } catch (error) {
      if (import.meta.env.DEV) console.error('Password set error:', error);
      
      // CRITICAL: Use encryptionStateManager for proper error handling
      // Only clear password on DECRYPTION_FAILED, not on other errors
      const { encryptionStateManager } = await import('@/services/encryptionStateManager');
      const { passwordCleared } = encryptionStateManager.handleInitializationError(
        error instanceof Error ? error : new Error(String(error))
      );
      
      if (passwordCleared) {
        // Password was wrong - rollback to simple mode
        setEncryptionMode('simple');
        setEncryptionModeState('simple');
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
        const errorMessage = error instanceof Error ? error.message : t('common.unknownError');
        toast({
          title: t('auth.authError'),
          description: errorMessage,
          variant: "destructive",
        });
      }
      
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
        title: t('storage.startingFresh'),
        description: t('storage.startingFreshDesc'),
      });
      setShowCloudEncryptedDialog(false);
    } catch (error) {
      const desc = error instanceof Error ? translateCloudError(error, t) : t('storage.errorDesc');
      const isNcEnc = isNextcloudEncryptionError(error);
      toast({
        title: isNcEnc ? t('index.nextcloudEncryptionError') : t('storage.error'),
        description: desc,
        variant: "destructive",
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
  
  // REMOVED: handleClearPassword function - feature removed to prevent accidental data loss
  // Users should use "Change Password" if they know their password, or "DELETE All Data" to start fresh
  
  const handlePasswordPersistenceChange = async (mode: PasswordPersistenceMode) => {
    try {
      // Update settings first
      setPasswordPersistenceMode(mode);
      setPasswordPersistence(mode);
      
      // Migrate existing password to new storage
      await migratePasswordToMode(mode);
      
      toast({
        title: t('storage.passwordPersistenceChanged'),
        description: t(`storage.passwordPersistence.${mode}Desc`),
      });
      
      if (import.meta.env.DEV) {
        console.log(`🔐 Password persistence mode changed to: ${mode}`);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to change password persistence mode:', error);
      toast({
        title: t('common.error'),
        description: t('storage.passwordPersistenceError'),
        variant: "destructive",
      });
    }
  };
  
  const handleResetKey = async () => {
    if (newPassword.length < 12) {
      toast({
        title: t('encryption.passwordTooShort'),
        description: t('encryption.passwordTooShortDesc'),
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t('encryption.passwordsDontMatch'),
        description: t('encryption.passwordsDontMatchDesc'),
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);
    try {
      await storageServiceV2.changePassword(oldPassword, newPassword);
      
      // Clear stored Nextcloud credentials as they were encrypted with the old key
      CloudCredentialStorage.clearCredentials('nextcloud');
      SimpleModeCredentialStorage.clearNextcloudCredentials();
      
      toast({
        title: t('encryption.passwordChanged'),
        description: t('encryption.passwordChangedDesc'),
      });
      
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      onResetComplete?.();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to change password:', error);
      const isIncorrectPassword = error instanceof Error &&
        (error.message.toLowerCase().includes('incorrect') || error.message.includes('DECRYPTION_FAILED'));
      toast({
        title: isIncorrectPassword ? t('encryption.incorrectPassword') : t('encryption.changeFailed'),
        description: isIncorrectPassword ? t('encryption.incorrectPasswordDesc') : t('encryption.changeFailedDesc'),
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };
  
  // Handle resetting all data (dangerous operation)
  const handleResetAllData = async () => {
    if (confirmText !== SAFETY_CONSTANTS.DELETE_CONFIRMATION) {
      toast({
        title: t('encryption.confirmationRequired'),
        description: t('storage.confirmationRequiredDesc'),
        variant: "destructive",
      });
      return;
    }
    
    setIsDeleting(true);
    setDeletionProgress(null);
    try {
      // Delete all entries (with progress for UI)
      await storageServiceV2.deleteAllEntries((progress) => setDeletionProgress(progress));
      
      // CRITICAL FIX: Clear cached encryption key to prevent stale data
      // This ensures that when user re-enables E2E, a fresh key is generated and cached
      await storageServiceV2.clearCachedEncryptionKey();
      
      // Clear stored password and Nextcloud credentials
      await clearPassword();
      CloudCredentialStorage.clearCredentials('nextcloud');
      SimpleModeCredentialStorage.clearNextcloudCredentials();
      
      // Clear master key
      storageServiceV2.clearMasterKey();
      setMasterKey(null);
      setPasswordSet(false);
      
      // Reset to simple mode
      setEncryptionMode('simple');
      setEncryptionModeState('simple');
      
      setConfirmText("");

      // Disconnect all cloud providers and clear their credentials so reload does not reconnect
      const providerNames = [...connectionStateManager.getConnectedProviderNames()];
      for (const name of providerNames) {
        try {
          const service = connectionStateManager.getProvider(name);
          connectionStateManager.unregisterProvider(name);
          const disconnectFn = (service as { disconnect?: () => void | Promise<void> })?.disconnect;
          if (disconnectFn) {
            try { await Promise.resolve(disconnectFn.call(service)); } catch {}
          }
          if (name === 'Google Drive') {
            CloudCredentialStorage.clearCredentials('google-drive');
            SimpleModeCredentialStorage.clearGoogleDriveCredentials();
          } else if (name === 'Dropbox') {
            CloudCredentialStorage.clearCredentials('dropbox');
            SimpleModeCredentialStorage.clearDropboxCredentials();
          } else if (name === 'Nextcloud') {
            CloudCredentialStorage.clearCredentials('nextcloud');
            localStorage.removeItem('nextcloud_simple_credentials');
          } else if (name === 'iCloud') {
            CloudCredentialStorage.clearCredentials('icloud');
            SimpleModeCredentialStorage.clearICloudCredentials();
          }
        } catch (e) {
          if (import.meta.env.DEV) console.warn('Failed to disconnect provider on reset:', name, e);
        }
      }
      
      toast({
        title: t('storage.allDataDeleted'),
        description: t('storage.allDataDeletedDesc'),
      });
      
      onDeleteAllComplete?.();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to reset data:', error);
      const resetDesc = error instanceof Error ? translateCloudError(error, t) : t('storage.resetFailedDesc');
      const isNcReset = isNextcloudEncryptionError(error);
      toast({
        title: isNcReset ? t('index.nextcloudEncryptionError') : t('storage.resetFailed'),
        description: resetDesc,
        variant: "destructive",
        ...(isNcReset ? {
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
    } finally {
      setIsDeleting(false);
      setDeletionProgress(null);
    }
  };
  
  return (
    <div className="space-y-6">
      <JournalPasswordDialog
        open={showPasswordDialog}
        onOpenChange={(open) => {
          // Only allow closing if not initializing
          if (!isInitializing) {
            setShowPasswordDialog(open);
          }
        }}
        onPasswordSet={handlePasswordSet}
        onDismiss={() => {
          // Close dialog
          setShowPasswordDialog(false);
          
          // Revert to simple mode since password wasn't set
          setEncryptionMode('simple');
          setEncryptionModeState('simple');
          
          // Dispatch event to clear any pending connection state
          window.dispatchEvent(new CustomEvent('password-dialog-cancelled'));
          
          toast({
            title: t('storage.simpleMode'),
            description: t('storage.e2eModeCancelled'),
          });
          
          if (import.meta.env.DEV) console.log('🔔 Password dialog cancelled - reverted to simple mode');
        }}
      />
      
      <CloudEncryptedDataDialog
        open={showCloudEncryptedDialog}
        onOpenChange={setShowCloudEncryptedDialog}
        onDisconnect={handleDisconnectForE2E}
        onStartFresh={handleStartFresh}
      />
      
      <MigrationProgressDialog
        open={showMigrationDialog}
        onOpenChange={setShowMigrationDialog}
        progress={migrationProgress}
        direction={migrationDirection}
        onComplete={() => {
          setPendingModeSwitch(null);
        }}
        onRetry={() => {
          const key = storageServiceV2.getMasterKey();
          if (key) {
            runMigration(migrationDirection, key);
          }
        }}
      />
      
      {/* Encryption & Password Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('storage.encryptionPassword')}</h3>
        </div>
        
        {/* Encryption Mode Selector */}
        <div className="tour-encryption-mode space-y-4 p-4 bg-muted/50 rounded-lg border">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('storage.encryptionMode')}</p>
            <p className="text-xs text-muted-foreground">
              {t('storage.encryptionModeDesc')}
            </p>
          </div>
          
          <RadioGroup value={encryptionMode} onValueChange={handleEncryptionModeChange}>
            <div className="space-y-3">
              <div className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                (encryptionMode === 'e2e' && passwordSet) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
              }`}>
                <RadioGroupItem 
                  value="simple" 
                  id="mode-simple" 
                  className="mt-1" 
                  disabled={encryptionMode === 'e2e' && passwordSet}
                />
                <div className="space-y-1 flex-1">
                  <Label 
                    htmlFor="mode-simple" 
                    className={`text-sm font-medium ${
                      (encryptionMode === 'e2e' && passwordSet) ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {t('storage.simpleMode')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('storage.simpleModeDesc')}
                  </p>
                  {encryptionMode === 'e2e' && passwordSet && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
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
                  <Label 
                    htmlFor="mode-e2e" 
                    className={`text-sm font-medium ${
                      encryptionMode === 'simple' && cloudConnectedCount > 0 ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {t('storage.e2eMode')}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t('storage.e2eModeDesc')}
                  </p>
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
        
        {/* Password Management - only show in E2E mode */}
        {encryptionMode === 'e2e' && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">{t('storage.passwordManagement')}</p>
            </div>
            
            {passwordSet ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {t('storage.passwordStoredSecurely')}
                </p>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        {t('storage.forgotPassword')}
                      </p>
                      <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                        <li>{t('storage.forgotPasswordOption1')}</li>
                        <li>{t('storage.forgotPasswordOption2')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t('storage.passwordNotSet')}
                </p>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setShowPasswordDialog(true)}
                >
                  <Key className="h-4 w-4 mr-2" />
                  {t('encryption.setPassword')}
                </Button>
              </div>
            )}
            
            {/* Password Persistence Setting */}
            <Separator className="my-3" />
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t('storage.passwordPersistence.title')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('storage.passwordPersistence.description')}
                </p>
              </div>
              
              <Select value={passwordPersistence} onValueChange={(v) => handlePasswordPersistenceChange(v as PasswordPersistenceMode)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="localStorage">
                    <div className="flex flex-col items-start">
                      <span>{t('storage.passwordPersistence.localStorage')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="sessionStorage">
                    <div className="flex flex-col items-start">
                      <span>{t('storage.passwordPersistence.sessionStorage')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="none">
                    <div className="flex flex-col items-start">
                      <span>{t('storage.passwordPersistence.none')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              <p className="text-xs text-muted-foreground italic">
                {passwordPersistence === 'localStorage' && t('storage.passwordPersistence.localStorageHint')}
                {passwordPersistence === 'sessionStorage' && t('storage.passwordPersistence.sessionStorageHint')}
                {passwordPersistence === 'none' && t('storage.passwordPersistence.noneHint')}
              </p>
            </div>
          </div>
        )}
        
        {/* Reset Password - only show in E2E mode */}
        {encryptionMode === 'e2e' && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">{t('storage.changePassword')}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('storage.changePasswordDesc')}
            </p>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="old-password">{t('encryption.currentPassword')}</Label>
                <div className="relative">
                  <Input
                    id="old-password"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder={t('encryption.currentPasswordPlaceholder')}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    disabled={isResetting}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('encryption.newPassword')}</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder={t('encryption.newPasswordPlaceholder')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isResetting}
                    minLength={12}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">{t('encryption.confirmNewPassword')}</Label>
                <div className="relative">
                  <Input
                    id="confirm-new-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={t('encryption.confirmNewPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isResetting}
                    minLength={12}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                disabled={!oldPassword || !newPassword || !confirmPassword || isResetting}
                className="w-full"
                onClick={() => {
                  if (window.confirm(t('storage.changePasswordConfirm'))) {
                    handleResetKey();
                  }
                }}
              >
                {isResetting ? t('encryption.resetting') : t('storage.changePassword')}
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <Separator />
      
      {/* Cloud Storage Providers Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{t('storage.cloudStorage')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('storage.cloudStorageDesc', { mode: encryptionMode === 'e2e' ? t('storage.e2eEncrypted') : t('storage.storedWithoutEncryption') })}
        </p>
        
        {/* Active Provider Selector - only show when 2+ providers connected */}
        {Object.values(connectedProviders).filter(Boolean).length >= 2 && (
          <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              {t('storage.activeProvider')}
            </Label>
            <Select value={primaryProviderName || ''} onValueChange={handlePrimaryChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('storage.selectActiveProvider')} />
              </SelectTrigger>
              <SelectContent>
                {connectedProviders.googledrive && (
                  <SelectItem value="Google Drive">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Google Drive
                    </div>
                  </SelectItem>
                )}
                {connectedProviders.icloud && (
                  <SelectItem value="iCloud">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      iCloud
                    </div>
                  </SelectItem>
                )}
                {connectedProviders.dropbox && (
                  <SelectItem value="Dropbox">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Dropbox
                    </div>
                  </SelectItem>
                )}
                {connectedProviders.nextcloud && (
                  <SelectItem value="Nextcloud">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Nextcloud
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('storage.activeProviderDesc')}</p>
          </div>
        )}
        
        <div className="tour-cloud-providers space-y-3">
          <GoogleDriveSync masterKey={masterKey} onRequirePassword={handleRequirePassword} onConfigChange={createConfigChangeHandler('googledrive', 'Google Drive')} isPrimary={primaryProviderName === 'Google Drive'} />
          {FEATURES.ICLOUD_ENABLED && (
            <ICloudSync
              masterKey={masterKey}
              onRequirePassword={handleRequirePassword}
              onConfigChange={createConfigChangeHandler('icloud', 'iCloud')}
              isPrimary={primaryProviderName === 'iCloud'}
            />
          )}
          <DropboxSync masterKey={masterKey} onRequirePassword={handleRequirePassword} onConfigChange={createConfigChangeHandler('dropbox', 'Dropbox')} isPrimary={primaryProviderName === 'Dropbox'} />
          <NextcloudSync masterKey={masterKey} onRequirePassword={handleRequirePassword} onConfigChange={createConfigChangeHandler('nextcloud', 'Nextcloud')} isPrimary={primaryProviderName === 'Nextcloud'} />
        </div>
      </div>
      
      <Separator />
      
      {/* Provider Transfer Section */}
      <div className="space-y-4">
        <ProviderTransfer />
      </div>
      
      <Separator />
      
      {/* Danger Zone */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold text-destructive">{t('storage.dangerZone')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('storage.dangerZoneDesc')}
        </p>
        
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">{t('encryption.warningPermanent')}</p>
              <p className="text-xs text-destructive/90 mt-1">
                {t('encryption.warningPermanentDesc')}
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">{t('storage.confirmReset')}</Label>
            <Input
              id="confirm-delete"
              placeholder={SAFETY_CONSTANTS.DELETE_CONFIRMATION}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isDeleting}
            />
          </div>
          
          {isDeleting && deletionProgress && (
            <div className="space-y-2">
              <Progress
                value={deletionProgress.total > 0 ? Math.round((deletionProgress.current / deletionProgress.total) * 100) : 0}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {deletionProgress.phase === 'local'
                  ? t('settings.deleteAccount.deletingLocal')
                  : t('settings.deleteAccount.deletingCloud', { current: deletionProgress.current, total: deletionProgress.total })}
              </p>
            </div>
          )}
          
          <Button 
            variant="destructive" 
            disabled={confirmText !== SAFETY_CONSTANTS.DELETE_CONFIRMATION || isDeleting}
            className="w-full"
            onClick={() => {
              if (window.confirm(t('storage.finalConfirm'))) {
                handleResetAllData();
              }
            }}
          >
            {isDeleting ? t('encryption.deleting') : t('storage.resetButton')}
          </Button>
        </div>
      </div>
    </div>
  );
};
