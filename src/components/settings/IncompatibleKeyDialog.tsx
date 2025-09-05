import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Trash2, FileSearch, Info, FolderSync } from "lucide-react";
import { useTranslation } from "react-i18next";

interface IncompatibleKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerName: string | null;
  onDisconnectAndReset: () => void;
}

export const IncompatibleKeyDialog = ({
  open,
  onOpenChange,
  providerName,
  onDisconnectAndReset,
}: IncompatibleKeyDialogProps) => {
  const { t } = useTranslation();

  const handleDisconnectAndReset = () => {
    onDisconnectAndReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]" aria-describedby="incompatible-key-dialog-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('incompatibleKey.title')}
          </DialogTitle>
          <DialogDescription id="incompatible-key-dialog-description">
            {t('incompatibleKey.description', { provider: providerName || 'Cloud' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Why this happened */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">{t('incompatibleKey.possibleCauses')}</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{t('incompatibleKey.cause1')}</li>
                <li>{t('incompatibleKey.cause2')}</li>
                <li>{t('incompatibleKey.cause3')}</li>
                <li>{t('incompatibleKey.cause4')}</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Option 1: Start Fresh (Recommended) */}
          <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{t('incompatibleKey.option1Title')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('incompatibleKey.option1Desc', { provider: providerName || 'cloud storage' })}
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={handleDisconnectAndReset}
              className="w-full"
            >
              <Trash2 className="h-3 w-3 mr-2" />
              {t('incompatibleKey.disconnectAndReset')}
            </Button>
          </div>

          {/* Option 2: After Migration */}
          <div className="p-4 border rounded-lg bg-accent/30 space-y-3">
            <div className="flex items-center gap-2">
              <FolderSync className="h-4 w-4 text-accent-foreground" />
              <span className="font-semibold text-sm">{t('incompatibleKey.option3Title')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('incompatibleKey.option3Desc')}
            </p>
            <div className="text-xs bg-muted p-2 rounded font-mono space-y-1">
              <p className="text-muted-foreground">{t('incompatibleKey.moveFrom')}:</p>
              <code>/encryption-key.json</code>
              <p className="text-muted-foreground mt-1">{t('incompatibleKey.moveTo')}:</p>
              <code>/OwnJournal/encryption-key.json</code>
            </div>
          </div>

          {/* Option 3: Check the File */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{t('incompatibleKey.option2Title')}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('incompatibleKey.option2Desc')}
            </p>
            <div className="text-xs bg-muted p-2 rounded font-mono">
              OwnJournal/encryption-key.json
            </div>
            <p className="text-xs text-muted-foreground">
              {t('incompatibleKey.requiredFields')}
            </p>
            <code className="text-xs bg-muted px-2 py-1 rounded block">
              {`{ encryptedKey, iv, salt }`}
            </code>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('incompatibleKey.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
