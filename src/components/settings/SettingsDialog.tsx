import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { X, AlertTriangle, LogOut, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, Moon, Sun, Cloud, FileText, FileText as LegalIcon, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { StorageSecuritySettings } from "./StorageSecuritySettings";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SyncDiagnostics } from "./SyncDiagnostics";
import { SubscriptionBanner } from "@/components/subscription/SubscriptionBanner";
import { JournalNameSettings } from "./JournalNameSettings";
import { useRef, useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { isNativePlatform } from "@/utils/nativeExport";
import { supabase } from "@/integrations/supabase/client";
import { storageServiceV2 } from "@/services/storageServiceV2";
import { SAFETY_CONSTANTS } from "@/config/features";
import { CurrencyCode } from "@/config/pricing";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportData: () => void;
  onExportToFile?: () => void;
  onImportData: (data: unknown) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  defaultTab?: string;
  onReopenSetup?: (fullReset?: boolean) => void;
  onUpgrade?: (currency: CurrencyCode) => void;
  isPro?: boolean;
  isUpgrading?: boolean;
  onSignOut?: () => void;
  subscriptionStatus?: string | null;
  hasUsedTrial?: boolean;
}

export const SettingsDialog = ({
  open,
  onOpenChange,
  onExportData,
  onExportToFile,
  onImportData,
  isDarkMode,
  onToggleTheme,
  defaultTab = "storage",
  onReopenSetup,
  onUpgrade,
  isPro = false,
  isUpgrading = false,
  onSignOut,
  subscriptionStatus,
  hasUsedTrial,
}: SettingsDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  
  // Delete account state
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState<{
    phase: 'local' | 'cloud';
    current: number;
    total: number;
  } | null>(null);

  // Email change state
  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [newEmail, setNewEmail] = useState("");
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [pendingEmailChange, setPendingEmailChange] = useState(false);

  // Subscription management state
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);

  // Fetch current email and stripe customer ID on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error('Failed to fetch user data:', error);
          return;
        }
        if (user?.email) {
          setCurrentEmail(user.email);
        }
        // Fetch stripe_customer_id for subscription management
        if (user) {
          const { data } = await supabase
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .single();
          setStripeCustomerId(data?.stripe_customer_id || null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    if (open) {
      fetchUserData();
    }
  }, [open]);

  // Listen for auth state changes to detect email verification
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'USER_UPDATED' && session?.user?.email) {
        const newUserEmail = session.user.email;
        
        // Check if email actually changed
        if (newUserEmail !== currentEmail && currentEmail) {
          if (import.meta.env.DEV) console.log('📧 Email changed, syncing to profile and Stripe...');
          
          try {
            // Call the update-email edge function to sync
            const { error } = await supabase.functions.invoke('update-email', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            if (error) {
              console.error('Failed to sync email:', error);
            } else {
              setCurrentEmail(newUserEmail);
              setPendingEmailChange(false);
              setNewEmail("");
              toast({
                title: t('settings.email.changeSuccess'),
                description: t('settings.email.changeSuccessDesc'),
              });
            }
          } catch (error) {
            console.error('Email sync error:', error);
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [currentEmail, t, toast]);

  // Restore settings dialog after OAuth redirect
  useEffect(() => {
    const shouldReopen = sessionStorage.getItem('settings-dialog-open');
    if (shouldReopen === 'true' && !open) {
      // Small delay to let the app initialize first
      const timer = setTimeout(() => {
        sessionStorage.removeItem('settings-dialog-open');
        onOpenChange(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, onOpenChange]);

  const handleImportClick = () => {
    // Show guidance toast on native platforms before opening file picker
    if (isNativePlatform()) {
      toast({
        title: t('settings.dataManagement.importHint'),
        description: t('settings.dataManagement.importHintDesc'),
        duration: 5000,
      });
    }
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        onImportData(data);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Failed to parse import file:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleManageSubscription = useCallback(async () => {
    setIsManagingSubscription(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: t('index.signInRequired'), variant: "destructive" });
        return;
      }
      
      const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
      const origin = isCapacitor ? 'https://app.ownjournal.app' : window.location.origin;
      
      const response = await supabase.functions.invoke('customer-portal', {
        body: { origin },
      });
      
      if (response.error) throw new Error(response.error.message);
      if (response.data?.url) window.location.href = response.data.url;
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      toast({
        title: t('settings.ai.portalError'),
        description: t('settings.ai.portalErrorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsManagingSubscription(false);
    }
  }, [t, toast]);

  const handleEmailChange = useCallback(async () => {
    // Prevent submission if current email wasn't fetched
    if (!currentEmail) {
      toast({
        title: t('settings.email.changeFailed'),
        description: t('settings.email.fetchFailed'),
        variant: "destructive",
      });
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: t('settings.email.invalidEmail'),
        variant: "destructive",
      });
      return;
    }

    // Check if same as current
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      toast({
        title: t('settings.email.sameEmail'),
        variant: "destructive",
      });
      return;
    }

    setIsChangingEmail(true);

    try {
      // Add timeout protection
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out')), 30000)
      );
      
      const updatePromise = supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: `${window.location.origin}/` }
      );

      const { error } = await Promise.race([updatePromise, timeoutPromise]);

      if (error) {
        throw error;
      }

      setPendingEmailChange(true);
      toast({
        title: t('settings.email.verificationSent'),
        description: t('settings.email.verificationSentDesc'),
        duration: 15000,
      });

    } catch (error: any) {
      console.error('Failed to initiate email change:', error);
      toast({
        title: t('settings.email.changeFailed'),
        description: error.message || t('settings.email.changeFailedDesc'),
        variant: "destructive",
      });
    } finally {
      setIsChangingEmail(false);
    }
  }, [newEmail, currentEmail, t, toast]);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== SAFETY_CONSTANTS.DELETE_ACCOUNT_CONFIRMATION) {
      return;
    }

    setIsDeleting(true);
    setDeletionProgress({ phase: 'local', current: 0, total: 1 });

    try {
      // Step 1: Delete local entries from IndexedDB + cloud data with progress
      if (import.meta.env.DEV) console.log('🗑️ Deleting local entries...');
      await storageServiceV2.deleteAllEntries((progress) => {
        setDeletionProgress(progress);
      });

      // Step 2: Clear encryption keys
      if (import.meta.env.DEV) console.log('🔑 Clearing encryption keys...');
      await storageServiceV2.clearMasterKey();

      // Step 3: Get current session for the API call
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      // Step 4: Call the delete-account edge function
      if (import.meta.env.DEV) console.log('🌐 Calling delete-account function...');
      const { error } = await supabase.functions.invoke('delete-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      // Step 5: Sign out
      if (import.meta.env.DEV) console.log('👋 Signing out...');
      await supabase.auth.signOut();

      // Show success toast
      toast({
        title: t('settings.deleteAccount.success'),
        description: t('settings.deleteAccount.successDesc'),
      });

      // Close dialog
      onOpenChange(false);

      // Call onSignOut callback if provided
      if (onSignOut) {
        onSignOut();
      }

    } catch (error) {
      console.error('Failed to delete account:', error);
      toast({
        title: t('settings.deleteAccount.failed'),
        description: t('settings.deleteAccount.failedDesc'),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmText("");
      setDeletionProgress(null);
    }
  };

  // Shared content between Dialog and Drawer
  const settingsContent = (
    <Tabs key={open ? 'tabs-open' : 'tabs-closed'} defaultValue={defaultTab} className="w-full">
      <TabsList className="flex flex-wrap gap-1 justify-start w-full">
        <TabsTrigger value="storage" className="flex-1 min-w-0">{t('settings.tabs.storage')}</TabsTrigger>
        <TabsTrigger value="preferences" className="flex-1 min-w-0">{t('settings.tabs.preferences')}</TabsTrigger>
        <TabsTrigger value="account" className="flex-1 min-w-0">{t('settings.tabs.account')}</TabsTrigger>
        <TabsTrigger value="diagnostics" className="flex-1 min-w-0">{t('settings.tabs.diagnostics')}</TabsTrigger>
      </TabsList>
      
      <TabsContent value="storage" className="space-y-4 mt-4">
        <StorageSecuritySettings
          onResetComplete={() => {
            toast({
              title: t('settings.resetComplete'),
              description: t('settings.resetCompleteDesc'),
            });
          }}
          onDeleteAllComplete={() => {
            window.location.reload();
          }}
        />
      </TabsContent>
      
      <TabsContent value="preferences" className="space-y-6 mt-4">

      {/* Journal Name */}
      <JournalNameSettings />

      {/* Language */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('settings.sections.language')}</h3>
        <LanguageSwitcher />
      </div>

      {/* Data Management */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('settings.sections.dataManagement')}</h3>
        
        {/* Cloud Sync vs Import/Export Explanation */}
        <div className="space-y-3 p-4 bg-gradient-subtle rounded-lg border">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Cloud className="w-4 h-4 text-primary" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">{t('settings.dataManagement.cloudSyncTitle')}</h4>
                <p className="text-xs text-muted-foreground">
                  {t('settings.dataManagement.cloudSyncDesc')}
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>✓ {t('settings.dataManagement.cloudFeature1')}</li>
                  <li>✓ {t('settings.dataManagement.cloudFeature2')}</li>
                  <li>✓ {t('settings.dataManagement.cloudFeature3')}</li>
                  <li>✓ {t('settings.dataManagement.cloudFeature4')}</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="h-px bg-border" />
          
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Download className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">{t('settings.dataManagement.backupTitle')}</h4>
                <p className="text-xs text-muted-foreground">
                  {t('settings.dataManagement.backupDesc')}
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                  <li>• {t('settings.dataManagement.backupFeature1')}</li>
                  <li>• {t('settings.dataManagement.backupFeature2')}</li>
                  <li>• {t('settings.dataManagement.backupFeature3')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Button onClick={onExportData} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            {t('settings.dataManagement.exportBackup')}
          </Button>
          <Button onClick={handleImportClick} variant="outline" className="w-full">
            <Upload className="w-4 h-4 mr-2" />
            {t('settings.dataManagement.importBackup')}
          </Button>
        </div>
        {onExportToFile && (
          <Button onClick={onExportToFile} variant="outline" className="w-full">
            <FileText className="w-4 h-4 mr-2" />
            {t('settings.dataManagement.exportFile')}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <p className="text-xs text-muted-foreground">
          {t('settings.dataManagement.backupNote')}
        </p>
      </div>

      {/* Appearance */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('settings.sections.appearance')}</h3>
        <Button onClick={onToggleTheme} variant="outline" className="w-full">
          {isDarkMode ? (
            <>
              <Sun className="w-4 h-4 mr-2" />
              {t('header.lightMode')}
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 mr-2" />
              {t('header.darkMode')}
            </>
          )}
        </Button>
      </div>

      {/* Legal */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('settings.sections.legal')}</h3>
        <div className="flex flex-col gap-2">
          <Link 
            to="/terms" 
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LegalIcon className="w-4 h-4" />
            {t('legal.termsOfService')}
          </Link>
          <Link 
            to="/privacy" 
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Shield className="w-4 h-4" />
            {t('legal.privacyPolicy')}
          </Link>
        </div>
      </div>

      </TabsContent>

      <TabsContent value="account" className="space-y-6 mt-4">
        {/* Subscription */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('settings.sections.subscription')}</h3>
          <SubscriptionBanner
            onUpgrade={onUpgrade}
            isPro={isPro}
            isLoading={isUpgrading}
            onManageSubscription={handleManageSubscription}
            isManagingSubscription={isManagingSubscription}
            hasStripeCustomer={!!stripeCustomerId}
            subscriptionStatus={subscriptionStatus}
            hasUsedTrial={hasUsedTrial}
          />
        </div>

        {/* Email Address */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('settings.sections.email')}</h3>
          <div className="space-y-3">
            {pendingEmailChange && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {t('settings.email.verificationSentDesc')}
              </p>
            )}
            <div className="flex gap-2">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t('settings.email.new')}
                className="flex-1"
                disabled={isChangingEmail}
              />
              <Button
                onClick={handleEmailChange}
                disabled={!newEmail || isChangingEmail}
                variant="outline"
              >
                {isChangingEmail ? t('common.loading') : t('settings.email.change')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('settings.email.verificationNote')}
            </p>
          </div>
        </div>

        {/* Sign Out */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('settings.sections.signOut')}</h3>
          <Button 
            onClick={onSignOut} 
            variant="outline" 
            className="w-full"
            disabled={!onSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t('header.signOut')}
          </Button>
        </div>

        {/* Delete Account - Danger Zone */}
        <div className="space-y-4 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">{t('settings.deleteAccount.title')}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('settings.deleteAccount.description')}
          </p>
          <p className="text-sm text-destructive font-medium">
            {t('settings.deleteAccount.warning')}
          </p>
          <div className="space-y-2">
            <label htmlFor="confirm-delete-account" className="text-sm font-medium">
              {t('settings.deleteAccount.confirmLabel')}
            </label>
            <Input
              id="confirm-delete-account"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={SAFETY_CONSTANTS.DELETE_ACCOUNT_CONFIRMATION}
              disabled={isDeleting}
              className="font-mono"
            />
          </div>
          {isDeleting && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{t('settings.deleteAccount.doNotClose')}</span>
            </div>
          )}
          {isDeleting && deletionProgress && (
            <div className="space-y-2">
              <Progress
                value={deletionProgress.total > 0 ? Math.round((deletionProgress.current / deletionProgress.total) * 100) : 0}
                className="h-2"
              />
            </div>
          )}
          <Button 
            onClick={handleDeleteAccount}
            variant="destructive"
            className="w-full"
            disabled={deleteConfirmText !== SAFETY_CONSTANTS.DELETE_ACCOUNT_CONFIRMATION || isDeleting}
          >
            {isDeleting ? (
              deletionProgress ? (
                deletionProgress.phase === 'local' 
                  ? t('settings.deleteAccount.deletingLocal')
                  : t('settings.deleteAccount.deletingCloud', { 
                      current: deletionProgress.current, 
                      total: deletionProgress.total 
                    })
              ) : t('common.loading')
            ) : t('settings.deleteAccount.button')}
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="diagnostics" className="space-y-4 mt-4">
        <SyncDiagnostics />
      </TabsContent>
    </Tabs>
  );


  // Mobile: Use full-height bottom drawer for native feel
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} modal={false}>
        <DrawerContent fullHeight hideHandle>
          <DrawerHeader className="text-left flex items-center justify-between pr-4">
            <DrawerTitle>{t('settings.title')}</DrawerTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t('common.close')}</span>
            </Button>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 px-4 pb-8">
            {settingsContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Keep the familiar dialog modal
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        aria-describedby="settings-dialog-description"
      >
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <p id="settings-dialog-description" className="sr-only">
            {t('settings.title')} - Configure storage, preferences, and diagnostics
          </p>
        </DialogHeader>
        {settingsContent}
      </DialogContent>
    </Dialog>
  );
};
