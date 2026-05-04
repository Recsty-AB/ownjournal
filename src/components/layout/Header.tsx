import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SyncStatusIndicator } from "@/components/sync/SyncStatusIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  Crown,
  LogOut,
  User,
  Menu,
  Moon,
  Sun,
  Download,
  Upload,
  RotateCw,
  ArrowLeft,
  FileText,
  HelpCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { isNativePlatform } from "@/utils/nativeExport";
import { canShowPurchaseCTA } from "@/utils/platformDetection";
import logo from "@/assets/logo.png";

interface User {
  name: string;
  email: string;
  avatar?: string;
  isPro?: boolean;
}

interface HeaderProps {
  user?: User;
  onSignOut?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onExportData?: () => void;
  onImportData?: (data: unknown) => void;
  onExportToFile?: () => void;
  onSync?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  syncStatus?: "idle" | "syncing" | "success" | "error" | "offline";
  lastSyncTime?: Date | null;
  connectedProviders?: string[];
  onOpenHelp?: () => void;
  isProgressExpanded?: boolean;
  onToggleProgressExpanded?: () => void;
}

export const Header = ({
  user,
  onSignOut,
  onOpenSettings,
  onExportData,
  onImportData,
  onExportToFile,
  onSync,
  isDarkMode,
  onToggleTheme,
  showBackButton,
  onBack,
  syncStatus = "idle",
  lastSyncTime = null,
  connectedProviders = [],
  onOpenHelp,
  isProgressExpanded,
  onToggleProgressExpanded,
}: HeaderProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const { toast } = useToast();

  const handleSync = async () => {
    if (onSync) {
      setIsSyncing(true);
      try {
        await onSync();
      } finally {
        setIsSyncing(false);
      }
    }
  };

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
        onImportData?.(data);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        console.error("Failed to parse import file:", error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <header className="sticky top-0 z-[100] w-full border-b border-border bg-background/80 backdrop-blur-md" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo / Back Button */}
        <div className="flex items-center gap-3 mr-2 sm:mr-0">
          {showBackButton ? (
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>{t("header.back")}</span>
            </Button>
          ) : (
            <>
              <img src={logo} alt="OwnJournal" className="w-8 h-8 object-contain" />
              <div>
                <h1 className="text-xl font-bold text-foreground">{t("app.name")}</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">{t("app.tagline")}</p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Sync Status Indicator (only when user is authenticated) */}
          {user && (
            <>
              <div className="tour-sync-status">
                <SyncStatusIndicator
                  status={syncStatus}
                  lastSyncTime={lastSyncTime}
                  onSync={handleSync}
                  connectedProviders={connectedProviders}
                  isProgressExpanded={isProgressExpanded}
                  onToggleProgressExpanded={onToggleProgressExpanded}
                />
              </div>
              {/* Settings buttons - wrapped in tour-settings for onboarding targeting */}
              <span className="tour-settings inline-flex items-center">
                {/* Mobile-only icon button for settings */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenSettings?.()}
                  className="sm:hidden"
                  title={t("header.settings")}
                  aria-label={t("header.settings")}
                >
                  <Settings aria-hidden="true" className="w-5 h-5" />
                </Button>
                {/* Desktop settings button with text */}
                <Button variant="outline" size="sm" onClick={() => onOpenSettings?.()} className="hidden sm:flex">
                  <Settings className="w-5 h-5 mr-2" />
                  {t("header.settings")}
                </Button>
              </span>
              {/* Help buttons - wrapped in tour-help for onboarding targeting */}
              <span className="tour-help inline-flex items-center">
                {/* Mobile help button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenHelp}
                  className="sm:hidden"
                  title={t("header.help")}
                  aria-label={t("header.help")}
                >
                  <HelpCircle aria-hidden="true" className="w-5 h-5" />
                </Button>
                {/* Desktop help button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onOpenHelp} 
                  className="hidden sm:flex"
                  title={t("header.help")}
                >
                  <HelpCircle className="w-5 h-5" />
                </Button>
              </span>
            </>
          )}


          {/* Theme Toggle */}
          <Button variant="ghost" size="sm" onClick={onToggleTheme} className="hidden sm:flex" aria-label={isDarkMode ? t('header.switchToLightMode', 'Switch to light mode') : t('header.switchToDarkMode', 'Switch to dark mode')}>
            {isDarkMode ? <Sun aria-hidden="true" className="w-5 h-5" /> : <Moon aria-hidden="true" className="w-5 h-5" />}
          </Button>

          {/* User Menu */}
          {user ? (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-11 w-11 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  {user.isPro && <Crown className="absolute -top-1 -right-1 w-4 h-4 text-yellow-500" />}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent className="w-56 z-[200]" align="end">
                <div 
                  className="flex items-center justify-start gap-2 p-2 cursor-pointer rounded-sm hover:bg-accent transition-colors"
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenSettings?.("account");
                  }}
                >
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    {user.isPro ? (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <Crown className="w-3 h-3" />
                        <span className="text-xs">{t("header.proMember")}</span>
                      </div>
                    ) : canShowPurchaseCTA() ? (
                      // "Free Plan" implies a paid plan exists; without IAP
                      // we can't reference plan tiers on Capacitor iOS/Android
                      // (App Store guideline 3.1.1). Web/desktop only.
                      <span className="text-xs text-muted-foreground">
                        {t("subscription.freePlan")}
                      </span>
                    ) : null}
                  </div>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => onOpenSettings?.()} className="cursor-pointer">
                  <Settings className="mr-2 h-5 w-5" />
                  <span>{t("header.settings")}</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onExportData} className="cursor-pointer">
                  <Download className="mr-2 h-5 w-5" />
                  <span>{t("header.exportData")}</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleImportClick} className="cursor-pointer">
                  <Upload className="mr-2 h-5 w-5" />
                  <span>{t("header.importData")}</span>
                </DropdownMenuItem>

                {/* PDF/Word export is Plus-only. On native (iOS/Android) free
                    users we hide the entry point entirely to avoid showing a
                    locked feature that references a paid tier without an IAP
                    product. Pro users on native still see it. */}
                {(user?.isPro || canShowPurchaseCTA()) && (
                  <DropdownMenuItem onClick={onExportToFile} className="cursor-pointer">
                    <FileText className="mr-2 h-5 w-5" />
                    <span>{t("settings.dataManagement.exportFile")}</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={onToggleTheme} className="cursor-pointer sm:hidden">
                  {isDarkMode ? (
                    <>
                      <Sun className="mr-2 h-5 w-5" />
                      <span>{t("header.lightMode")}</span>
                    </>
                  ) : (
                    <>
                      <Moon className="mr-2 h-5 w-5" />
                      <span>{t("header.darkMode")}</span>
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={onSignOut} className="cursor-pointer text-destructive">
                  <LogOut className="mr-2 h-5 w-5" />
                  <span>{t("header.signOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button className="bg-gradient-primary">
              <User className="w-4 h-4 mr-2" />
              {t("header.signIn")}
            </Button>
          )}
        </div>
      </div>

      {/* Hidden file input for import */}
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
    </header>
  );
};
