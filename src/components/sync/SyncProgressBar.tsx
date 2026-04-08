import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { storageServiceV2 } from "@/services/storageServiceV2";
import type { GranularSyncProgress, SyncPhase } from "@/services/storageServiceV2";
import { Cloud, Download, Upload, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SyncProgressBarProps {
  className?: string;
  isExpanded: boolean;
}

export const SyncProgressBar = ({ className, isExpanded }: SyncProgressBarProps) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<GranularSyncProgress | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check for existing progress on mount
    const current = storageServiceV2.getCurrentSyncProgress();
    if (current) {
      setProgress(current);
      setIsVisible(true);
    }

    // Subscribe to progress updates
    const unsubscribe = storageServiceV2.onSyncProgress((newProgress) => {
      setProgress(newProgress);
      setIsVisible(true);
    });

    // Subscribe to status changes to hide when done
    const unsubscribeStatus = storageServiceV2.onStatusChange((status) => {
      if (status !== 'syncing') {
        // Fade out after a short delay
        setTimeout(() => {
          setIsVisible(false);
          setProgress(null);
        }, 500);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, []);

  // Don't render if not expanded or no progress
  if (!isExpanded || !isVisible || !progress) {
    return null;
  }

  const getPhaseIcon = (phase: SyncPhase) => {
    switch (phase) {
      case 'preparing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'checking-cloud':
        return <Cloud className="w-4 h-4" />;
      case 'downloading':
        return <Download className="w-4 h-4" />;
      case 'uploading':
        return <Upload className="w-4 h-4" />;
      case 'finalizing':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />;
    }
  };

  const getPhaseText = (phase: SyncPhase): string => {
    switch (phase) {
      case 'preparing':
        return t('syncProgress.preparing', 'Preparing sync...');
      case 'checking-cloud':
        return t('syncProgress.checkingCloud', 'Checking cloud files...');
      case 'downloading':
        return t('syncProgress.downloading', 'Downloading entries...');
      case 'uploading':
        return t('syncProgress.uploading', 'Uploading entries...');
      case 'finalizing':
        return t('syncProgress.finalizing', 'Finalizing sync...');
      default:
        return t('syncProgress.syncing', 'Syncing...');
    }
  };

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 py-2 transition-all duration-300",
        isExpanded && isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full",
        className
      )}
      style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-primary">
            {getPhaseIcon(progress.phase)}
          </span>
          <span className="text-sm font-medium">
            {progress.message ? t(progress.message) : getPhaseText(progress.phase)}
          </span>
          {progress.totalFiles > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {progress.filesProcessed}/{progress.totalFiles}
            </span>
          )}
        </div>
        <Progress 
          value={progress.percentComplete} 
          className="h-1.5"
        />
      </div>
    </div>
  );
};
