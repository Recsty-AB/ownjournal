import { useState } from "react";
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
import { Shield, AlertTriangle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CloudEncryptedDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnect: () => void;
  onStartFresh: () => void;
}

export const CloudEncryptedDataDialog = ({
  open,
  onOpenChange,
  onDisconnect,
  onStartFresh,
}: CloudEncryptedDataDialogProps) => {
  const [showWarning, setShowWarning] = useState(false);
  const { t } = useTranslation();

  const handleStartFresh = () => {
    setShowWarning(true);
  };

  const confirmStartFresh = () => {
    onStartFresh();
    setShowWarning(false);
    onOpenChange(false);
  };

  const handleDisconnect = () => {
    onDisconnect();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" aria-describedby="cloud-encrypted-dialog-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t('cloudEncrypted.title')}
          </DialogTitle>
          <DialogDescription id="cloud-encrypted-dialog-description">
            {t('cloudEncrypted.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t('cloudEncrypted.cannotAccessInSimple')}
            </AlertDescription>
          </Alert>

          {!showWarning ? (
            <div className="space-y-3">
              <Button
                variant="default"
                className="w-full justify-start h-auto py-4 px-4"
                onClick={handleDisconnect}
              >
                <div className="text-left">
                  <div className="font-semibold mb-1">{t('cloudEncrypted.reconnectE2E')}</div>
                  <div className="text-xs opacity-90 font-normal">
                    {t('cloudEncrypted.reconnectE2EDesc')}
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4 px-4"
                onClick={handleStartFresh}
              >
                <div className="text-left">
                  <div className="font-semibold mb-1">{t('cloudEncrypted.startFresh')}</div>
                  <div className="text-xs opacity-70 font-normal">
                    {t('cloudEncrypted.startFreshDesc')}
                  </div>
                </div>
              </Button>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <p className="font-semibold">{t('cloudEncrypted.warning')}</p>
                  <p className="text-xs">
                    {t('cloudEncrypted.warningDesc')}
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={confirmStartFresh}
                    >
                      {t('cloudEncrypted.confirmDelete')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowWarning(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
