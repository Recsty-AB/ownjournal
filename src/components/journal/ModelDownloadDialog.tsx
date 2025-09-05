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
import { Download, Shield, Loader2, AlertCircle, Languages, Gauge } from "lucide-react";
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
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            {t('modelDownload.title')}
          </DialogTitle>
          <DialogDescription id="model-download-description" className="space-y-3 pt-2">
            {downloading ? (
              <>
                <p>{t('modelDownload.downloading')}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{status}</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{t('modelDownload.mayTakeMinutes')}</span>
                </div>
              </>
            ) : (
              <>
                <p>{t('modelDownload.toUsePrivateAI', { size: modelSize })}</p>
                <div className="p-3 bg-muted/50 rounded-lg mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    {modelType === 'multilingual' ? (
                      <Languages className="w-4 h-4 text-primary" />
                    ) : (
                      <Gauge className="w-4 h-4 text-primary" />
                    )}
                    <span>{t('modelDownload.selected', { name: modelName })}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {modelType === 'multilingual' 
                      ? t('modelDownload.multilingualDesc')
                      : t('modelDownload.lightweightDesc')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('modelDownload.changeInSettings')}
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{t('modelDownload.privateOnDevice')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{t('modelDownload.worksOffline')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Download className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{t('modelDownload.oneTimeDownload', { size: modelSize })}</span>
                  </div>
                </div>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>
            {downloading ? t('modelDownload.cancel') : t('modelDownload.notNow')}
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('modelDownload.downloadingBtn')}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {t('modelDownload.downloadModels')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
