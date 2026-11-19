import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Shield, Loader2, AlertCircle, Languages, Gauge, WifiOff } from "lucide-react";
import { localAI } from "@/services/localAI";
import { aiPreloader } from "@/services/aiPreloader";
import { useToast } from "@/hooks/use-toast";
import { aiModeStorage } from "@/utils/aiModeStorage";
import { useTranslation } from "react-i18next";

interface ModelDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadComplete: () => void;
}

export const ModelDownloadDialog = ({ open, onOpenChange, onDownloadComplete }: ModelDownloadDialogProps) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const modelType = aiModeStorage.getModelType();
  const modelSize = modelType === 'multilingual' ? '~1.9GB' : '~550MB';
  const modelName = modelType === 'multilingual' ? t('modelDownload.multilingualName') : t('modelDownload.lightweightName');

  useEffect(() => {
    if (!open) {
      setDownloading(false);
      setProgress(0);
      setStatus("");
    }
  }, [open]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Check if already downloading via preloader
      const preloadStatus = aiPreloader.getStatus();
      if (preloadStatus === 'loading') {
        // Subscribe to existing preload
        const unsubscribe = aiPreloader.subscribe((status, prog, message) => {
          setStatus(message);
          setProgress(prog);
          
          if (status === 'ready') {
            toast({
              title: t('modelDownload.modelsReady'),
              description: t('modelDownload.modelsReadyDesc'),
            });
            unsubscribe();
            onDownloadComplete();
            onOpenChange(false);
          } else if (status === 'error') {
            toast({
              title: t('modelDownload.downloadFailed'),
              description: t('modelDownload.downloadFailedDesc'),
              variant: "destructive",
            });
            unsubscribe();
            setDownloading(false);
          }
        });
        return;
      }

      // Start new download
      await localAI.initialize((statusMsg, prog) => {
        setStatus(statusMsg);
        setProgress(prog);
      });

      toast({
        title: t('modelDownload.modelsReady'),
        description: t('modelDownload.modelsReadyDesc'),
      });
      onDownloadComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Model download error:', error);
      toast({
        title: t('modelDownload.downloadFailed'),
        description: t('modelDownload.downloadFailedDesc'),
        variant: "destructive",
      });
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!downloading) {
        onOpenChange(newOpen);
      }
    }}>
      <DialogContent aria-describedby="model-download-description">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium leading-snug">
            {t('modelDownload.title')}
          </DialogTitle>
          <DialogDescription id="model-download-description">
            {downloading
              ? t('modelDownload.downloading')
              : t('modelDownload.toUsePrivateAI', { size: modelSize })}
          </DialogDescription>
        </DialogHeader>

        {downloading ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="min-w-0 break-words">{status}</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>{t('modelDownload.mayTakeMinutes')}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="notice">
              {modelType === 'multilingual' ? (
                <Languages aria-hidden="true" />
              ) : (
                <Gauge aria-hidden="true" />
              )}
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{t('modelDownload.selected', { name: modelName })}</p>
                <p className="text-xs text-muted-foreground">
                  {modelType === 'multilingual'
                    ? t('modelDownload.multilingualDesc')
                    : t('modelDownload.lightweightDesc')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('modelDownload.changeInSettings')}
                </p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-seal mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{t('modelDownload.privateOnDevice')}</span>
              </li>
              <li className="flex items-start gap-2">
                <WifiOff className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{t('modelDownload.worksOffline')}</span>
              </li>
              <li className="flex items-start gap-2">
                <Download className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{t('modelDownload.oneTimeDownload', { size: modelSize })}</span>
              </li>
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={downloading}>
            {downloading ? t('modelDownload.cancel') : t('modelDownload.notNow')}
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                {t('modelDownload.downloadingBtn')}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('modelDownload.downloadModels')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
