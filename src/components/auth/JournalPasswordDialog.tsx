import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Key, Lock, AlertTriangle, Eye, EyeOff, ChevronDown, Settings2 } from "lucide-react";
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
        <DialogHeader>
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
            <Key className="w-6 h-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center">{t('encryption.setPassword')}</DialogTitle>
          <DialogDescription id="password-dialog-description" className="text-center space-y-2">
            <p className="text-sm">
              <span className="font-medium text-primary">{t('storage.e2eMode')}:</span> {t('encryption.e2eExplanation')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('encryption.chooseStrongPassword')}
            </p>
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="bg-destructive/10 border border-destructive text-destructive rounded-md p-3 text-sm">
            <div className="font-semibold mb-1">{t('password.encryptionKeyError')}</div>
            <p>{translateCloudError(new Error(errorMessage), t)}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">{t('encryption.howE2EWorks')}:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{t('encryption.e2eExplanation')}</li>
                </ul>
              </div>
            </div>
            
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded p-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-destructive">{t('encryption.criticalSavePassword')}!</p>
                <p className="text-destructive/90 mt-1">
                  {t('encryption.chooseStrongPassword')}
                </p>
              </div>
            </div>
          </div>

          {/* Password Storage Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button 
                type="button"
                variant="ghost" 
                size="sm" 
                className="w-full justify-between text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Settings2 className="w-3 h-3" />
                  {t('storage.passwordPersistence.title', 'Password Storage')}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('storage.passwordPersistence.description', 'Choose how your password is remembered on this device.')}
              </p>
              
              {!!(window as any).Capacitor?.isNativePlatform?.() && (window as any).Capacitor?.getPlatform?.() === 'ios' ? (
                <select
                  value={persistenceMode}
                  onChange={(e) => handlePersistenceChange(e.target.value as any)}
                  className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value="localStorage">{t('storage.passwordPersistence.localStorage', 'Remember across sessions')}</option>
                  <option value="sessionStorage">{t('storage.passwordPersistence.sessionStorage', 'Remember until browser closes')}</option>
                  <option value="none">{t('storage.passwordPersistence.none', 'Never remember (most secure)')}</option>
                </select>
              ) : (
                <Select value={persistenceMode} onValueChange={handlePersistenceChange}>
                  <SelectTrigger className="w-full">
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
              
              <p className="text-xs text-muted-foreground/80 italic">
                {persistenceMode === 'localStorage' && t('storage.passwordPersistence.localStorageHint', 'Password will be securely encrypted and saved locally. You won\'t need to re-enter it.')}
                {persistenceMode === 'sessionStorage' && t('storage.passwordPersistence.sessionStorageHint', 'Password will be cleared when you close your browser. Good for shared computers.')}
                {persistenceMode === 'none' && t('storage.passwordPersistence.noneHint', 'You\'ll need to enter your password each time you access your journal.')}
              </p>
            </CollapsibleContent>
          </Collapsible>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-white" />
                {t('common.loading')}
              </>
            ) : (
              t('encryption.setPasswordContinue')
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={onDismiss}
          >
            {t('common.cancel')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};