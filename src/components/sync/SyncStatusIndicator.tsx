import { useState, useEffect } from "react";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { storageServiceV2 } from "@/services/storageServiceV2";

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  lastSyncTime?: Date;
  onSync?: () => void;
  connectedProviders: string[];
  isProgressExpanded?: boolean;
  onToggleProgressExpanded?: () => void;
}

export const SyncStatusIndicator = ({
  status,
  lastSyncTime,
  onSync,
  connectedProviders,
  isProgressExpanded,
  onToggleProgressExpanded
}: SyncStatusIndicatorProps) => {
  const { t } = useTranslation();
  const [showNudge, setShowNudge] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  
  // Listen for onboarding completion to show nudge
  useEffect(() => {
    const handleOnboardingComplete = () => {
      setShowNudge(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setShowNudge(false), 5000);
      return () => clearTimeout(timer);
    };
    
    window.addEventListener('onboarding-complete', handleOnboardingComplete);
    return () => window.removeEventListener('onboarding-complete', handleOnboardingComplete);
  }, []);

  // Subscribe to sync progress for the progress ring
  useEffect(() => {
    const unsubscribe = storageServiceV2.onSyncProgress((progress) => {
      setSyncProgress(progress.percentComplete);
    });
    
    // Reset progress when not syncing
    if (status !== 'syncing') {
      setSyncProgress(0);
    }
    
    return unsubscribe;
  }, [status]);

  // Hide nudge on first interaction
  const handleClick = () => {
    if (showNudge) setShowNudge(false);
    
    // If syncing, toggle expanded state instead of triggering sync
    if (status === 'syncing' && onToggleProgressExpanded) {
      onToggleProgressExpanded();
      return;
    }
    
    // Otherwise, trigger sync as before
    onSync?.();
  };
  
  const getStatusIcon = () => {
    switch (status) {
      case 'syncing':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      case 'offline':
        return <CloudOff className="w-4 h-4" />;
      default:
        return <Cloud className="w-4 h-4" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'syncing':
        return 'text-blue-500';
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'offline':
        return 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusText = () => {
    // If sync succeeded, there must be a provider connected (don't show confusing "not connected" message)
    const hasActiveProvider = connectedProviders.length > 0 || status === 'success' || status === 'syncing';
    
    if (!hasActiveProvider && status !== 'error') {
      return t('syncStatus.noCloudConnected');
    }
    
    switch (status) {
      case 'syncing':
        return syncProgress > 0 
          ? t('syncStatus.syncingProgress', { percent: syncProgress })
          : t('syncStatus.syncing');
      case 'success':
        return lastSyncTime ? t('syncStatus.syncedTimeAgo', { time: formatTimeAgo(lastSyncTime) }) : t('syncStatus.synced');
      case 'error':
        return t('syncStatus.syncFailed');
      case 'offline':
        return t('syncStatus.offline');
      default:
        return connectedProviders.length > 0 ? t('syncStatus.readyToSync') : t('syncStatus.noCloudConnected');
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return t('syncStatus.justNow');
    if (seconds < 3600) return t('syncStatus.minutesAgo', { minutes: Math.floor(seconds / 60) });
    if (seconds < 86400) return t('syncStatus.hoursAgo', { hours: Math.floor(seconds / 3600) });
    return t('syncStatus.daysAgo', { days: Math.floor(seconds / 86400) });
  };

  const showReconnectHint = status === 'error' || status === 'offline';
  const button = (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={connectedProviders.length === 0 && status !== 'success' && status !== 'syncing'}
      className={cn(
        "gap-2 transition-all duration-300 relative",
        getStatusColor(),
        showNudge && "ring-1 ring-primary/50 sm:ring-2 sm:ring-offset-2 ring-offset-background animate-pulse"
      )}
    >
      {getStatusIcon()}
      {/* Show percentage badge when syncing */}
      {status === 'syncing' && syncProgress > 0 && (
        <span className="text-xs font-medium tabular-nums">{syncProgress}%</span>
      )}
      <span className="text-xs hidden sm:inline">{status !== 'syncing' ? getStatusText() : null}</span>
    </Button>
  );

  return (
    <div className="relative tour-sync-status">
      {showReconnectHint ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>{getStatusText()}</p>
            <p className="mt-1">{t('storage.reconnectHint')}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      
      {/* Post-onboarding nudge tooltip */}
      {showNudge && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 animate-fade-in">
          <div className="bg-popover text-popover-foreground px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap border">
            {t('onboarding.nudge.syncHint')}
          </div>
          {/* Arrow */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-l border-t rotate-45" />
        </div>
      )}
    </div>
  );
};