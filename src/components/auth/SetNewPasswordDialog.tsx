import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { translateAuthError } from "@/utils/authErrorTranslator";

interface SetNewPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SetNewPasswordDialog = ({ open, onClose, onSuccess }: SetNewPasswordDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: t('auth.passwordMismatch'),
        description: t('auth.passwordMismatchDesc'),
        variant: "destructive",
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        title: t('common.error'),
        description: t('auth.passwordTooShort', 'Password must be at least 6 characters'),
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      toast({
        title: t('auth.passwordUpdated'),
        description: t('auth.passwordUpdatedDesc'),
      });
      
      // Reset form and close dialog
      setPassword("");
      setConfirmPassword("");
      onSuccess?.();
      onClose();
    } catch (error) {
      const { title, description } = translateAuthError(error as Error, t);
      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        aria-describedby="set-new-password-description"
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-medium leading-snug">{t('auth.setNewPassword')}</DialogTitle>
          <DialogDescription id="set-new-password-description">
            {t('auth.setNewPasswordDesc')}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('auth.newPassword')}</Label>
            <div className="relative">
              <Input
                id="new-password"
                aria-describedby="new-password-requirements"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                disabled={isLoading}
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
            <p id="new-password-requirements" className="text-xs text-muted-foreground">
              {t('auth.passwordRequirements')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('auth.confirmNewPassword')}</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
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
          
          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('common.loading')}
                </>
              ) : (
                t('auth.updatePassword')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
