import { saveAs } from "file-saver";
import { isNativePlatform, saveJsonBackupNative, shareFileNative } from "@/utils/nativeExport";
import { Share2 } from "lucide-react";
import i18n from "@/i18n/config";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "@/components/layout/Header";
import { Timeline } from "@/components/journal/Timeline";
import { TrendAnalysis } from "@/components/journal/TrendAnalysis";
import { MoodCalendar } from "@/components/journal/MoodCalendar";
import { MoodStats } from "@/components/journal/MoodStats";
import { MoodCorrelations } from "@/components/journal/MoodCorrelations";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { SubscriptionBanner } from "@/components/subscription/SubscriptionBanner";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { JournalEntryData } from "@/components/journal/JournalEntry";
import { ExportDialog } from "@/components/journal/ExportDialog";
import { useToast } from "@/hooks/use-toast";
import { storageServiceV2 } from "@/services/storageServiceV2";
import { encryptionStateManager } from "@/services/encryptionStateManager";
import { JournalPasswordDialog } from "@/components/auth/JournalPasswordDialog";
import { PasswordRecoveryDialog } from "@/components/settings/PasswordRecoveryDialog";
import { cloudStorageService } from "@/services/cloudStorageService";
import { SUPABASE_CONFIG } from "@/config/supabase";
import { buildAppLink } from "@/config/app";
import { aiCacheService } from "@/services/aiCacheService";
import { connectionStateManager } from "@/services/connectionStateManager";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { retrievePassword, clearPassword, storePassword } from "@/utils/passwordStorage";
import { journalNameStorage } from "@/utils/journalNameStorage";
import { setCurrentUserId, getCurrentUserId, migrateLocalStorageToUserScope, clearUnscopedUserData, scopedKey } from "@/utils/userScope";
import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { HelpDialog } from "@/components/help/HelpDialog";
import { SetNewPasswordDialog } from "@/components/auth/SetNewPasswordDialog";
import { SyncProgressBar } from "@/components/sync/SyncProgressBar";
import { translateCloudError } from "@/utils/translateCloudError";
import { isNextcloudEncryptionError } from "@/utils/cloudErrorCodes";
import { isInAppBrowser, getInAppBrowserName } from "@/utils/inAppBrowserDetection";
import { getCachedSubscription, setCachedSubscription } from "@/utils/subscriptionCache";
import { setSigningOut } from "@/utils/signOutState";

/** Sort entries by entry date (newest first), then createdAt, then id. Used for consistent list order. */
function sortEntriesByDateNewestFirst(entries: JournalEntryData[]): JournalEntryData[] {
  return [...entries].sort((a, b) => {
    const dateA = a.date?.getTime() || 0;
    const dateB = b.date?.getTime() || 0;
    if (dateB !== dateA) return dateB - dateA;
    const createdA = a.createdAt?.getTime() || 0;
    const createdB = b.createdAt?.getTime() || 0;
    if (createdB !== createdA) return createdB - createdA;
    return b.id.localeCompare(a.id);
  });
}

const Index = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<JournalEntryData[]>([]);
  const sortedEntries = useMemo(() => sortEntriesByDateNewestFirst(entries), [entries]);
  const [user, setUser] = useState<{
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    isPro?: boolean;
  } | null>(null);
  const [session, setSession] = useState<{
    user: { id: string; email?: string };
    access_token: string;
    expires_at?: number;
  } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<string>("storage");
  const [needsJournalPassword, setNeedsJournalPassword] = useState(false);
  const [journalPassword, setJournalPassword] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error" | "offline">("idle");
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [passwordDialogDismissed, setPasswordDialogDismissed] = useState(false);
  const { toast } = useToast();
  // cloudSetupDone initial read uses unscoped key (user not known yet); the
  // useEffect below re-reads the scoped value once auth resolves.
  const [cloudSetupDone, setCloudSetupDone] = useState(() => {
    return localStorage.getItem("cloudSetupDone") === "true";
  });
  const [isPro, setIsPro] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [hasUsedTrial, setHasUsedTrial] = useState(true); // default true to avoid flashing trial CTA
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [journalName, setJournalName] = useState(() => journalNameStorage.getJournalName());
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [helpDialogInitialTab, setHelpDialogInitialTab] = useState<string | undefined>(undefined);
  const [helpDialogInitialAccordion, setHelpDialogInitialAccordion] = useState<string | undefined>(undefined);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showSetNewPasswordDialog, setShowSetNewPasswordDialog] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const recoverySuccessRef = useRef(false);
  const [isProgressBarExpanded, setIsProgressBarExpanded] = useState(false);
  
  // Recovery dialog state for decryption failures
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [decryptionFailureInfo, setDecryptionFailureInfo] = useState<{count: number; total: number; isKeyMismatch?: boolean} | null>(null);
  
  // State for encrypted entries detected in Simple mode
  const [encryptedEntriesInSimpleMode, setEncryptedEntriesInSimpleMode] = useState<{count: number} | null>(null);

  // Encryption ready state - tracks when entries can be safely decrypted
  const [encryptionReady, setEncryptionReady] = useState(() => {
    const state = encryptionStateManager.getState();
    return state.isReady || state.mode === 'simple';
  });

  // Ref to block entry loading during async initialization
  const initializingEncryptionRef = useRef(false);

  // Ref mirror of encryptionReady to avoid stale closures in callbacks
  const encryptionReadyRef = useRef(encryptionReady);

  // Startup sync coordinator - prevents parallel sync calls on hard refresh
  const startupSyncDoneRef = useRef(false);
  const startupSyncPromiseRef = useRef<Promise<void> | null>(null);

  // Track last failure count we showed in recovery dialog (only re-show when count increases)
  const recoveryLastShownCountRef = useRef(0);
  // Suppress one decryption-failures event after successful recovery so the dialog doesn't re-open
  const recoverySuccessSuppressDialogRef = useRef(false);

  // Debounce timer for event-driven entry reloads (prevents 4-5 redundant getAllEntries calls per sync)
  const reloadEntriesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedReloadEntries = useCallback((source: string) => {
    if (reloadEntriesTimerRef.current) {
      clearTimeout(reloadEntriesTimerRef.current);
    }
    reloadEntriesTimerRef.current = setTimeout(() => {
      reloadEntriesTimerRef.current = null;
      if (import.meta.env.DEV) console.log(`📚 [debounced] Reloading entries (triggered by: ${source})`);
      storageServiceV2
        .getAllEntries()
        .then((newEntries) => {
          if (import.meta.env.DEV) console.log(`✅ [debounced] Loaded ${newEntries.length} entries`);
          setEntries(newEntries);
        })
        .catch((err) => {
          if (import.meta.env.DEV) console.error("❌ [debounced] Failed to reload entries:", err);
        });
    }, 300);
  }, []);

  // Track if encrypted entries were detected during sync (to suppress normal sync toast)
  const encryptedEntriesDetectedRef = useRef(false);
  
  // Store encrypted entries count synchronously (React state is async)
  
  // Prevent duplicate handling of encryption-initialized event
  const handlingEncryptionInitRef = useRef(false);
  
  // Track if entries were just loaded by handleJournalPasswordSet (to skip redundant sync)
  const justLoadedEntriesRef = useRef(false);
  const encryptedEntriesCountRef = useRef<number>(0);

  // Onboarding state
  const {
    isComplete: onboardingComplete,
    showTour,
    tourStepIndex,
    setTourStepIndex,
    completeTour,
    skipTour,
    restartTour,
  } = useOnboarding();

  // Subscribe to encryption state changes
  useEffect(() => {
    const checkReady = () => {
      const state = encryptionStateManager.getState();
      setEncryptionReady(state.isReady || state.mode === 'simple');
    };
    
    const unsubscribe = encryptionStateManager.subscribe(checkReady);
    
    return () => unsubscribe();
  }, []);

  // Keep ref in sync with state so callbacks always see latest value
  useEffect(() => {
    encryptionReadyRef.current = encryptionReady;
  }, [encryptionReady]);

  // Auto-collapse progress bar when sync ends
  useEffect(() => {
    if (syncStatus !== 'syncing') {
      setIsProgressBarExpanded(false);
    }
  }, [syncStatus]);

  // Handle Stripe portal return on native apps via App Links
  useEffect(() => {
    // Only run on Capacitor (Android/iOS)
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
    if (!isCapacitor) return;
    
    let listenerHandle: { remove: () => void } | null = null;
    
    const setupPortalReturnListener = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const { Browser } = await import('@capacitor/browser');
        
        listenerHandle = await App.addListener('appUrlOpen', async (event) => {
          // Check if this is the portal return URL
          if (event.url.includes('/portal-return')) {
            if (import.meta.env.DEV) {
              console.log('🔗 Portal return URL intercepted:', event.url);
            }
            
            // Close the browser that was opened for Stripe portal
            try {
              await Browser.close();
            } catch (e) {
              // Browser might already be closed
            }
            
            // Navigate to home with portal_return flag to show success toast
            window.location.href = '/?portal_return=true';
          }
          
          // Check if this is a checkout success URL
          if (event.url.includes('/checkout-success')) {
            if (import.meta.env.DEV) {
              console.log('🔗 Checkout success URL intercepted:', event.url);
            }
            
            try {
              await Browser.close();
            } catch (e) {
              // Browser might already be closed
            }
            
            window.location.href = '/?checkout=success';
          }
          
          // Check if this is a checkout cancel URL
          if (event.url.includes('/checkout-cancel')) {
            if (import.meta.env.DEV) {
              console.log('🔗 Checkout cancel URL intercepted:', event.url);
            }
            
            try {
              await Browser.close();
            } catch (e) {
              // Browser might already be closed
            }
            
            window.location.href = '/?checkout=cancel';
          }
        });
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Failed to setup portal return listener:', error);
      }
    };
    
    setupPortalReturnListener();
    
    return () => {
      listenerHandle?.remove();
    };
  }, []);

  // Android back button handling - closes dialogs/drawers before navigating away
  useEffect(() => {
    // Only run on Capacitor (Android/iOS)
    if (!(window as unknown as { Capacitor?: unknown }).Capacitor) return;
    
    let listenerHandle: { remove: () => void } | null = null;
    
    const setupBackButton = async () => {
      try {
        const { App } = await import('@capacitor/app');
        listenerHandle = await App.addListener('backButton', ({ canGoBack }) => {
          // Priority 1: Close Help dialog
          if (showHelpDialog) {
            setShowHelpDialog(false);
            return;
          }
          // Priority 2: Close Settings drawer
          if (showSettings) {
            setShowSettings(false);
            return;
          }
          // Priority 3: Exit editing mode (dispatch event for JournalEntry to handle)
          if (isEditing) {
            window.dispatchEvent(new CustomEvent("app:back"));
            return;
          }
          // Default: Exit app if can't go back
          if (!canGoBack) {
            App.exitApp();
          }
        });
      } catch (error) {
        if (import.meta.env.DEV) console.warn('Failed to setup back button listener:', error);
      }
    };
    
    setupBackButton();
    
    return () => {
      listenerHandle?.remove();
    };
  }, [showHelpDialog, showSettings, isEditing]);

  // Listen for requests to open help dialog to a specific section (from toast actions in child components)
  useEffect(() => {
    const handleOpenHelp = (e: CustomEvent<{ tab: string; accordion?: string }>) => {
      setHelpDialogInitialTab(e.detail.tab);
      setHelpDialogInitialAccordion(e.detail.accordion);
      setShowHelpDialog(true);
    };
    window.addEventListener('open-help', handleOpenHelp as EventListener);
    return () => window.removeEventListener('open-help', handleOpenHelp as EventListener);
  }, []);

  // One-time cleanup of old tag cache after prompt update (v2 = Gemini 3 Flash strict language rules)
  useEffect(() => {
    const TAG_CACHE_VERSION = 'tag_cache_v2';
    const currentVersion = localStorage.getItem(scopedKey('tag_cache_version'));

    if (currentVersion !== TAG_CACHE_VERSION) {
      aiCacheService.clearTagsCache().then(() => {
        localStorage.setItem(scopedKey('tag_cache_version'), TAG_CACHE_VERSION);
        if (import.meta.env.DEV) {
          console.log('🧹 Tag cache cleared for new prompt version');
        }
      });
    }
  }, []);

  // Listen for settings storage open request from onboarding
  useEffect(() => {
    const handleOpenSettingsStorage = () => {
      setSettingsDefaultTab("storage");
      setShowSettings(true);
    };
    window.addEventListener('open-settings-storage', handleOpenSettingsStorage);
    return () => window.removeEventListener('open-settings-storage', handleOpenSettingsStorage);
  }, []);

  // Listen for close-settings event from onboarding flow
  // Track when onboarding completion requested Settings to stay closed
  const justCompletedOnboardingRef = useRef(false);
  
  useEffect(() => {
    const handleCloseSettings = () => {
      if (import.meta.env.DEV) console.log('🔄 [Index] Received close-settings event');
      
      // Check if this is from onboarding completion
      const justCompletedOnboarding = localStorage.getItem('just-completed-onboarding') === 'true';
      if (justCompletedOnboarding) {
        // Clear flag but remember to block Settings reopening for a moment
        localStorage.removeItem('just-completed-onboarding');
        justCompletedOnboardingRef.current = true;
        
        // Reset the block after 2 seconds
        setTimeout(() => {
          justCompletedOnboardingRef.current = false;
        }, 2000);
      }
      
      // Use requestAnimationFrame to ensure state update happens after current render cycle
      requestAnimationFrame(() => {
        setShowSettings(false);
      });
    };
    window.addEventListener('close-settings', handleCloseSettings);
    return () => window.removeEventListener('close-settings', handleCloseSettings);
  }, []);

  // Listen for journal name changes
  useEffect(() => {
    const handleJournalNameChange = (e: CustomEvent) => {
      setJournalName(e.detail.name);
    };
    window.addEventListener("journalNameChanged", handleJournalNameChange as EventListener);
    return () => window.removeEventListener("journalNameChanged", handleJournalNameChange as EventListener);
  }, []);


  // Coordinated startup sync - ensures only ONE sync runs during initialization
  const performStartupSync = async (): Promise<void> => {
    // Skip if already done
    if (startupSyncDoneRef.current) {
      if (import.meta.env.DEV) console.log('⏭️ Startup sync already done, skipping');
      return;
    }
    
    // Reuse existing promise if sync in progress
    if (startupSyncPromiseRef.current) {
      if (import.meta.env.DEV) console.log('⏭️ Reusing existing startup sync promise');
      return startupSyncPromiseRef.current;
    }
    
    const providers = connectionStateManager.getConnectedProviderNames();
    if (providers.length === 0) {
      if (import.meta.env.DEV) console.log('⏭️ No connected providers, skipping startup sync (will retry when provider connects)');
      return;
    }
    
    // Start new coordinated sync
    startupSyncPromiseRef.current = (async () => {
      try {
        if (import.meta.env.DEV) console.log('🚀 Starting coordinated startup sync...');
        setSyncStatus("syncing");
        await storageServiceV2.performFullSync();
        const entries = await storageServiceV2.getAllEntries();
        setEntries(entries);
        setSyncStatus("success");
        setLastSyncTime(new Date());
        if (import.meta.env.DEV) console.log(`✅ Startup sync complete: ${entries.length} entries`);
      } catch (error) {
        console.error('❌ Startup sync failed:', error);
        setSyncStatus("error");
      } finally {
        // Ensure auto-sync timer is running regardless of sync outcome
        // (covers the case where app started offline and no provider callback fired)
        storageServiceV2.ensureAutoSyncRunning();
        startupSyncDoneRef.current = true;
        startupSyncPromiseRef.current = null;
      }
    })();
    
    return startupSyncPromiseRef.current;
  };

  // Re-sync entries when encryption is initialized (e.g., after password set in E2E mode)
  // CRITICAL: Also ensures storage connections are established after password entry
  useEffect(() => {
    const handleEncryptionInitialized = async (event: CustomEvent<{ hasMasterKey: boolean }>) => {
      if (!event.detail.hasMasterKey) return;
      if (!user) return;
      
      // Prevent duplicate handling - skip if already in progress
      if (handlingEncryptionInitRef.current) {
        if (import.meta.env.DEV) console.log('⏭️ Already handling encryption-initialized, skipping');
        return;
      }
      
      // Skip if entries were just loaded by handleJournalPasswordSet (recovery flow)
      if (justLoadedEntriesRef.current) {
        if (import.meta.env.DEV) console.log('⏭️ Entries just loaded by password handler, skipping redundant sync');
        justLoadedEntriesRef.current = false;
        return;
      }
      
      handlingEncryptionInitRef.current = true;
      
      if (import.meta.env.DEV) console.log('🔐 Encryption initialized - ensuring connections and reloading entries...');
      
      try {
        // CRITICAL FIX: Get the master key that was just set and ensure connections
        const masterKey = storageServiceV2.getMasterKey();
        
        if (masterKey) {
          // Re-run ensureConnections now that we have the masterKey
          if (import.meta.env.DEV) console.log('🔄 Ensuring connections with masterKey after password entry');
          await connectionStateManager.ensureConnections(masterKey);
          setConnectedProviders(connectionStateManager.getConnectedProviderNames());
        }
        
        // Re-load entries now that we have the master key
        const loadedEntries = await storageServiceV2.getAllEntries();
        setEntries(loadedEntries);
        if (import.meta.env.DEV) console.log(`📚 Reloaded ${loadedEntries.length} entries after encryption init`);
        
        // Use coordinated startup sync
        await performStartupSync();
      } catch (error) {
        console.error('Failed to reload entries after encryption init:', error);
        setSyncStatus("error");
      } finally {
        handlingEncryptionInitRef.current = false;
      }
    };
    
    window.addEventListener('encryption-initialized', handleEncryptionInitialized as EventListener);
    return () => window.removeEventListener('encryption-initialized', handleEncryptionInitialized as EventListener);
  }, [user]);

  // Listen for explicit sync trigger (e.g., after OAuth connection or password set)
  useEffect(() => {
    lastProviderCountRef.current = connectionStateManager.getConnectedProviderNames().length;
    if (import.meta.env.DEV) console.log('[trigger-sync] Handler registered (first-connection toast fix active)');

    const handleTriggerSync = async () => {
      if (!user) {
        if (import.meta.env.DEV) console.log('⏭️ trigger-sync: No user, skipping');
        return;
      }
      
      const providers = connectionStateManager.getConnectedProviderNames();
      if (providers.length === 0) {
        if (import.meta.env.DEV) console.log('⏭️ trigger-sync: No providers, skipping');
        lastProviderCountRef.current = 0;
        return;
      }

      // Don't show our toast when we just went from 0 to 1+ (first-time effect or onCloudProviderConnected will show)
      const isFirstConnectionThisSession = lastProviderCountRef.current === 0 && providers.length >= 1;

      if (!navigator.onLine || storageServiceV2.getSyncStatus().status === 'offline') {
        if (import.meta.env.DEV) console.log('⏭️ trigger-sync: Offline, skipping');
        setSyncStatus('offline');
        return;
      }

      if (!cloudSetupDone) {
        if (import.meta.env.DEV) console.log('⏭️ trigger-sync skipped: first-time connection in progress (cloudSetupDone=false)');
        return;
      }

      if (firstTimeConnectionRef.current) {
        if (import.meta.env.DEV) console.log('⏭️ trigger-sync skipped: first connection (0→1 providers), first-time effect will show toast');
        return;
      }
      
      if (import.meta.env.DEV) console.log('🔄 Sync triggered by event, providers:', providers);
      setSyncStatus("syncing");
      
      try {
        await storageServiceV2.performFullSync();
        const syncedEntries = await storageServiceV2.getAllEntries();
        
        if (import.meta.env.DEV) {
          console.log(`✅ trigger-sync complete: ${syncedEntries.length} entries loaded`);
        }
        
        setEntries(syncedEntries);
        setSyncStatus("success");
        setLastSyncTime(new Date());
        lastProviderCountRef.current = providers.length;

        // Skip toast when this was the first connection (0→1); first-time effect or onCloudProviderConnected will show
        if (isFirstConnectionThisSession) {
          if (import.meta.env.DEV) console.log('⏭️ trigger-sync: first connection (0→1), skipping toast');
        } else if (encryptedEntriesDetectedRef.current) {
          encryptedEntriesDetectedRef.current = false;
          toast({
            title: t('sync.title'),
            description: t('index.syncCompleteWithEncrypted', { count: encryptedEntriesCountRef.current }),
            duration: 30000,
            action: (
              <ToastAction 
                altText={t('index.unlockNow', 'Unlock Now')}
                onClick={async () => {
                  const { setEncryptionMode } = await import('@/utils/encryptionModeStorage');
                  setEncryptionMode('e2e');
                  setNeedsJournalPassword(true);
                  setPasswordDialogDismissed(false);
                  window.dispatchEvent(new CustomEvent('encryption-mode-changed', { detail: { mode: 'e2e' } }));
                }}
              >
                {t('index.unlockNow', 'Unlock Now')}
              </ToastAction>
            ),
          });
        } else {
          // Normal sync complete toast
          toast({
            title: t('sync.title'),
            description: t('sync.description'),
          });
        }
      } catch (error) {
        console.error('Triggered sync failed:', error);
        setSyncStatus("error");
        lastProviderCountRef.current = providers.length;
        const desc = error instanceof Error ? translateCloudError(error, t) : t('common.error');
        const isNcEnc = isNextcloudEncryptionError(error);
        toast({
          title: isNcEnc ? t('index.nextcloudEncryptionError') : t('sync.failed'),
          description: desc,
          variant: 'destructive',
          ...(isNcEnc ? {
            duration: 30000,
            action: (
              <ToastAction
                altText={t('index.nextcloudEncryptionLearnMore')}
                onClick={() => {
                  setHelpDialogInitialTab('troubleshooting');
                  setHelpDialogInitialAccordion('nextcloud-encryption');
                  setShowHelpDialog(true);
                }}
              >
                {t('index.nextcloudEncryptionLearnMore')}
              </ToastAction>
            ),
          } : {}),
        });
      }
    };
    
    window.addEventListener('trigger-sync', handleTriggerSync);
    return () => window.removeEventListener('trigger-sync', handleTriggerSync);
  }, [user, toast, t, encryptedEntriesInSimpleMode, cloudSetupDone]);

  // Listen for decryption failures - show recovery dialog (after attempting auto-recovery for key mismatch)
  useEffect(() => {
    const handleDecryptionFailures = async (e: CustomEvent<{count: number; total: number; decrypted: number; isKeyMismatch?: boolean}>) => {
      const { count, total, isKeyMismatch } = e.detail;
      if (count === 0) return;

      // Don't re-open the dialog immediately after user just recovered (encryption-initialized triggers another getAllEntries)
      if (recoverySuccessSuppressDialogRef.current) {
        recoverySuccessSuppressDialogRef.current = false;
        if (import.meta.env.DEV) console.log('⏭️ Skipping recovery dialog — suppressed after successful recovery');
        return;
      }

      // For key mismatch: try auto-recovery from connected providers before showing dialog
      if (isKeyMismatch) {
        try {
          const recovered = await storageServiceV2.tryRecoverMasterKeyFromProviders();
          if (recovered) {
            recoverySuccessSuppressDialogRef.current = true;
            window.dispatchEvent(new CustomEvent('encryption-initialized', { detail: { hasMasterKey: true } }));
            if (import.meta.env.DEV) console.log('✅ Key mismatch auto-recovered from connected provider');
            return;
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn('⚠️ Auto-recovery from providers failed:', err);
        }
      }

      // For key mismatch: show once then stop. Re-entering the password won't help
      // because the master key itself is wrong, not the password.
      if (isKeyMismatch && recoveryLastShownCountRef.current > 0) {
        if (import.meta.env.DEV) console.log('⏭️ Skipping key-mismatch dialog — already shown');
        return;
      }

      if (!isKeyMismatch && count <= recoveryLastShownCountRef.current) {
        if (import.meta.env.DEV) console.log('⏭️ Skipping - failure count not increased since last show');
        return;
      }

      // Don't show modal when we're in the recoverable (toast) flow — toast is the single CTA
      if (encryptedEntriesDetectedRef.current) {
        encryptedEntriesDetectedRef.current = false;
        if (import.meta.env.DEV) console.log('⏭️ Skipping recovery dialog — recoverable toast flow active');
        return;
      }

      recoveryLastShownCountRef.current = count;
      setDecryptionFailureInfo({ count, total, isKeyMismatch });
      setShowRecoveryDialog(true);
    };
    
    window.addEventListener('decryption-failures', handleDecryptionFailures as EventListener);
    return () => window.removeEventListener('decryption-failures', handleDecryptionFailures as EventListener);
  }, [toast, t]);

  // Listen for encrypted entries detected in Simple mode - offer one-tap E2E unlock
  useEffect(() => {
    const handleEncryptedInSimpleMode = async (e: CustomEvent<{encryptedCount: number; displayedCount: number; totalCount: number}>) => {
      const { encryptedCount, displayedCount } = e.detail;
      
      // Only show if there are encrypted entries that couldn't be displayed
      if (encryptedCount <= displayedCount) return;
      
      // Mark that encrypted entries were detected (to suppress normal sync toast)
      encryptedEntriesDetectedRef.current = true;
      encryptedEntriesCountRef.current = encryptedCount; // Store count synchronously
      setEncryptedEntriesInSimpleMode({ count: encryptedCount });
      // Don't show recovery modal and toast at the same time; close modal when showing recoverable toast
      setShowRecoveryDialog(false);
      setDecryptionFailureInfo(null);

      toast({
        title: t('index.encryptedEntriesDetected', 'Encrypted entries found'),
        description: t('index.encryptedEntriesInSimpleModeHint', '{{count}} entries need E2E encryption to view. Enter your password to unlock.', { count: encryptedCount }),
        variant: "default",
        duration: 30000,
        action: (
          <ToastAction 
            altText={t('index.unlockNow', 'Unlock Now')}
            onClick={async () => {
              // Switch to E2E mode
              const { setEncryptionMode } = await import('@/utils/encryptionModeStorage');
              setEncryptionMode('e2e');
              
              // Open password dialog
              setNeedsJournalPassword(true);
              setPasswordDialogDismissed(false);
              
              // Notify that mode changed (for settings UI to update)
              window.dispatchEvent(new CustomEvent('encryption-mode-changed', { 
                detail: { mode: 'e2e' } 
              }));
            }}
          >
            {t('index.unlockNow', 'Unlock Now')}
          </ToastAction>
        ),
      });
    };
    
    window.addEventListener('encrypted-entries-in-simple-mode', handleEncryptedInSimpleMode as EventListener);
    return () => window.removeEventListener('encrypted-entries-in-simple-mode', handleEncryptedInSimpleMode as EventListener);
  }, [toast, t]);

  // Set up Supabase auth listener and check for existing session
  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener for ONGOING changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (import.meta.env.DEV) console.log("Auth state change event:", event, "Session:", session);

      // Set user scope BEFORE state updates so all subsequent storage reads and
      // ensureConnections (triggered by React effects) use the correct user-scoped keys.
      const userId = session?.user?.id ?? null;
      setCurrentUserId(userId);
      if (userId) {
        // Synchronous localStorage migration – safe because localStorage is sync.
        migrateLocalStorageToUserScope(userId);
      } else {
        // User signed out (possibly from another tab) — clear in-memory connections
        // so the next user never inherits the previous user's cloud storage state.
        connectionStateManager.clearAll();
      }

      // Handle password recovery event - show dialog to set new password
      // Set recovery mode for clean UI experience
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setShowSetNewPasswordDialog(true);
      }

      setSession(session);
      setUser(session?.user ?? null);
    });

    // INITIAL session check - controls loading state
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        
        if (import.meta.env.DEV) console.log("Getting existing session:", session);

        // Set user scope immediately so all storage reads after this point
        // use user-scoped keys (both localStorage and IndexedDB).
        const userId = session?.user?.id ?? null;
        setCurrentUserId(userId);
        if (userId) {
          migrateLocalStorageToUserScope(userId);
        }

        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to get session:', error);
      } finally {
        if (isMounted) setIsAuthLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Re-read user-scoped settings once the user identity is known.
  // The useState initialisers above ran before auth, so they may have read
  // global/unscoped keys; now we load the correct per-user values.
  useEffect(() => {
    if (!user?.id) return;

    // cloudSetupDone
    const savedSetup = localStorage.getItem(scopedKey("cloudSetupDone"));
    if (savedSetup !== null) {
      setCloudSetupDone(savedSetup === "true");
    }

    // Journal name (journalNameStorage already uses scopedKey internally)
    setJournalName(journalNameStorage.getJournalName());

    // Theme
    const savedTheme = localStorage.getItem(scopedKey("theme"));
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else if (savedTheme === "light") {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, [user?.id]);

  // Fetch subscription status (uses cache when offline so Plus works offline)
  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setIsPro(false);
      setSubscriptionStatus(null);
      setHasUsedTrial(true);
      setCurrentPeriodEnd(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("is_pro, current_period_end, subscription_status, has_used_trial")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      const isPro = data?.is_pro || false;
      setIsPro(isPro);
      setSubscriptionStatus(data?.subscription_status ?? null);
      setHasUsedTrial(data?.has_used_trial ?? false);
      setCurrentPeriodEnd(data?.current_period_end ?? null);
      setCachedSubscription(user.id, {
        is_pro: isPro,
        current_period_end: data?.current_period_end ?? null,
        subscription_status: data?.subscription_status ?? null,
        has_used_trial: data?.has_used_trial ?? false,
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to fetch subscription:", error);
      const cached = getCachedSubscription(user.id);
      setIsPro(cached?.is_pro ?? false);
      setSubscriptionStatus(cached?.subscription_status ?? null);
      setHasUsedTrial(cached?.has_used_trial ?? false);
      setCurrentPeriodEnd(cached?.current_period_end ?? null);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Handle Stripe checkout success/cancel URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutResult = urlParams.get('checkout');
    
    if (checkoutResult === 'success') {
      // Remove the query parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Show success toast (trial-specific or regular)
      const wasTrial = sessionStorage.getItem('ownjournal_trial_checkout') === 'true';
      sessionStorage.removeItem('ownjournal_trial_checkout');
      toast({
        title: wasTrial
          ? t('subscription.trialStarted', 'Your free trial has started!')
          : t('subscription.upgradeSuccess', 'Welcome to OwnJournal Plus!'),
        description: wasTrial
          ? t('subscription.trialStartedDesc', 'Enjoy 14 days of Plus features for free.')
          : t('subscription.upgradeSuccessDesc', 'Your subscription is now active. Enjoy all Pro features!'),
        duration: 8000,
      });
      
      // Refetch subscription status to update UI
      fetchSubscription();
    } else if (checkoutResult === 'cancel') {
      // Remove the query parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Show cancel toast
      toast({
        title: t('subscription.checkoutCanceled', 'Checkout canceled'),
        description: t('subscription.checkoutCanceledDesc', 'You can upgrade anytime from the settings.'),
        variant: "default",
        duration: 5000,
      });
    }

    // Handle portal return
    const portalReturn = urlParams.get('portal_return');
    if (portalReturn === 'true') {
      // Remove the query parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Show return toast
      toast({
        title: t('subscription.portalReturn', 'Welcome back!'),
        description: t('subscription.portalReturnDesc', 'Your subscription settings have been updated.'),
        duration: 5000,
      });
      
      // Refetch subscription status to reflect any changes
      fetchSubscription();
    }
  }, [toast, t, fetchSubscription]);

  // Load cached entry snapshot IMMEDIATELY on mount (before auth/encryption resolve).
  // This gives instant perceived load time on returning visits.
  const snapshotLoadedRef = useRef(false);
  useEffect(() => {
    if (snapshotLoadedRef.current) return;
    snapshotLoadedRef.current = true;

    storageServiceV2.loadEntrySnapshot().then((snapshot) => {
      if (snapshot.length > 0) {
        // Only set if we haven't already loaded real entries
        setEntries(prev => prev.length > 0 ? prev : snapshot);
        if (import.meta.env.DEV) console.log(`⚡ Instant snapshot: ${snapshot.length} entries displayed`);
      }
    }).catch(() => {
      // Silently ignore - will load properly after auth
    });
  }, []);

  // Load cached entries only after encryption is ready
  // Skip if startup sync already loaded entries (prevents duplicate decryption)
  useEffect(() => {
    const loadCachedEntries = async () => {
      // Skip if startup sync already ran (it loads entries)
      if (startupSyncDoneRef.current) {
        if (import.meta.env.DEV) console.log('⏭️ Skipping cached entry load - startup sync already handled it');
        return;
      }

      try {
        // Only load entries when encryption is ready (master key available for E2E mode)
        const cachedEntries = await storageServiceV2.getAllEntries();
        if (cachedEntries.length > 0) {
          if (import.meta.env.DEV) console.log(`📦 Loaded ${cachedEntries.length} cached entries`);
          setEntries(cachedEntries);
        }
      } catch (error) {
        // Silently ignore - will load properly after password
        if (import.meta.env.DEV) console.log("No cached entries available yet");
      }
    };

    // Only load entries when user is authenticated AND encryption is ready
    if (user && encryptionReady) {
      loadCachedEntries();
    }
  }, [user, encryptionReady]);

  // Track when Settings was last closed to detect new connections
  const settingsLastClosedRef = useRef<number>(0);
  const previousProvidersRef = useRef<string[]>([]);
  const providerBindingsInitializedRef = useRef(false);

  // Subscribe to ConnectionStateManager for immediate updates (no polling needed)
  useEffect(() => {
    if (!user) return;

    // Get initial state
    const updateConnectedProviders = () => {
      const actualProviders = connectionStateManager.getConnectedProviderNames();
      setConnectedProviders((prev) => {
        const changed = JSON.stringify(prev.slice().sort()) !== JSON.stringify(actualProviders.slice().sort());

        // Detect NEW connections (provider added)
        const newProviders = actualProviders.filter((p) => !previousProvidersRef.current.includes(p));

        if (changed && import.meta.env.DEV) {
          console.log("🔍 Connection state changed:", previousProvidersRef.current, "->", actualProviders);
        }

        // If new provider connected, force reload entries to ensure they appear
        // GUARD: Only load entries if encryption is ready AND not currently initializing
        if (newProviders.length > 0 && encryptionReady && !initializingEncryptionRef.current) {
          if (import.meta.env.DEV)
            console.log(`🔄 New provider(s) detected: ${newProviders.join(", ")} - reloading entries`);
          storageServiceV2
            .getAllEntries()
            .then((entries) => {
              if (import.meta.env.DEV) console.log(`📚 Loaded ${entries.length} entries after connection`);
              setEntries(entries);
            })
            .catch((err) => {
              if (import.meta.env.DEV) console.error("Failed to reload entries after connection:", err);
            });
        } else if (newProviders.length > 0 && import.meta.env.DEV) {
          console.log(`⏳ New provider(s) detected but encryption not ready yet - skipping entry reload`);
        }

        previousProvidersRef.current = actualProviders;
        return changed ? actualProviders : prev;
      });
    };

    // Check immediately on mount
    updateConnectedProviders();

    // Subscribe to ConnectionStateManager for changes (replaces polling)
    const unsubscribe = connectionStateManager.subscribe(() => {
      if (import.meta.env.DEV) console.log("📢 [Index] ConnectionStateManager notified change");
      updateConnectedProviders();
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-initialize storage with stored password ONCE on mount
  const passwordInitAttemptedRef = useRef(false);
  const secondChanceEnsureAttemptedRef = useRef(false);

  // Reset sync state when user logs out so next login triggers fresh sync
  useEffect(() => {
    if (user === null) {
      passwordInitAttemptedRef.current = false;
      startupSyncDoneRef.current = false;
      startupSyncPromiseRef.current = null;
      secondChanceEnsureAttemptedRef.current = false;

      if (import.meta.env.DEV) {
        console.log('🔄 User logged out - reset sync state refs');
      }
    }
  }, [user]);

  // Second chance: retry ensureConnections once after a short delay when we have user and
  // (Simple or E2E with masterKey) but still zero connections. Covers timing/race or first run skip.
  useEffect(() => {
    if (!user) return;
    if (secondChanceEnsureAttemptedRef.current) return;

    const timeoutId = window.setTimeout(async () => {
      if (secondChanceEnsureAttemptedRef.current) return;
      if (getCurrentUserId() === null) return;
      const currentCount = connectionStateManager.getConnectedProviderNames().length;
      if (currentCount > 0) {
        if (import.meta.env.DEV) console.log('[Index] Second chance ensureConnections: already have providers, skipping');
        secondChanceEnsureAttemptedRef.current = true;
        return;
      }
      const { getEncryptionMode } = await import('@/utils/encryptionModeStorage');
      const mode = getEncryptionMode();
      const masterKey = storageServiceV2.getMasterKey();
      if (mode === 'e2e' && !masterKey) {
        if (import.meta.env.DEV) console.log('[Index] Second chance ensureConnections: E2E without masterKey, skipping');
        secondChanceEnsureAttemptedRef.current = true;
        return;
      }
      secondChanceEnsureAttemptedRef.current = true;
      if (import.meta.env.DEV) console.log('[Index] Second chance: ensureConnections (user + ', mode === 'simple' ? 'Simple' : 'E2E with key', ')');
      await connectionStateManager.ensureConnections(mode === 'simple' ? null : masterKey);
      setConnectedProviders(connectionStateManager.getConnectedProviderNames());
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (passwordInitAttemptedRef.current) return;

    passwordInitAttemptedRef.current = true;

    const autoInitPassword = async () => {
      // Check encryption mode first - skip auto-init in Simple mode
      const { getEncryptionMode } = await import('@/utils/encryptionModeStorage');
      if (getEncryptionMode() === 'simple') {
        if (import.meta.env.DEV) console.log('ℹ️ Simple mode - skipping password auto-init');
        // Load entries in parallel with connection setup (entries are local-only, no connection needed)
        const [, localEntries] = await Promise.all([
          connectionStateManager.ensureConnections(null),
          storageServiceV2.getAllEntries().catch(() => [] as JournalEntryData[]),
        ]);
        setConnectedProviders(connectionStateManager.getConnectedProviderNames());

        if (localEntries.length > 0) {
          setEntries(localEntries);
          if (import.meta.env.DEV) console.log(`📦 Loaded ${localEntries.length} local entries instantly`);
        }

        // Then start cloud sync in background using coordinated startup sync
        await performStartupSync();
        return;
      }
      
      // Check if already initialized
      const existingKey = storageServiceV2.getMasterKey();
      if (existingKey) {
        if (import.meta.env.DEV) console.log("✅ Master key already exists, skipping auto-init");
        // Load entries in parallel with connection setup (entries are local-only, no connection needed)
        const [, localEntries] = await Promise.all([
          connectionStateManager.ensureConnections(existingKey),
          storageServiceV2.getAllEntries().catch(() => [] as JournalEntryData[]),
        ]);
        setConnectedProviders(connectionStateManager.getConnectedProviderNames());

        if (localEntries.length > 0) {
          setEntries(localEntries);
          if (import.meta.env.DEV) console.log(`📦 Loaded ${localEntries.length} local entries instantly`);
        }

        // Then start cloud sync in background using coordinated startup sync
        await performStartupSync();
        return;
      }

      // Try to retrieve stored password
      const storedPassword = await retrievePassword();
      if (!storedPassword) {
        if (import.meta.env.DEV) console.log("ℹ️ No stored password, waiting for user input");
        return;
      }

      if (import.meta.env.DEV) console.log("🔓 Auto-loading with stored password (not manually entered)");
      try {
        // CRITICAL: Set flag to block other effects from loading entries during async init
        initializingEncryptionRef.current = true;
        
        // CRITICAL FIX: Only reset encryption state if NO valid cached key exists
        // If we have a cached key, we should USE it - not clear it!
        // Clearing the cache before initialize causes CLOUD_KEY_REQUIRED error for returning users
        const hasCachedKey = await storageServiceV2.hasCachedEncryptionKey();
        if (!hasCachedKey) {
          // No cached key - safe to reset to ensure clean state
          // Pass 'pre-initialize' reason to suppress false positive warning about encrypted entries
          if (import.meta.env.DEV) console.log('🧹 No cached key - resetting encryption state for clean init');
          storageServiceV2.resetEncryptionState(false, false, 'pre-initialize');
        } else {
          if (import.meta.env.DEV) console.log('✅ Cached key exists - skipping reset to preserve it');
        }
        
        await storageServiceV2.initialize(storedPassword);
        
        // CRITICAL: Clear flag AFTER initialization completes - masterKey is now set
        initializingEncryptionRef.current = false;
        
        setJournalPassword(storedPassword);
        if (import.meta.env.DEV) console.log("✅ Storage auto-initialized with stored password");
        
        // Load local entries immediately after initialization
        const localEntries = await storageServiceV2.getAllEntries();
        setEntries(localEntries);
        if (import.meta.env.DEV) console.log(`📦 Immediately loaded ${localEntries.length} local entries`);
        
        // Use ConnectionStateManager for auto-binding (single source of truth)
        const masterKey = storageServiceV2.getMasterKey();
        await connectionStateManager.ensureConnections(masterKey);
        
        // Check if any providers connected and trigger coordinated startup sync
        const providers = connectionStateManager.getConnectedProviderNames();
        setConnectedProviders(providers);
        await performStartupSync();
      } catch (error) {
        // CRITICAL: Clear flag on error so other effects can proceed
        initializingEncryptionRef.current = false;
        
        console.error("❌ Auto-init failed with stored password:", error);
        
        // CRITICAL: Use encryptionStateManager to handle error appropriately
        // Only clear password on DECRYPTION_FAILED, not on other errors like NO_CLOUD_KEY
        const { encryptionStateManager } = await import('@/services/encryptionStateManager');
        const { passwordCleared, shouldPromptPassword } = encryptionStateManager.handleInitializationError(
          error instanceof Error ? error : new Error(String(error))
        );
        
        if (passwordCleared) {
          storageServiceV2.clearMasterKey();
          toast({
            title: t('encryption.decryptionFailedTitle', 'Incorrect password'),
            description: t('encryption.decryptionFailedHint', 'If this is a new device, make sure you\'re using the same password from your original device.'),
            variant: "destructive",
            action: (
              <ToastAction 
                altText={t('encryption.clearLocalData', 'Clear Local Data')}
                onClick={async () => {
                  // Clear local encryption state but keep cloud data
                  storageServiceV2.resetEncryptionState();
                  // Clear stored password
                  await clearPassword();
                  toast({
                    title: t('encryption.localDataCleared', 'Local data cleared'),
                    description: t('encryption.localDataClearedDesc', 'Please enter your password to sync with cloud storage.'),
                  });
                  setNeedsJournalPassword(true);
                }}
              >
                {t('encryption.clearLocalData', 'Clear Local Data')}
              </ToastAction>
            ),
          });
        } else if (error instanceof Error && error.message === 'DECRYPTION_FAILED') {
          // Decryption failed - wrong password but might be new device scenario
          toast({
            title: t('encryption.decryptionFailedTitle', 'Incorrect password'),
            description: t('encryption.decryptionFailedHint', 'If this is a new device, make sure you\'re using the same password from your original device.'),
            variant: "destructive",
            action: (
              <ToastAction 
                altText={t('encryption.clearLocalData', 'Clear Local Data')}
                onClick={async () => {
                  storageServiceV2.resetEncryptionState();
                  await clearPassword();
                  toast({
                    title: t('encryption.localDataCleared', 'Local data cleared'),
                    description: t('encryption.localDataClearedDesc', 'Please enter your password to sync with cloud storage.'),
                  });
                  setNeedsJournalPassword(true);
                }}
              >
                {t('encryption.clearLocalData', 'Clear Local Data')}
              </ToastAction>
            ),
          });
          setNeedsJournalPassword(true);
        } else if (error instanceof Error && error.message === 'NO_CLOUD_KEY') {
          // Password is fine, just no cloud key yet - inform user
          toast({
            title: t('storage.noCloudKey', 'No encryption key found'),
            description: t('storage.connectStorageFirst', 'Connect to cloud storage to set up encryption'),
          });
        } else if (error instanceof Error && error.message === 'NETWORK_ERROR_RETRY') {
          // Network error - don't clear password, ask user to retry
          toast({
            title: t('encryption.networkError', 'Connection failed'),
            description: `${t('encryption.networkErrorDesc', 'Could not connect to cloud storage. Please check your connection and try again.')} ${t('storage.reconnectHint')}`,
            variant: "destructive",
            action: (
              <ToastAction 
                altText={t('common.retry', 'Retry')}
                onClick={() => {
                  // Retry initialization with stored password
                  autoInitPassword();
                }}
              >
                {t('common.retry', 'Retry')}
              </ToastAction>
            ),
          });
        } else if (error instanceof Error && (error.message === 'DECRYPTION_FAILED' || error.message.includes('Failed to decrypt') || error.message === 'CACHED_PASSWORD_INCORRECT')) {
          // Wrong password entered (cloud or cached) - show user-friendly message
          toast({
            title: t('encryption.incorrectPassword', 'Incorrect Password'),
            description: t('encryption.incorrectPasswordDesc', 'The password you entered is incorrect. Please try again.'),
            variant: "destructive",
            duration: 8000,
            action: (
              <ToastAction 
                altText={t('common.retry', 'Retry')}
                onClick={() => {
                  encryptionStateManager.requestPassword();
                }}
              >
                {t('common.retry', 'Retry')}
              </ToastAction>
            ),
          });
        } else if (error instanceof Error && error.message === 'CLOUD_KEY_REQUIRED') {
          // Close password dialog first - don't leave user stuck
          setNeedsJournalPassword(false);
          
          // Show toast with clear guidance
          toast({
            title: t('encryption.encryptedEntriesNeedCloud', 'Encrypted entries need cloud access'),
            description: t('encryption.encryptedEntriesNeedCloudDesc', 'You have encrypted entries from a previous sync. Reconnect to the same cloud storage with your encryption password to access them.'),
            variant: "default",
            duration: 20000,
            action: (
              <ToastAction 
                altText={t('index.connectStorage', 'Connect Storage')}
                onClick={() => {
                  setSettingsDefaultTab("storage");
                  setShowSettings(true);
                }}
              >
                {t('index.connectStorage', 'Connect Storage')}
              </ToastAction>
            ),
          });
          
          // Clear the error state and reset to Simple mode since we can't proceed with E2E without cloud
          setInitializationError(null);
          
          // Reset to Simple mode - can't use E2E without cloud
          import('@/utils/encryptionModeStorage').then(({ setEncryptionMode }) => {
            setEncryptionMode('simple');
            // Notify settings UI
            window.dispatchEvent(new CustomEvent('encryption-mode-changed', { detail: { mode: 'simple' } }));
          });
        } else if (error instanceof Error && error.message === 'ENTRIES_WITHOUT_KEY') {
          // Cloud has entries but no encryption key - data may be lost
          toast({
            title: t('encryption.entriesWithoutKey', 'Encryption key missing'),
            description: t('encryption.entriesWithoutKeyDesc', 'Your cloud storage has encrypted entries but the encryption key is missing. This may happen if the key was deleted.'),
            variant: "destructive",
          });
          // Show recovery dialog
          setDecryptionFailureInfo({ count: 0, total: 0 });
          setShowRecoveryDialog(true);
        } else if (error instanceof Error && (error.message === 'SALT_NOT_FOUND' || error.message.includes('salt not found'))) {
          // Salt not found - browser data cleared or new device
          toast({
            title: t('encryption.saltNotFound', 'Encryption setup not found'),
            description: t('encryption.saltNotFoundDesc', 'Your encryption setup data was not found. This can happen if browser data was cleared or you\'re using a new device.'),
            variant: "destructive",
            action: (
              <ToastAction 
                altText={t('encryption.resetSetup', 'Reset Encryption Setup')}
                onClick={() => {
                  // Clear initialization state to allow fresh setup
                  storageServiceV2.resetEncryptionState();
                  setNeedsJournalPassword(true);
                }}
              >
                {t('encryption.resetSetup', 'Reset Setup')}
              </ToastAction>
            ),
          });
        } else {
          // Other errors - generic message, but don't clear password
          toast({
            title: t('index.initError', 'Initialization error'),
            description: error instanceof Error ? translateCloudError(error, t) : t('index.initErrorDesc', 'Please try again'),
            variant: "destructive",
          });
        }
        
        if (shouldPromptPassword) {
          setNeedsJournalPassword(true);
        }
      }
    };

    autoInitPassword();
  }, [user, toast]);

  // Initialize storage service and load entries - ONLY ONCE
  const initializationInProgressRef = useRef(false);
  const initializationCompleteRef = useRef(false);

  // SIMPLIFIED: Single useEffect that subscribes to events on mount
  useEffect(() => {
    if (!user) return;

    if (import.meta.env.DEV) console.log("🚀 Setting up app subscriptions...");

    // NOTE: Entry loading is handled by the encryptionReady-gated effect (around line 260)
    // DO NOT load entries here - it causes race condition before encryption key is ready

    // Subscribe to entry changes - GUARD with encryptionReady check
    const unsubEntries = storageServiceV2.onEntriesChanged(() => {
      if (!encryptionReadyRef.current || initializingEncryptionRef.current) {
        if (import.meta.env.DEV) console.log("📢 Entries changed but encryption not ready - skipping reload");
        return;
      }
      debouncedReloadEntries('onEntriesChanged');
    });

    // Subscribe to sync status changes
    const unsubStatus = storageServiceV2.onStatusChange((status, lastSync) => {
      if (import.meta.env.DEV) console.log(`📊 Sync status changed to: ${status}`);
      setSyncStatus(status);
      if (lastSync) setLastSyncTime(lastSync);
      const providers = cloudStorageService.getConnectedProviderNames();
      setConnectedProviders(providers);

      if (status === "success" && encryptionReadyRef.current && !initializingEncryptionRef.current) {
        debouncedReloadEntries('syncStatusSuccess');
      } else if (status === "success" && import.meta.env.DEV) {
        console.log("⏳ Sync succeeded but encryption not ready - skipping entry reload");
      }
    });

    if (import.meta.env.DEV) console.log("✅ Subscriptions active");

    return () => {
      unsubEntries();
      unsubStatus();
    };
  }, [user]);

  // Also listen for window-level entries-changed event
  // This catches events dispatched after cloud sync completion (onCloudProviderConnected)
  useEffect(() => {
    const handleEntriesChangedEvent = () => {
      if (!user) return;
      if (!encryptionReady) {
        if (import.meta.env.DEV) console.log("📢 [Window Event] entries-changed but encryption not ready - skipping");
        return;
      }
      debouncedReloadEntries('windowEntriesChanged');
    };

    window.addEventListener('entries-changed', handleEntriesChangedEvent);
    return () => window.removeEventListener('entries-changed', handleEntriesChangedEvent);
  }, [user, encryptionReady, debouncedReloadEntries]);

  // Track which secondary providers have shown their toast (to avoid duplicates)
  const hasShownSecondaryToastRef = useRef<Set<string>>(new Set());

  // True when we just went from 0 to 1+ providers (so trigger-sync should not show its own toast)
  const firstTimeConnectionRef = useRef(false);

  // Live provider count so we can detect 0→1 in trigger-sync before React state has updated
  const lastProviderCountRef = useRef(0);
  
  // When a cloud provider is connected for the FIRST TIME and we already have a journal password,
  // upload the encryption key, then run a full sync once
  // NOTE: Only triggers on first provider connection, not when adding secondary providers
  useEffect(() => {
    const previousProviders = previousProvidersRef.current;
    const wasEmpty = previousProviders.length === 0;
    const nowHasProviders = connectedProviders.length > 0;
    const isFirstTimeConnection = wasEmpty && nowHasProviders;
    
    // Find newly added providers by comparing arrays
    const newlyAddedProviders = connectedProviders.filter(
      p => !previousProviders.includes(p)
    );
    
    // Update ref for next comparison AFTER checking
    previousProvidersRef.current = [...connectedProviders];

    // Signal to trigger-sync handler: skip toast when we're in 0→1 "first connection" (even if cloudSetupDone was true from a previous session)
    firstTimeConnectionRef.current = isFirstTimeConnection;
    
    if (!user) return;
    
    // Only trigger initial sync if this is truly the FIRST connection (0 → 1+)
    // Secondary provider connections should NOT trigger sync
    if (journalPassword && isFirstTimeConnection && !cloudSetupDone) {
      const primaryProvider = connectionStateManager.getPrimaryProviderName();
      (async () => {
        try {
          if (!navigator.onLine || storageServiceV2.getSyncStatus().status === 'offline') {
            setSyncStatus('offline');
            toast({
              title: t('sync.offlineCantSync'),
              description: t('sync.offlineCantSyncDesc'),
              variant: "default",
            });
            return;
          }
          toast({ title: t('index.settingUpSync'), description: t('index.settingUpSyncDesc') });
          // Ensure connections (and primary) are ready before key load/sync
          const masterKey = storageServiceV2.getMasterKey();
          await connectionStateManager.ensureConnections(masterKey ?? null);
          await storageServiceV2.onCloudProviderConnected(journalPassword);
          setSyncStatus("syncing");
          await storageServiceV2.performFullSync();
          const synced = await storageServiceV2.getAllEntries();
          setEntries(synced);
          setCloudSetupDone(true);
          localStorage.setItem(scopedKey("cloudSetupDone"), "true");
          setLastSyncTime(new Date());
          
          // Check if encrypted entries were detected - show modified toast with unlock option
          if (encryptedEntriesDetectedRef.current) {
            encryptedEntriesDetectedRef.current = false;
            toast({ 
              title: t('index.initialSyncComplete'), 
              description: t('index.syncCompleteWithEncrypted', { count: encryptedEntriesInSimpleMode?.count || 0 }),
              duration: 15000,
              action: (
                <ToastAction 
                  altText={t('index.unlockNow', 'Unlock Now')}
                  onClick={async () => {
                    const { setEncryptionMode } = await import('@/utils/encryptionModeStorage');
                    setEncryptionMode('e2e');
                    setNeedsJournalPassword(true);
                    setPasswordDialogDismissed(false);
                    window.dispatchEvent(new CustomEvent('encryption-mode-changed', { detail: { mode: 'e2e' } }));
                  }}
                >
                  {t('index.unlockNow', 'Unlock Now')}
                </ToastAction>
              ),
            });
          } else if (startupSyncPromiseRef.current === null) {
            // Only show completion toast when startup sync is not still running (avoids
            // "sync complete, 0 entries" mid-sync). When we're the only/final completion,
            // show toast including for 0 entries (provider empty).
            toast({
              title: t('index.initialSyncComplete'),
              description: t('index.initialSyncCompleteDesc', { count: synced.length, provider: primaryProvider || 'cloud' })
            });
          }
        } catch (e) {
          if (import.meta.env.DEV) console.error("Cloud setup on connect failed:", e);
          toast({
            title: t('index.initialSyncFailed'),
            description: e instanceof Error ? e.message : t('index.initialSyncFailedDesc'),
            variant: "destructive",
          });
        } finally {
          setSyncStatus("idle");
        }
      })();
    } else if (newlyAddedProviders.length > 0 && connectedProviders.length > 1) {
      // A NEW secondary provider was just added - show confirmation (only once per provider)
      const primaryProvider = connectionStateManager.getPrimaryProviderName();
      
      newlyAddedProviders.forEach(newProvider => {
        // Don't show "secondary" toast for the primary provider, and only show once
        if (newProvider !== primaryProvider && !hasShownSecondaryToastRef.current.has(newProvider)) {
          hasShownSecondaryToastRef.current.add(newProvider);
          if (import.meta.env.DEV) console.log(`📎 Secondary provider connected: ${newProvider}`);
          toast({ 
            title: t('index.secondaryProviderConnected', { provider: newProvider }), 
            description: t('index.secondaryProviderConnectedDesc') 
          });
        }
      });
    }
  }, [user, journalPassword, connectedProviders, cloudSetupDone, toast, t]);

  // Check for saved theme preference (unscoped read for pre-auth render;
  // the user-scoped re-read happens in the user?.id effect above).
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);  // intentionally unscoped – runs before auth; user-scoped re-read below

  // Refs for immediate access in event handlers (avoid stale closures)
  const needsPasswordRef = useRef(needsJournalPassword);
  const dismissedRef = useRef(passwordDialogDismissed);
  
  useEffect(() => {
    needsPasswordRef.current = needsJournalPassword;
  }, [needsJournalPassword]);
  
  useEffect(() => {
    dismissedRef.current = passwordDialogDismissed;
  }, [passwordDialogDismissed]);

  // GLOBAL PASSWORD DIALOG TRIGGER: Listen for 'require-password' events from any component
  // This is the SINGLE entry point for showing the password dialog
  // 
  // ARCHITECTURE NOTE: All password requests should go through:
  //   encryptionStateManager.requestPasswordIfNeeded('source')
  // which checks if password is actually needed before dispatching 'require-password'.
  // This handler trusts that check already happened.
  useEffect(() => {
    const handleRequirePassword = () => {
      if (import.meta.env.DEV) {
        console.log('🔔 [Index] Global require-password event received');
      }
      
      // Only show if not already showing - use refs for immediate values (no stale closures)
      // The check for whether password is needed already happened in requestPasswordIfNeeded()
      if (!needsPasswordRef.current && !dismissedRef.current) {
        setNeedsJournalPassword(true);
      } else if (import.meta.env.DEV) {
        console.log('⏭️ [Index] Password dialog already showing or dismissed - skipping');
      }
    };
    
    window.addEventListener('require-password', handleRequirePassword);
    return () => window.removeEventListener('require-password', handleRequirePassword);
  }, []); // Empty deps - use refs for current state

  // Phase 4: Listen for conflict notifications
  useEffect(() => {
    const unsubscribe = storageServiceV2.onConflictDetected((count, latestConflict) => {
      toast({
        title: t('index.conflictDetected'),
        description: t('index.conflictDetectedDesc', { count }),
        duration: 8000,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSettingsDefaultTab("conflicts");
              setShowSettings(true);
            }}
          >
            {t('index.viewConflicts')}
          </Button>
        ),
      });

      if (import.meta.env.DEV) {
        console.log("🔔 Conflict notification shown:", latestConflict);
      }
    });

    return unsubscribe;
  }, [toast]);

  const handleSaveEntry = async (entryData: Omit<JournalEntryData, "id" | "createdAt" | "updatedAt"> & { id?: string }) => {
    // Find existing entry if editing
    const existingEntry = entryData.id ? entries.find((e) => e.id === entryData.id) : null;
    
    const newEntry: JournalEntryData = {
      ...entryData,
      id: entryData.id || Date.now().toString(), // Use existing ID or generate new
      createdAt: existingEntry?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    // Optimistic update - add to UI immediately
    const existingIndex = entries.findIndex((e) => e.id === newEntry.id);
    if (existingIndex >= 0) {
      // Update existing entry and re-sort so it moves to the correct position (e.g. if date changed)
      setEntries((prev) => sortEntriesByDateNewestFirst(prev.map((e) => (e.id === newEntry.id ? newEntry : e))));
    } else {
      // Add new entry in sorted position (newest first)
      setEntries((prev) => sortEntriesByDateNewestFirst([...prev, newEntry]));
    }

    // Show immediate feedback
    const savingToast = toast({
      title: t('index.savingEntry'),
      description: t('index.savingEntryDesc'),
      duration: 30000, // Keep it visible until we update it
    });

    try {
      // Save to encrypted IndexedDB and cloud in background
      await storageServiceV2.saveEntry(newEntry);

      // Update the toast to show success (don't claim "synced" when offline)
      savingToast.update({
        id: savingToast.id,
        title: t('index.entrySaved'),
        description: navigator.onLine ? t('index.entrySavedDesc') : t('index.entrySavedOfflineDesc'),
        duration: 3000,
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to save entry:", error);

      // Rollback the optimistic update on error
      if (existingIndex >= 0) {
        // Restore original entry
        const refreshedEntries = await storageServiceV2.getAllEntries();
        setEntries(refreshedEntries);
      } else {
        // Remove the newly added entry
        setEntries((prev) => prev.filter((e) => e.id !== newEntry.id));
      }

      // Update toast to show error
      savingToast.update({
        id: savingToast.id,
        title: t('index.failedToSaveEntry'),
        description: error instanceof Error ? translateCloudError(error, t) : t('index.pleaseTryAgain'),
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    // Optimistic update - remove from UI immediately
    setEntries((prev) => prev.filter((entry) => entry.id !== id));

    // Show immediate feedback
    const deletingToast = toast({
      title: t('index.deletingEntry'),
      description: t('index.deletingEntryDesc'),
      duration: 30000, // Keep it visible until we update it
    });

    try {
      // Await deletion so the pending deletion is persisted before any manual sync
      await storageServiceV2.deleteEntry(id);

      // Update the toast to show success (don't claim "synced" when offline)
      const isOnline = navigator.onLine && storageServiceV2.getSyncStatus().status !== 'offline';
      deletingToast.update({
        id: deletingToast.id,
        title: t('index.entryDeleted'),
        description: isOnline ? t('index.entryDeletedDesc') : t('index.entryDeletedOfflineDesc'),
        duration: 3000,
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to delete entry:", error);
      // Reload entries on error
      const refreshed = await storageServiceV2.getAllEntries();
      setEntries(refreshed);

      // Update toast to show error
      deletingToast.update({
        id: deletingToast.id,
        title: t('index.deletionFailed'),
        description: t('index.deletionFailedDesc'),
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  /**
   * Open OAuth URL in system browser on Capacitor and listen for the
   * Universal Link callback. Shared by Google and Apple sign-in flows.
   * Returns true if the browser was opened, false if caller should fall through.
   */
  const openCapacitorOAuth = async (url: string): Promise<boolean> => {
    try {
      const { Browser } = await import('@capacitor/browser');
      const { App } = await import('@capacitor/app');

      let handled = false;
      const listener = await App.addListener('appUrlOpen', async (event) => {
        if (handled) return;
        if (!event.url.includes('/oauth-callback') && !event.url.includes('access_token')) return;

        handled = true;
        try {
          await Browser.close();

          const parsed = new URL(event.url);
          const hashParams = new URLSearchParams(parsed.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) {
              toast({ title: t('auth.error'), description: sessionError.message, variant: "destructive" });
            }
          }
        } catch (parseError) {
          if (import.meta.env.DEV) console.error('Error parsing OAuth callback:', parseError);
        }
        await listener.remove();
      });

      await Browser.open({ url, presentationStyle: 'popover' });

      // Timeout: clean up if Universal Links don't redirect back (e.g. iOS simulator)
      setTimeout(async () => {
        if (!handled) {
          await listener.remove();
          try { await Browser.close(); } catch (_) {}
          toast({
            title: t('auth.error'),
            description: 'Authentication could not complete. If testing on iOS simulator, please use a real device — OAuth redirect requires Universal Links which are not available in the simulator.',
            variant: "destructive",
          });
        }
      }, 2 * 60 * 1000);

      return true;
    } catch (browserError) {
      if (import.meta.env.DEV) console.error('Failed to open system browser:', browserError);
      return false;
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Check for in-app browser first (LINE, Facebook, Instagram, etc.)
      // Google blocks OAuth in these embedded WebViews with "403: disallowed_useragent" error
      if (isInAppBrowser()) {
        const appName = getInAppBrowserName() || 'this app';
        toast({
          title: t('auth.inAppBrowserWarning', { appName }),
          description: t('auth.inAppBrowserDesc'),
          variant: "destructive",
          duration: 10000,
        });
        return;
      }
      
      // Check if running on Capacitor (iOS/Android native app)
      const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
      const redirectUrl = isCapacitor
        ? buildAppLink('/oauth-callback')
        : `${window.location.origin}/web-oauth-callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        toast({
          title: t('auth.error'),
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data?.url) {
        if (isCapacitor) {
          // On Capacitor, use system browser (Safari/Chrome) to avoid WebView block
          // Google blocks OAuth in embedded WebViews with "disallowed_useragent" error
          const opened = await openCapacitorOAuth(data.url);
          if (opened) return;
          // Fall through to regular redirect as fallback
        }
        
        // Detect custom domain (not localhost)
        // Custom domains redirect directly to OAuth provider
        const isCustomDomain =
          window.location.hostname !== "localhost";
        
        if (isCustomDomain) {
          // BYPASS AUTH-BRIDGE: Validate and redirect directly
          // The OAuth URL from Supabase goes to Supabase's auth server first,
          // which then redirects to the OAuth provider (Google)
          const oauthUrl = new URL(data.url);
          const supabaseProjectId = SUPABASE_CONFIG.projectId;
          const isAllowed = 
            oauthUrl.hostname === `${supabaseProjectId}.supabase.co` ||
            oauthUrl.hostname.endsWith('.supabase.co') ||
            oauthUrl.hostname === 'accounts.google.com';
          if (!isAllowed) {
            if (import.meta.env.DEV) console.error('Invalid OAuth URL hostname:', oauthUrl.hostname);
            throw new Error("Invalid OAuth redirect URL");
          }
          window.location.href = data.url;
          return;
        }
        
        // Fallback: regular redirect
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = data.url;
          } else {
            window.location.href = data.url;
          }
        } catch {
          window.location.href = data.url;
        }
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? translateCloudError(error, t) : t('index.unexpectedError'),
        variant: "destructive",
      });
    }
  };

  const handleAppleSignIn = async () => {
    try {
      // Check if running on Capacitor (iOS/Android native app)
      const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
      const redirectUrl = isCapacitor
        ? buildAppLink('/oauth-callback')
        : `${window.location.origin}/web-oauth-callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        const msg = error.message || "";
        if (msg.includes("provider") || msg.includes("not enabled")) {
          toast({
            title: t('index.appleSignInNotAvailable'),
            description: t('index.appleSignInNotAvailableDesc'),
            variant: "destructive",
          });
          return;
        }
        toast({
          title: t('auth.error'),
          description: msg,
          variant: "destructive",
        });
        return;
      }

      if (data?.url) {
        if (isCapacitor) {
          // On Capacitor, use system browser and listen for App Link callback
          const opened = await openCapacitorOAuth(data.url);
          if (opened) return;
          // Fall through to regular redirect as fallback
        }
        
        // Detect custom domain (not localhost)
        // Custom domains redirect directly to OAuth provider
        const isCustomDomain =
          window.location.hostname !== "localhost";
        
        if (isCustomDomain) {
          // BYPASS AUTH-BRIDGE: Validate and redirect directly
          // The OAuth URL from Supabase goes to Supabase's auth server first,
          // which then redirects to the OAuth provider (Apple)
          const oauthUrl = new URL(data.url);
          const supabaseProjectId = SUPABASE_CONFIG.projectId;
          const isAllowed = 
            oauthUrl.hostname === `${supabaseProjectId}.supabase.co` ||
            oauthUrl.hostname.endsWith('.supabase.co') ||
            oauthUrl.hostname === 'appleid.apple.com';
          if (!isAllowed) {
            if (import.meta.env.DEV) console.error('Invalid OAuth URL hostname:', oauthUrl.hostname);
            throw new Error("Invalid OAuth redirect URL");
          }
          window.location.href = data.url;
          return;
        }
        
        // Fallback: regular redirect
        try {
          if (window.top && window.top !== window) {
            window.top.location.href = data.url;
          } else {
            window.location.href = data.url;
          }
        } catch {
          window.location.href = data.url;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('index.unexpectedError');
      if (errorMessage.includes("provider") || errorMessage.includes("not enabled")) {
        toast({
          title: t('index.appleSignInNotAvailable'),
          description: t('index.appleSignInNotAvailableDesc'),
          variant: "destructive",
        });
      } else {
        toast({
          title: t('common.error'),
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  };

  const handleSignOut = async () => {
    try {
      // Set flag so storage/OAuth error handlers suppress connection-failed toasts during sign-out
      setSigningOut(true);

      // Clear OAuth/session state BEFORE clearing connections so no token exchange or callback runs after
      sessionStorage.removeItem('onboarding-oauth-in-progress');
      sessionStorage.removeItem('onboarding-pending-oauth');
      sessionStorage.removeItem('settings-dialog-open');
      sessionStorage.removeItem('onboarding-in-progress');
      sessionStorage.removeItem('onboarding-provider');
      sessionStorage.removeItem('onboarding-encryption-mode');
      sessionStorage.removeItem('pending-oauth-provider');
      sessionStorage.removeItem('storage-oauth-code');
      sessionStorage.removeItem('storage-oauth-state');
      sessionStorage.removeItem('storage-oauth-provider');

      // Clear unscoped user-specific data so the next account never sees this user's data.
      // Do NOT clear user-scoped keys (u:userId:...) so same account's storage connection is remembered.
      clearUnscopedUserData();
      setCurrentUserId(null);
      setEntries([]);

      // Clear in-memory connections only. Do NOT call unregisterProvider() or add to disabled list,
      // so the same account can auto-reconnect (ensureConnections) when they sign back in.
      connectionStateManager.clearAll();

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: t('index.signedOut'),
        description: t('index.signedOutDesc'),
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? translateCloudError(error, t) : t('index.unexpectedError'),
        variant: "destructive",
      });
    } finally {
      // Defer so async error handlers (e.g. from clearAll listeners) still see isSigningOut() and suppress toasts
      setTimeout(() => setSigningOut(false), 1000);
    }
  };

  const handleExportData = async () => {
    // Export JSON backup
    const data = {
      entries: entries.map((entry) => ({
        ...entry,
        date: entry.date.toISOString(),
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt?.toISOString() || entry.createdAt.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `journal-backup-${timestamp}.json`;

    if (isNativePlatform()) {
      try {
        const result = await saveJsonBackupNative(data, fileName);
        
        toast({
          title: t('index.backupExported'),
          description: t('exportDialog.savedToPath', { path: result.path }),
          duration: 15000,
          action: (
            <ToastAction 
              altText={t('exportDialog.share')}
              onClick={() => shareFileNative(result.uri, result.fileName)}
            >
              <Share2 className="h-4 w-4 mr-1" />
              {t('exportDialog.share')}
            </ToastAction>
          ),
        });
      } catch (error) {
        if (import.meta.env.DEV) console.error('Native export failed:', error);
        // Fall back to web export
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        saveAs(blob, fileName);
        toast({
          title: t('index.backupExported'),
          description: t('index.backupExportedDesc', { count: entries.length }),
        });
      }
    } else {
      // Web export
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      saveAs(blob, fileName);
      toast({
        title: t('index.backupExported'),
        description: t('index.backupExportedDesc', { count: entries.length }),
      });
    }
  };

  const handleExportToFile = () => {
    // Open PDF/Word export dialog
    setShowExportDialog(true);
  };

  const handleImportData = async (data: { entries?: unknown[]; settings?: unknown }) => {
    try {
      if (!data.entries || !Array.isArray(data.entries)) {
        throw new Error(t('import.invalidFormat'));
      }

      // Convert date strings to Date objects
      // FIXED: Preserve original updatedAt to prevent overwriting newer cloud edits
      const entriesToImport: JournalEntryData[] = data.entries.map(
        (entry: JournalEntryData & { date: string | Date; createdAt: string | Date; updatedAt?: string | Date }) => ({
          ...entry,
          date: new Date(entry.date),
          createdAt: new Date(entry.createdAt),
          updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : new Date(entry.createdAt),
        }),
      );

      // Optimistic update - show imported entries immediately
      setEntries((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newEntries = entriesToImport.filter((e) => !existingIds.has(e.id));
        return sortEntriesByDateNewestFirst([...newEntries, ...prev]);
      });

      toast({
        title: t('import.complete'),
        description: t('index.importCompleteDesc', { count: data.entries.length }),
      });

      // Save to storage in background (parallel for speed)
      await Promise.all(entriesToImport.map((entry) => storageServiceV2.saveEntry(entry)));

      // Trigger cloud sync if connected
      const hasCloudProvider = cloudStorageService.getPrimaryProvider() !== null;
      if (hasCloudProvider && journalPassword) {
        try {
          if (!navigator.onLine || storageServiceV2.getSyncStatus().status === 'offline') {
            setSyncStatus('offline');
            toast({
              title: t('sync.offlineCantSync'),
              description: t('sync.offlineCantSyncDesc'),
              variant: "default",
            });
          } else {
            setSyncStatus("syncing");
            // FIXED: Ensure encryption key and local entries are uploaded before sync
            await storageServiceV2.onCloudProviderConnected(journalPassword);
            await storageServiceV2.performFullSync();
            setLastSyncTime(new Date());
            toast({
              title: t('index.cloudSyncComplete'),
              description: t('index.cloudSyncCompleteDesc'),
            });
          }
        } catch (syncError) {
          if (import.meta.env.DEV) console.error("Cloud sync after import failed:", syncError);
          toast({
            title: t('index.cloudSyncIncomplete'),
            description: t('index.cloudSyncIncompleteDesc'),
            variant: "destructive",
          });
        } finally {
          setSyncStatus("idle");
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error("Import error:", error);
      toast({
        title: t('import.failed'),
        description: error instanceof Error ? translateCloudError(error, t) : t('import.failedDesc'),
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    try {
      recoveryLastShownCountRef.current = 0;
      // Use ConnectionStateManager as single source of truth
      const hasCloudStorage = connectionStateManager.getConnectedProviderNames().length > 0;

      if (!hasCloudStorage) {
        toast({
          title: t('sync.noCloudStorage'),
          description: t('sync.noCloudStorageDesc'),
          variant: "destructive",
        });
        return;
      }

      if (!navigator.onLine) {
        setSyncStatus('offline');
        toast({
          title: t('sync.offlineCantSync'),
          description: t('sync.offlineCantSyncDesc'),
          variant: "default",
        });
        return;
      }

      // Check encryption mode
      const { getEncryptionMode } = await import('@/utils/encryptionModeStorage');
      const encryptionMode = getEncryptionMode();
      
      // SIMPLE MODE: No password needed - just sync
      if (encryptionMode === 'simple') {
        if (import.meta.env.DEV) console.log('📝 Simple mode - syncing without encryption');
        await connectionStateManager.ensureConnections(null);
        await storageServiceV2.performFullSync();
        const syncedEntries = await storageServiceV2.getAllEntries();
        setEntries(syncedEntries);
        if (storageServiceV2.getSyncStatus().status === 'success') {
          toast({ title: t('sync.title'), description: t('sync.description') });
        } else if (storageServiceV2.getSyncStatus().status !== 'syncing') {
          toast({
            title: t('index.unableToStartSync'),
            description: `${t('index.syncFailedDesc')} ${t('storage.reconnectHint')}`,
            variant: "default",
          });
        }
        return;
      }
      
      // E2E MODE: Check for master key
      let existingKey = storageServiceV2.getMasterKey();
      
      if (!existingKey) {
        // Try to retrieve and use stored password FIRST
        const storedPassword = await retrievePassword();
        
        if (storedPassword) {
          if (import.meta.env.DEV) console.log('🔓 Using stored password for sync initialization');
          await storageServiceV2.initialize(storedPassword);
          existingKey = storageServiceV2.getMasterKey();
        }
      }
      
      if (!existingKey) {
        // No master key and no stored password - prompt user
        setPasswordDialogDismissed(false);
        setNeedsJournalPassword(true);
        toast({
          title: t('index.passwordRequired'),
          description: t('index.passwordRequiredDesc'),
          action: (
            <ToastAction
              altText={t('common.setPassword')}
              onClick={() => {
                setPasswordDialogDismissed(false);
                setNeedsJournalPassword(true);
              }}
            >
              {t('common.setPassword')}
            </ToastAction>
          ),
        });
        return;
      }

      await connectionStateManager.ensureConnections(existingKey);
      await storageServiceV2.performFullSync();

      const syncedEntries = await storageServiceV2.getAllEntries();
      if (import.meta.env.DEV) console.warn(`[sync] getAllEntries returned ${syncedEntries.length} entries after performFullSync`);
      setEntries(syncedEntries);

      if (storageServiceV2.getSyncStatus().status === 'success') {
        toast({
          title: t('sync.title'),
          description: t('sync.description'),
        });
      } else if (storageServiceV2.getSyncStatus().status !== 'syncing') {
        toast({
          title: t('index.unableToStartSync'),
          description: `${t('index.syncFailedDesc')} ${t('storage.reconnectHint')}`,
          variant: "default",
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Sync error:", error);
      }

      // Provide user-friendly error messages
      let title = t('sync.failed');
      let message = t('index.syncFailedDesc');
      let passwordRelated = false;

      if (error instanceof Error) {
        if (isNextcloudEncryptionError(error)) {
          title = t('index.nextcloudEncryptionError');
          message = translateCloudError(error, t);
        } else {
          // Use translated description first so specific patterns (e.g. Nextcloud encryption) are applied
          message = translateCloudError(error, t);
          const lower = (error.message || '').toLowerCase();
          // Nextcloud sync-state/encryption: show guide and skip generic 500 overwrite
          const isSyncStateEncryption = lower.includes('sync-state') && (
            lower.includes('500') || lower.includes('encryption') || lower.includes('cloud_encryption_error') || lower.includes('server error')
          );
          if (isSyncStateEncryption) {
            title = t('index.nextcloudEncryptionError');
            message = translateCloudError(error, t);
          } else {
            // Detect password-related errors and prompt user to set/enter the correct password
            if (lower.includes("decrypt") || lower.includes("incorrect password")) {
              title = t('index.incorrectPassword');
              passwordRelated = true;
            } else if (lower.includes("password") || lower.includes("encryption key not initialized")) {
              passwordRelated = true;
            }
            if (passwordRelated) {
              setPasswordDialogDismissed(false);
              setNeedsJournalPassword(true);
            }

            // Detect specific error types and provide actionable guidance (do not overwrite sync-state/encryption)
            if (!isSyncStateEncryption && (lower.includes("500") || lower.includes("server error"))) {
              title = t('index.serverError');
              message = t('index.serverErrorDesc');
            } else if (lower.includes("503") || lower.includes("unavailable")) {
              title = t('index.serverUnavailable');
              message = t('index.serverUnavailableDesc');
            } else if (lower.includes("507") || lower.includes("storage full")) {
              title = t('index.storageFull');
              message = t('index.storageFullDesc');
            } else if (lower.includes("401") || lower.includes("authentication")) {
              title = t('index.authenticationFailed');
              message = t('index.authenticationFailedDesc');
            } else if (lower.includes("403") || lower.includes("permission")) {
              title = t('index.permissionDenied');
              message = t('index.permissionDeniedDesc');
            }
          }
        }
      }

      const isNextcloudGuide = title === t('index.nextcloudEncryptionError');
      toast({
        title,
        description: isNextcloudGuide ? message : `${message} ${t('storage.reconnectHint')}`,
        variant: "destructive",
        ...(isNextcloudGuide ? { duration: 30000 } : {}),
        ...(isNextcloudGuide
          ? {
              action: (
                <ToastAction
                  altText={t('index.nextcloudEncryptionLearnMore')}
                  onClick={() => {
                    setHelpDialogInitialTab('troubleshooting');
                    setHelpDialogInitialAccordion('nextcloud-encryption');
                    setShowHelpDialog(true);
                  }}
                >
                  {t('index.nextcloudEncryptionLearnMore')}
                </ToastAction>
              ),
            }
          : passwordRelated
            ? {
                action: (
                  <ToastAction
                    altText={t('common.setPassword')}
                    onClick={() => {
                      setPasswordDialogDismissed(false);
                      setNeedsJournalPassword(true);
                    }}
                  >
                    {t('common.setPassword')}
                  </ToastAction>
                ),
              }
            : {}),
      });
    }
  };

  const handleToggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem(scopedKey("theme"), "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem(scopedKey("theme"), "light");
    }
  };

  const handleUpgrade = async (currency: string = 'USD') => {
    setIsUpgrading(true);
    
    // Verify we have a valid session (not just user state) - ensures auth token is attached
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !currentSession) {
      toast({
        title: t('index.signInRequired'),
        description: t('index.signInRequiredDesc'),
        variant: "destructive",
      });
      setIsUpgrading(false);
      return;
    }

    try {
      // Use production URL for native apps (window.location.origin is localhost on Capacitor)
      const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
      const origin = isCapacitor
        ? buildAppLink()
        : window.location.origin;

      // Pass origin, locale, and detected currency for multi-currency checkout
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { origin, locale: i18n.language, currency, trial: !hasUsedTrial },
        headers: {
          Authorization: `Bearer ${currentSession.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: t('index.checkoutNotAvailable'),
          description: data.error,
          variant: "destructive",
        });
        setIsUpgrading(false);
        return;
      }

      // Handle already-active subscription (synced from Stripe)
      if (data?.alreadyActive) {
        toast({
          title: t('index.subscriptionActive', 'Subscription Active'),
          description: t('index.subscriptionAlreadyActive', 'Your Plus subscription is already active! Refreshing...'),
        });
        await fetchSubscription();
        setIsUpgrading(false);
        return;
      }

      // Track whether this was a trial checkout for the success toast (survives page reload)
      if (data?.trial) {
        sessionStorage.setItem('ownjournal_trial_checkout', 'true');
      } else {
        sessionStorage.removeItem('ownjournal_trial_checkout');
      }

      // Redirect to Stripe checkout
      if (data?.url) {
        if (isCapacitor) {
          // Use system browser for native apps - this allows App Links
          // to intercept the checkout-success redirect and return to the app
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: data.url });
          setIsUpgrading(false);  // Reset since we're not navigating away from the app
        } else {
          // Web: direct navigation
          window.location.href = data.url;
          // Keep loading true since we're navigating away
        }
        return;
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error("Failed to create checkout:", error);
      toast({
        title: t('index.upgradeFailed'),
        description: t('index.upgradeFailedDesc'),
        variant: "destructive",
      });
    }
    
    setIsUpgrading(false);
  };

  // Handle journal password setup
  const handleJournalPasswordSet = async (password: string) => {
    // Keep password only in memory (React state) for security
    setJournalPassword(password);
    setNeedsJournalPassword(false);
    setInitializationError(null);

    // CRITICAL: Persist password FIRST, before initialize()
    // initialize() may trigger OAuth redirect via event, so we must persist password before page unloads
    try {
      await storePassword(password);
      if (import.meta.env.DEV) console.log('🔐 Password stored for auto-initialization');
    } catch (e) {
      if (import.meta.env.DEV) console.error('Failed to store password:', e);
      // Continue anyway - in-memory password will still work for this session
    }

    // Initialize storage with this password to ensure proper state and bindings
    try {
      await storageServiceV2.initialize(password);

      toast({
        title: t('index.passwordSaved'),
        description: t('index.passwordSavedDesc'),
      });
      
      // Immediately load entries now that we have the master key
      // This ensures entries appear without requiring page refresh
      try {
        const loadedEntries = await storageServiceV2.getAllEntries();
        setEntries(loadedEntries);
        justLoadedEntriesRef.current = true; // Mark that we just loaded - skip redundant sync
        if (import.meta.env.DEV) console.log(`📚 Loaded ${loadedEntries.length} entries after password set`);
      } catch (loadError) {
        if (import.meta.env.DEV) console.error('Failed to load entries after password set:', loadError);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '';
      
      // Handle DECRYPTION_FAILED with better guidance
      if (errorMessage === 'DECRYPTION_FAILED' || errorMessage.toLowerCase().includes('decrypt')) {
        setInitializationError(t('encryption.decryptionFailedHint', 'If this is a new device, make sure you\'re using the same password from your original device.'));
        toast({
          title: t('encryption.decryptionFailedTitle', 'Incorrect password'),
          description: t('encryption.decryptionFailedDesc', 'The password you entered doesn\'t match the encryption key stored in the cloud.'),
          variant: "destructive",
          action: (
            <ToastAction 
              altText={t('encryption.clearLocalData', 'Clear Local Data')}
              onClick={async () => {
                storageServiceV2.resetEncryptionState();
                await clearPassword();
                setInitializationError(null);
                toast({
                  title: t('encryption.localDataCleared', 'Local data cleared'),
                  description: t('encryption.localDataClearedDesc', 'Please enter your password to sync with cloud storage.'),
                });
                setNeedsJournalPassword(true);
              }}
            >
              {t('encryption.clearLocalData', 'Clear Local Data')}
            </ToastAction>
          ),
        });
        setNeedsJournalPassword(true);
        return;
      }
      
      // Handle SALT_NOT_FOUND
      if (errorMessage === 'SALT_NOT_FOUND' || errorMessage.includes('salt not found')) {
        toast({
          title: t('encryption.saltNotFound', 'Encryption setup not found'),
          description: t('encryption.saltNotFoundDesc'),
          variant: "destructive",
          action: (
            <ToastAction 
              altText={t('encryption.resetSetup', 'Reset Encryption Setup')}
              onClick={() => {
                storageServiceV2.resetEncryptionState();
                setNeedsJournalPassword(true);
              }}
            >
              {t('encryption.resetSetup', 'Reset Setup')}
            </ToastAction>
          ),
        });
        return;
      }
      
      // Handle CLOUD_KEY_REQUIRED - user needs to connect cloud storage first
      if (errorMessage === 'CLOUD_KEY_REQUIRED') {
        // Close password dialog - don't leave user stuck
        setNeedsJournalPassword(false);
        
        // Reset to Simple mode since E2E can't proceed without cloud
        import('@/utils/encryptionModeStorage').then(({ setEncryptionMode }) => {
          setEncryptionMode('simple');
          window.dispatchEvent(new CustomEvent('encryption-mode-changed', { detail: { mode: 'simple' } }));
        });
        
        toast({
          title: t('encryption.encryptedEntriesNeedCloud'),
          description: t('encryption.encryptedEntriesNeedCloudDesc'),
          variant: "default",
          duration: 20000,
          action: (
            <ToastAction 
              altText={t('index.connectStorage')}
              onClick={() => {
                setSettingsDefaultTab("storage");
                setShowSettings(true);
              }}
            >
              {t('index.connectStorage')}
            </ToastAction>
          ),
        });
        return;
      }
      
      toast({
        title: t('index.encryptionSetupFailed'),
        description: e instanceof Error ? translateCloudError(e, t) : t('index.encryptionSetupFailedDesc'),
        variant: "destructive",
      });
      return;
    }

    // CRITICAL: Check if we're in onboarding E2E flow with pending OAuth
    // This handles the case where SyncCheckStep is unmounted when password dialog shows
    const pendingOAuthProvider = sessionStorage.getItem('onboarding-pending-oauth');
    if (pendingOAuthProvider && storageServiceV2.isPendingOAuth) {
      if (import.meta.env.DEV) {
        console.log('🔐 [handleJournalPasswordSet] Onboarding E2E flow - initiating OAuth for:', pendingOAuthProvider);
      }
      
      // Import and use the OAuth initiator
      const { initiateOAuth, isOAuthProvider, getOAuthProviderKey } = await import('@/utils/oauthInitiator');
      
      if (isOAuthProvider(pendingOAuthProvider)) {
        const oauthKey = getOAuthProviderKey(pendingOAuthProvider);
        if (oauthKey) {
          // Set flags for OAuth return handling
          sessionStorage.setItem('settings-dialog-open', 'true');
          sessionStorage.setItem('onboarding-oauth-in-progress', pendingOAuthProvider);
          
          // Start OAuth - will redirect away from page
          const result = await initiateOAuth(oauthKey);
          if (!result.success) {
            toast({
              title: t('storage.connectionError'),
              description: result.error || t('providers.oauth.failedToStart', 'Failed to start authentication'),
              variant: 'destructive',
            });
            // Clear pending oauth flag on failure
            sessionStorage.removeItem('onboarding-pending-oauth');
          }
          return; // Exit - OAuth will redirect
        }
      } else if (pendingOAuthProvider === 'nextcloud') {
        // Nextcloud needs settings dialog for manual credential entry
        sessionStorage.setItem('settings-dialog-open', 'true');
        setSettingsDefaultTab("storage");
        setShowSettings(true);
        return;
      }
    }

    const hasCloudProvider = cloudStorageService.getPrimaryProvider() !== null;

    // Skip background sync for recovery flow - entries were already loaded/synced
    // Only sync for first-time E2E setup (when we need to upload encryption key)
    if (hasCloudProvider && !justLoadedEntriesRef.current) {
      // Start background sync without awaiting
      (async () => {
        try {
          if (!navigator.onLine || storageServiceV2.getSyncStatus().status === 'offline') {
            setSyncStatus('offline');
            toast({
              title: t('sync.offlineCantSync'),
              description: t('sync.offlineCantSyncDesc'),
              variant: "default",
            });
            return;
          }
          toast({
            title: t('index.startingCloudSync'),
            description: t('index.startingCloudSyncDesc'),
          });

          // Upload master key and all local entries to cloud
          await storageServiceV2.onCloudProviderConnected(password);

          // Immediately trigger full bidirectional sync
          setSyncStatus("syncing");
          await storageServiceV2.performFullSync();

          // Reload entries after sync
          const syncedEntries = await storageServiceV2.getAllEntries();
          setEntries(syncedEntries);
          setCloudSetupDone(true);
          localStorage.setItem(scopedKey("cloudSetupDone"), "true");

          // Check if encrypted entries were detected - show modified toast with unlock option
          if (encryptedEntriesDetectedRef.current) {
            encryptedEntriesDetectedRef.current = false;
            toast({
              title: t('sync.title'),
              description: t('index.syncCompleteWithEncrypted', { count: encryptedEntriesInSimpleMode?.count || 0 }),
              duration: 15000,
              action: (
                <ToastAction 
                  altText={t('index.unlockNow', 'Unlock Now')}
                  onClick={async () => {
                    const { setEncryptionMode } = await import('@/utils/encryptionModeStorage');
                    setEncryptionMode('e2e');
                    setNeedsJournalPassword(true);
                    setPasswordDialogDismissed(false);
                    window.dispatchEvent(new CustomEvent('encryption-mode-changed', { detail: { mode: 'e2e' } }));
                  }}
                >
                  {t('index.unlockNow', 'Unlock Now')}
                </ToastAction>
              ),
            });
          } else {
            toast({
              title: t('sync.title'),
              description: t('index.syncCompleteDesc', { count: syncedEntries.length }),
            });
          }
        } catch (e) {
          const msg = (e as Error)?.message || t('index.unableToStartSync');

          if (isNextcloudEncryptionError(e)) {
            toast({
              title: t('index.nextcloudEncryptionError'),
              description: e instanceof Error ? translateCloudError(e, t) : msg,
              variant: "destructive",
              duration: 30000,
              action: (
                <ToastAction
                  altText={t('index.nextcloudEncryptionLearnMore')}
                  onClick={() => {
                    setHelpDialogInitialTab('troubleshooting');
                    setHelpDialogInitialAccordion('nextcloud-encryption');
                    setShowHelpDialog(true);
                  }}
                >
                  {t('index.nextcloudEncryptionLearnMore')}
                </ToastAction>
              ),
            });
          } else if (msg.toLowerCase().includes("decrypt")) {
            toast({
              title: t('index.incorrectPassword'),
              description: msg,
              variant: "destructive",
            });
          } else {
            toast({
              title: t('sync.failed'),
              description: msg,
              variant: "destructive",
            });
          }
        }
      })();
    }
  };

  // Show loading spinner only if auth is still resolving AND we have no cached entries to show.
  // When a snapshot is available, we skip the spinner and render the journal UI immediately.
  if (isAuthLoading && entries.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Show authentication screen if not authenticated.
  // Skip this gate while auth is still loading and we have cached snapshot entries to display.
  if (!user && !(isAuthLoading && entries.length > 0)) {
    return <AuthScreen onGoogleSignIn={handleGoogleSignIn} onAppleSignIn={handleAppleSignIn} />;
  }

  // Show minimal UI during password recovery - clean background with only the dialog
  if (isRecoveryMode && showSetNewPasswordDialog) {
    return (
      <div className="min-h-screen bg-gradient-paper flex items-center justify-center">
        <SetNewPasswordDialog
          open={showSetNewPasswordDialog}
          onSuccess={() => {
            recoverySuccessRef.current = true;
          }}
          onClose={async () => {
            setShowSetNewPasswordDialog(false);
            
            // If password was NOT updated, sign out the user for security
            if (!recoverySuccessRef.current) {
              await supabase.auth.signOut();
              toast({
                title: t('auth.resetCanceled', 'Password reset canceled'),
                description: t('auth.resetCanceledDesc', 'Please request a new password reset link to try again.'),
              });
            }
            
            setIsRecoveryMode(false);
            recoverySuccessRef.current = false;
          }}
        />
      </div>
    );
  }

  // NOTE: JournalPasswordDialog is now rendered as an overlay below (not early return)
  // This keeps OnboardingWizard mounted so it can receive events after password is set

  const mappedUser = user
    ? {
        name: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || t('common.defaultUser')),
        email: user.email || "",
        avatar: user.user_metadata?.avatar_url as string | undefined,
        isPro: isPro,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-paper">
      {/* Onboarding Tour */}
      <OnboardingTour
        run={showTour && !!user}
        stepIndex={tourStepIndex}
        onStepChange={setTourStepIndex}
        onComplete={completeTour}
        onSkip={skipTour}
      />

      {/* Journal Password Dialog */}
      <JournalPasswordDialog
        open={needsJournalPassword && !passwordDialogDismissed}
        onPasswordSet={handleJournalPasswordSet}
        isOAuthUser={false}
        errorMessage={initializationError || undefined}
        onDismiss={() => setPasswordDialogDismissed(true)}
        onOpenChange={(open) => {
          if (!open) setNeedsJournalPassword(false);
        }}
      />

      {/* Help Dialog */}
      <HelpDialog
        open={showHelpDialog}
        onOpenChange={(open) => {
          setShowHelpDialog(open);
          if (!open) {
            setHelpDialogInitialTab(undefined);
            setHelpDialogInitialAccordion(undefined);
          }
        }}
        onStartTour={restartTour}
        initialTab={helpDialogInitialTab}
        initialAccordion={helpDialogInitialAccordion}
      />

      {/* Set New Password Dialog (for password recovery flow) */}
      <SetNewPasswordDialog
        open={showSetNewPasswordDialog}
        onClose={() => setShowSetNewPasswordDialog(false)}
      />
      
      {/* Password Recovery Dialog for decryption failures */}
      <PasswordRecoveryDialog
        open={showRecoveryDialog}
        onOpenChange={(open) => {
          setShowRecoveryDialog(open);
          if (!open) setDecryptionFailureInfo(null);
        }}
        failedCount={decryptionFailureInfo?.count ?? 0}
        totalCount={decryptionFailureInfo?.total ?? 0}
        isKeyMismatch={decryptionFailureInfo?.isKeyMismatch ?? false}
        onBeforeRecoveryComplete={() => {
          recoverySuccessSuppressDialogRef.current = true;
        }}
        onRecoverySuccess={async () => {
          const entries = await storageServiceV2.getAllEntries({ skipDecryptionFailureEvent: true });
          setEntries(entries);
          setDecryptionFailureInfo(null);
          recoveryLastShownCountRef.current = 0;
        }}
      />

      <Header
        user={mappedUser}
        onSignOut={handleSignOut}
        onOpenSettings={(tab) => {
          setShowHelpDialog(false);
          if (tab) setSettingsDefaultTab(tab);
          setShowSettings(true);
        }}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onExportToFile={handleExportToFile}
        onSync={handleSync}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        showBackButton={isEditing}
        onBack={() => {
          window.dispatchEvent(new CustomEvent("app:back"));
          setIsEditing(false);
        }}
        syncStatus={syncStatus}
        lastSyncTime={lastSyncTime}
        connectedProviders={connectedProviders}
        onOpenHelp={() => {
          setShowSettings(false);
          setShowHelpDialog(true);
        }}
        isProgressExpanded={isProgressBarExpanded}
        onToggleProgressExpanded={() => setIsProgressBarExpanded(prev => !prev)}
      />

      {/* Sync Progress Bar - shows during active sync when expanded */}
      <SyncProgressBar isExpanded={isProgressBarExpanded} />

      <SettingsDialog
        open={showSettings}
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) {
            // Track when Settings closed for connection state polling
            settingsLastClosedRef.current = Date.now();
            // Reset to default tab when closing
            setSettingsDefaultTab("storage");
          }
        }}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onExportToFile={handleExportToFile}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        defaultTab={settingsDefaultTab}
        onReopenSetup={restartTour}
        onUpgrade={handleUpgrade}
        isPro={isPro}
        isUpgrading={isUpgrading}
        onSignOut={handleSignOut}
        subscriptionStatus={subscriptionStatus}
        hasUsedTrial={hasUsedTrial}
      />

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        entries={entries}
        journalName={journalName}
        isPro={isPro}
      />

      <main className="container mx-auto max-w-4xl h-[calc(100vh-4rem)] overflow-x-hidden">
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">

          <SubscriptionBanner onUpgrade={handleUpgrade} isPro={isPro} isLoading={isUpgrading} subscriptionStatus={subscriptionStatus} hasUsedTrial={hasUsedTrial} />

          {entries.length >= 1 && <MoodCalendar entries={entries} />}

          {entries.length >= 3 && <MoodStats entries={entries} />}

          {entries.length >= 5 && <MoodCorrelations entries={entries} isPro={isPro} />}

          {entries.length >= 3 && (
            <TrendAnalysis
              key={`trend-${user?.id ?? 'anonymous'}`}
              entries={entries}
              isPro={isPro}
            />
          )}

          {connectedProviders.length === 0 && (
            <div className="bg-muted border border-border rounded-lg p-3 sm:p-4">
              {/* Vertical on mobile, horizontal on tablet+ */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <svg
                    className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base">{t('index.noCloudConnected')}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {t('index.noCloudConnectedDesc')}
                    </p>
                  </div>
                </div>
                {/* Full-width button on mobile */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full sm:w-auto flex-shrink-0"
                  onClick={() => {
                    setSettingsDefaultTab("storage");
                    setShowSettings(true);
                  }}
                >
                  {t('index.connectStorage')}
                </Button>
              </div>
            </div>
          )}

          {initializationError && (
            <div className="bg-destructive/10 border border-destructive text-destructive rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{t('index.storageInitError')}</h3>
                  <p className="text-sm">{initializationError}</p>
                  {initializationError.includes("incompatible") && (
                    <p className="text-sm mt-2 font-medium">
                      <strong>{t('index.solution')}:</strong> {t('index.incompatibleSolution')}
                    </p>
                  )}
                  {initializationError.toLowerCase().includes("password") && (
                    <div className="mt-3">
                      <Button
                        onClick={() => {
                          setPasswordDialogDismissed(false);
                          setNeedsJournalPassword(true);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        {t('index.setEncryptionPassword')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="tour-timeline">
          <Timeline
            entries={sortedEntries}
            onSaveEntry={handleSaveEntry}
            onDeleteEntry={handleDeleteEntry}
            onEditingChange={setIsEditing}
            isPro={isPro}
          />
        </div>
      </main>

    </div>
  );
};

export default Index;
