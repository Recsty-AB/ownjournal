import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Key, Loader2, Eye, EyeOff, Trash2, CloudDownload } from "lucide-react";
import { storageServiceV2 } from "@/services/storageServiceV2";
import { storePassword } from "@/utils/passwordStorage";
import { setEncryptionMode } from "@/utils/encryptionModeStorage";
import { useToast } from "@/hooks/use-toast";

interface PasswordRecoveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  failedCount: number;
  totalCount: number;
  isKeyMismatch?: boolean;
  /** Called before showing the success toast and before dispatching encryption-initialized, so the parent can suppress the decrypt-failure modal. */
  onBeforeRecoveryComplete?: () => void;
  onRecoverySuccess: () => void;
}

export const PasswordRecoveryDialog = ({
  open,
  onOpenChange,
  failedCount,
  totalCount,
  isKeyMismatch = false,
  onBeforeRecoveryComplete,
  onRecoverySuccess,
}: PasswordRecoveryDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [originalPassword, setOriginalPassword] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isReloadingKey, setIsReloadingKey] = useState(false);

  const handleReloadKeyFromCloud = async () => {
    setIsReloadingKey(true);
    setError(null);
    try {
      const recovered = await storageServiceV2.tryRecoverMasterKeyFromProviders();
      if (recovered) {
        onBeforeRecoveryComplete?.();
        toast({
          title: t('recovery.success', 'Recovery successful'),
          description: t('recovery.reloadKeySuccessDesc', 'Encryption key reloaded from cloud. Your entries should now be visible.'),
        });
        window.dispatchEvent(new CustomEvent('encryption-initialized', { detail: { hasMasterKey: true } }));
        onRecoverySuccess();
        onOpenChange(false);
      } else {
        setError(t('recovery.reloadKeyFailed', 'No connected cloud storage has a key that can decrypt these entries. Check version history for encryption-key.json.'));
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Reload key from cloud failed:', err);
      setError(t('recovery.reloadKeyFailed', 'No connected cloud storage has a key that can decrypt these entries. Check version history for encryption-key.json.'));
    } finally {
      setIsReloadingKey(false);
    }
  };

  const handleRecover = async () => {
    if (!originalPassword.trim()) {
      setError(t('recovery.passwordRequired', 'Please enter your original password'));
      return;
    }

    setIsRecovering(true);
    setError(null);

    try {
      const verification = await storageServiceV2.verifyPasswordWithLocalCache(originalPassword);
      
      if (!verification.valid) {
        setError(t('recovery.wrongPassword', 'Incorrect password. Please try again with your original encryption password.'));
        return;
      }
      
      if (import.meta.env.DEV) {
        console.log(`✅ Password verified against ${verification.source}`);
      }
      
      await storageServiceV2.reinitializeWithPassword(originalPassword);
      setEncryptionMode('e2e');
      await storePassword(originalPassword);
      
      const entries = await storageServiceV2.getAllEntries({ skipDecryptionFailureEvent: true });
      
      // Suppress decrypt-failure modal before showing toast and dispatching event (encryption-initialized can trigger getAllEntries and decryption-failures)
      onBeforeRecoveryComplete?.();
      
      toast({
        title: t('recovery.success', 'Recovery successful'),
        description: t('recovery.successDesc', 'Recovered {{count}} entries', { count: entries.length }),
      });
      
      window.dispatchEvent(new CustomEvent('encryption-initialized', { 
        detail: { hasMasterKey: true } 
      }));
      
      onRecoverySuccess();
      onOpenChange(false);
      setOriginalPassword("");
    } catch (err) {
      if (import.meta.env.DEV) console.error('Recovery failed:', err);
      
      if (err instanceof Error) {
        if (err.message === 'DECRYPTION_FAILED') {
          setError(t('recovery.wrongPassword', 'Incorrect password. Please try again with your original encryption password.'));
        } else if (err.message === 'KEY_MISMATCH_ALL_PROVIDERS') {
          setError(t('recovery.keyCorrupted', 'The encryption key on all connected providers cannot decrypt your entries. If you used Google Drive, check its version history for a previous version of encryption-key.json in the OwnJournal folder.'));
        } else if (err.message === 'NO_CACHED_KEY') {
          setError(t('recovery.noCachedKey', 'No encryption data found locally. Connect to cloud storage to recover your entries.'));
        } else if (err.message === 'NO_CLOUD_KEY') {
          setError(t('recovery.noCloudKey', 'No encryption key found in cloud storage. The data may have been deleted.'));
        } else if (err.message === 'ENTRIES_WITHOUT_KEY') {
          setError(t('recovery.entriesWithoutKey', 'These entries were saved in Simple mode (unencrypted). Try switching to Simple mode in settings, or the entries may have been encrypted with a different password.'));
        } else if (err.message === 'NETWORK_ERROR_RETRY' || err.message === 'NETWORK_ERROR_CHECKING_KEY') {
          setError(t('recovery.networkError', 'Network error. Please check your connection and try again.'));
        } else if (err.message === 'MAX_RETRIES_EXCEEDED' || err.message.includes('RATE_LIMITED') || err.message.includes('429')) {
          setError(t('recovery.rateLimited', 'The cloud storage is temporarily limiting requests. Please wait 30-60 seconds and try again.'));
        } else {
          setError(t('recovery.failed', 'Recovery failed: {{error}}', { error: err.message }));
        }
      } else {
        setError(t('recovery.unknownError', 'An unknown error occurred'));
      }
    } finally {
      setIsRecovering(false);
    }
  };

  const handleDeleteUnrecoverable = async () => {
    setIsDeleting(true);
    try {
      const count = await storageServiceV2.deleteUnrecoverableEntries();
      toast({
        title: t('recovery.deletedTitle', 'Entries removed'),
        description: t('recovery.deletedDesc', 'Removed {{count}} unrecoverable entries', { count }),
      });
      onRecoverySuccess();
      onOpenChange(false);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to delete unrecoverable entries:', err);
      setError(t('recovery.deleteFailed', 'Failed to remove entries. Please try again.'));
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isRecovering) {
      handleRecover();
    }
  };

  const busy = isRecovering || isDeleting || isReloadingKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md"
        aria-describedby="recovery-dialog-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('recovery.title', 'Recover encrypted entries')}
          </DialogTitle>
          <DialogDescription id="recovery-dialog-description">
            {t('recovery.description', 'Some entries could not be decrypted.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">
              {t('recovery.failedEntries', '{{count}} of {{total}} entries failed to decrypt', {
                count: failedCount,
                total: totalCount,
              })}
            </p>
            {isKeyMismatch ? (
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  {t('recovery.keyMismatchExplanation',
                    'The encryption key that can decrypt these entries does not match the one currently in use. You can try reloading the key from cloud storage.'
                  )}
                </p>
                <p className="font-medium">
                  {t('recovery.keyMismatchRecoveryHint',
                    'You may be able to recover the original key from your cloud storage version history (e.g. Google Drive or Nextcloud file versions for encryption-key.json in the OwnJournal folder).'
                  )}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-muted-foreground">
                {t('recovery.explanation', 
                  'This usually happens when the encryption password was changed. Enter your original password to recover the entries.'
                )}
              </p>
            )}
          </div>

          {!isKeyMismatch && (
            <div className="space-y-2">
              <Label htmlFor="original-password" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                {t('recovery.originalPassword', 'Original encryption password')}
              </Label>
              <div className="relative">
                <Input
                  id="original-password"
                  type={showPassword ? "text" : "password"}
                  value={originalPassword}
                  onChange={(e) => setOriginalPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('recovery.passwordPlaceholder', 'Enter your original password...')}
                  disabled={busy}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          )}

          {isKeyMismatch && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {isKeyMismatch ? (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t('recovery.keyMismatchHint1', '• The encryption key in cloud storage does not match the key used to encrypt these entries')}</p>
              <p>{t('recovery.keyMismatchHint2', '• Check Google Drive or Nextcloud version history for an older encryption-key.json')}</p>
              <p>{t('recovery.keyMismatchHint3', '• If another device still has the correct key cached, connect from that device first')}</p>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t('recovery.hint1', '• This is the password you first used to set up encryption')}</p>
              <p>{t('recovery.hint2', '• Your encrypted entries are NOT lost - they just need the correct password')}</p>
              <p>{t('recovery.hint3', '• If you cannot remember the password, entries may be unrecoverable')}</p>
            </div>
          )}

          {/* Delete unrecoverable entries section */}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2 cursor-pointer"
            >
              {t('recovery.deleteLink', 'Or remove the unrecoverable entries permanently')}
            </button>
          ) : (
            <div className="rounded-lg border border-destructive/30 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive">
                {t('recovery.confirmDelete', 'This will permanently delete {{count}} entries that cannot be decrypted. This cannot be undone.', {
                  count: failedCount,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteUnrecoverable}
                  disabled={busy}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {t('recovery.confirmDeleteButton', 'Delete permanently')}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {isKeyMismatch ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
          </Button>
          {isKeyMismatch ? (
            <Button
              onClick={handleReloadKeyFromCloud}
              disabled={busy}
            >
              {isReloadingKey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('recovery.reloadingKey', 'Reloading...')}
                </>
              ) : (
                <>
                  <CloudDownload className="mr-2 h-4 w-4" />
                  {t('recovery.reloadKeyFromCloud', 'Reload key from cloud')}
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleRecover}
              disabled={busy || !originalPassword.trim()}
            >
              {isRecovering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('recovery.recovering', 'Recovering...')}
                </>
              ) : (
                t('recovery.recoverButton', 'Recover entries')
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
