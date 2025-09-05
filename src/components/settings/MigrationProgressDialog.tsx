import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MigrationProgress {
  phase: 'preparing' | 'entries' | 'credentials' | 'complete' | 'error';
  currentItem: number;
  totalItems: number;
  migratedCount: number;
  failedCount: number;
  currentEntryTitle?: string;
  errorMessage?: string;
}

interface MigrationProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  progress: MigrationProgress;
  direction: 'simple-to-e2e' | 'e2e-to-simple';
  onComplete?: () => void;
  onRetry?: () => void;
}

export const MigrationProgressDialog = ({
  open,
  onOpenChange,
  progress,
  direction,
  onComplete,
  onRetry,
}: MigrationProgressDialogProps) => {
  const { t } = useTranslation();
  
  const percentage = progress.totalItems > 0 
    ? Math.round((progress.currentItem / progress.totalItems) * 100)
    : 0;
  
  const getPhaseLabel = () => {
    switch (progress.phase) {
      case 'preparing':
        return t('migration.preparing', 'Preparing migration...');
      case 'entries':
        return direction === 'simple-to-e2e' 
          ? t('migration.encryptingEntries', 'Encrypting entries...')
          : t('migration.decryptingEntries', 'Decrypting entries...');
      case 'credentials':
        return t('migration.migratingCredentials', 'Migrating credentials...');
      case 'complete':
        return t('migration.complete', 'Migration complete!');
      case 'error':
        return t('migration.error', 'Migration failed');
      default:
        return '';
    }
  };
  
  const getIcon = () => {
    switch (progress.phase) {
      case 'preparing':
      case 'entries':
      case 'credentials':
        return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-destructive" />;
      default:
        return null;
    }
  };
  
  const canClose = progress.phase === 'complete' || progress.phase === 'error';
  
  return (
    <Dialog open={open} onOpenChange={(o) => canClose && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => !canClose && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {direction === 'simple-to-e2e' 
              ? t('migration.toE2ETitle', 'Enabling E2E Encryption')
              : t('migration.toSimpleTitle', 'Switching to Simple Mode')
            }
          </DialogTitle>
          <DialogDescription>
            {direction === 'simple-to-e2e'
              ? t('migration.toE2EDesc', 'Your entries are being encrypted with your password.')
              : t('migration.toSimpleDesc', 'Your entries are being decrypted for simple storage.')
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Phase Label */}
          <div className="text-sm font-medium">{getPhaseLabel()}</div>
          
          {/* Progress Bar */}
          {(progress.phase === 'entries' || progress.phase === 'credentials') && (
            <div className="space-y-2">
              <Progress value={percentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.currentItem} / {progress.totalItems}</span>
                <span>{percentage}%</span>
              </div>
            </div>
          )}
          
          {/* Current Entry */}
          {progress.currentEntryTitle && progress.phase === 'entries' && (
            <div className="text-xs text-muted-foreground truncate">
              {t('migration.processingEntry', 'Processing: {{title}}', { title: progress.currentEntryTitle })}
            </div>
          )}
          
          {/* Stats */}
          {(progress.phase === 'complete' || progress.phase === 'error') && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{t('migration.migrated', '{{count}} entries migrated', { count: progress.migratedCount })}</span>
              </div>
              {progress.failedCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{t('migration.failed', '{{count}} entries failed', { count: progress.failedCount })}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Error Message */}
          {progress.errorMessage && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
              {progress.errorMessage}
            </div>
          )}
          
          {/* Actions */}
          {canClose && (
            <div className="flex justify-end gap-2 pt-2">
              {progress.phase === 'error' && onRetry && (
                <Button variant="outline" onClick={onRetry}>
                  {t('common.retry', 'Retry')}
                </Button>
              )}
              <Button onClick={() => {
                onOpenChange(false);
                onComplete?.();
              }}>
                {progress.phase === 'complete' 
                  ? t('common.done', 'Done') 
                  : t('common.close', 'Close')
                }
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
