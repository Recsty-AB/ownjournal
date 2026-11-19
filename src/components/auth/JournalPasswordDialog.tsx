import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Lock, AlertTriangle, Eye, EyeOff, ChevronDown, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { getPasswordPersistenceMode, setPasswordPersistenceMode, type PasswordPersistenceMode } from "@/utils/passwordPersistenceSettings";
import { translateCloudError } from "@/utils/translateCloudError";

interface JournalPasswordDialogProps {
  open: boolean;
  onPasswordSet: (password: string) => Promise<void>;
  isOAuthUser?: boolean;
  errorMessage?: string;
  onDismiss?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export const JournalPasswordDialog = ({ 
  open, 
  onPasswordSet,
  isOAuthUser = false,
  errorMessage,
  onDismiss,
  onOpenChange
}: JournalPasswordDialogProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [persistenceMode, setPersistenceMode] = useState<PasswordPersistenceMode>(getPasswordPersistenceMode);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handlePersistenceChange = (mode: PasswordPersistenceMode) => {
    setPersistenceMode(mode);
    setPasswordPersistenceMode(mode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Trim passwords to avoid whitespace issues
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();
    
    if (trimmedPassword.length < 12) {
      toast({
        title: t('encryption.passwordTooShort'),
        description: t('encryption.chooseStrongPassword'),
        variant: "destructive",
      });
      return;
    }
    
    if (trimmedPassword !== trimmedConfirmPassword) {
      toast({
        title: t('encryption.passwordsDontMatch'),
        description: t('encryption.passwordsDontMatch'),
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    try {
      await onPasswordSet(trimmedPassword);
      // Don't show toast here - parent component will show context-specific toasts
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.error');
      toast({
        title: t('common.error'),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
      modal={true}
    >
      <DialogContent 
        className="sm:max-w-md"
        aria-describedby="password-dialog-description"
        onInteractOutside={(e) => {
          // Prevent closing by clicking outside during loading
          if (isLoading) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with Escape during loading
          if (isLoading) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="items-center space-y-3 sm:text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-soft">
            <Lock className="h-5 w-5 text-seal" aria-hidden="true" />
          </div>
          <DialogTitle className="text-xl font-medium leading-snug">{t('encryption.setPassword')}</DialogTitle>
          <DialogDescription asChild>
            <div id="password-dialog-description" className="space-y-2 text-center text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{t('storage.e2eMode')}:</span> {t('encryption.e2eExplanation')}
              </p>
              <p className="text-xs">
                {t('encryption.chooseStrongPassword')}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="notice notice-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{t('password.encryptionKeyError')}</p>
              <p>{translateCloudError(new Error(errorMessage), t)}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="journal-password">{t('encryption.journalPassword')}</Label>
            <div className="relative">
              <Input
                id="journal-password"
                type={showPassword ? "text" : "password"}
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={12}
                disabled={isLoading}
                autoFocus
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? t('ai.hide') : t('ai.show')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('encryption.confirmPassword')}</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder={t('auth.passwordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={12}
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
                aria-label={showConfirmPassword ? t('ai.hide') : t('ai.show')}
                aria-pressed={showConfirmPassword}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 text-xs text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">{t('encryption.howE2EWorks')}:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('encryption.e2eExplanation')}</li>
              </ul>
            </div>
          </div>

          {/* Losing this password loses the journal, so it is the one callout here; a caution, not an error. */}
          <div className="notice notice-warning">
            <AlertTriangle aria-hidden="true" />
            <div className="min-w-0 space-y-1 text-xs">
              <p className="font-medium">{t('encryption.criticalSavePassword')}!</p>
              <p>{t('encryption.chooseStrongPassword')}</p>
            </div>
          </div>

          {/* Password Storage Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="border-t border-border pt-2">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 w-full justify-between px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('storage.passwordPersistence.title', 'Password Storage')}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} aria-hidden="true" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 px-2 pt-2">
              <p className="text-xs text-muted-foreground">
                {t('storage.passwordPersistence.description', 'Choose how your password is remembered on this device.')}
              </p>

              {!!(window as any).Capacitor?.isNativePlatform?.() && (window as any).Capacitor?.getPlatform?.() === 'ios' ? (
                <select
                  value={persistenceMode}
                  onChange={(e) => handlePersistenceChange(e.target.value as any)}
                  aria-label={t('storage.passwordPersistence.title', 'Password Storage')}
                  className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value="localStorage">{t('storage.passwordPersistence.localStorage', 'Remember across sessions')}</option>
                  <option value="sessionStorage">{t('storage.passwordPersistence.sessionStorage', 'Remember until browser closes')}</option>
                  <option value="none">{t('storage.passwordPersistence.none', 'Never remember (most secure)')}</option>
                </select>
              ) : (
                <Select value={persistenceMode} onValueChange={handlePersistenceChange}>
                  <SelectTrigger className="w-full" aria-label={t('storage.passwordPersistence.title', 'Password Storage')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="localStorage">
                      {t('storage.passwordPersistence.localStorage', 'Remember across sessions')}
                    </SelectItem>
                    <SelectItem value="sessionStorage">
                      {t('storage.passwordPersistence.sessionStorage', 'Remember until browser closes')}
                    </SelectItem>
                    <SelectItem value="none">
                      {t('storage.passwordPersistence.none', 'Never remember (most secure)')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}

              <p className="text-xs text-muted-foreground">
                {persistenceMode === 'localStorage' && t('storage.passwordPersistence.localStorageHint', 'Password will be securely encrypted and saved locally. You won\'t need to re-enter it.')}
                {persistenceMode === 'sessionStorage' && t('storage.passwordPersistence.sessionStorageHint', 'Password will be cleared when you close your browser. Good for shared computers.')}
                {persistenceMode === 'none' && t('storage.passwordPersistence.noneHint', 'You\'ll need to enter your password each time you access your journal.')}
              </p>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={onDismiss}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  {t('common.loading')}
                </>
              ) : (
                t('encryption.setPasswordContinue')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
