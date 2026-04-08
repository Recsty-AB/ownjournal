import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, AlertCircle, AlertTriangle } from "lucide-react";
import { useTransfer } from "@/hooks/useTransfer";
import type { CloudProvider } from "@/types/cloudProvider";
import { useTranslation } from "react-i18next";
import { CloudCredentialStorage } from "@/utils/cloudCredentialStorage";
import { SimpleModeCredentialStorage } from "@/utils/simpleModeCredentialStorage";
import { connectionStateManager } from "@/services/connectionStateManager";

import { isE2EEnabled } from "@/utils/encryptionModeStorage";
import { toast } from "sonner";
import { storageServiceV2 } from "@/services/storageServiceV2";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProviderTransferProps { connectedProviderCount?: number; onDisconnectProvider?: (providerName: string) => void; }

export const ProviderTransfer = ({ connectedProviderCount = 0, onDisconnectProvider }: ProviderTransferProps) => {
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const { isTransferring, progress, currentFile, lastTransferSuccess, sourceProvider: transferSource, targetProvider: transferTarget, phase, cleanupProgress, transfer, stop, resetTransferSuccess } = useTransfer();
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const { t } = useTranslation();
  const [dialogOpenedAt, setDialogOpenedAt] = useState<number | null>(null);

  // Sync selected dropdowns with active transfer
  useEffect(() => {
    if (isTransferring && transferSource && transferTarget) {
      setSelectedSource(transferSource);
      setSelectedTarget(transferTarget);
    }
  }, [isTransferring, transferSource, transferTarget]);

  useEffect(() => {
    const updateProviders = () => setProviders(connectionStateManager.getConnectedProviders());
    updateProviders();
    return connectionStateManager.subscribe(updateProviders);
  }, []);

  useEffect(() => {
    if (lastTransferSuccess && transferSource && transferTarget && !showDisconnectDialog) {
      const timer = setTimeout(() => { setShowDisconnectDialog(true); setDialogOpenedAt(Date.now()); }, 200);
      return () => clearTimeout(timer);
    }
  }, [lastTransferSuccess, transferSource, transferTarget, showDisconnectDialog]);

  const handleTransfer = async () => {
    const source = providers.find(p => p.name === selectedSource);
    const target = providers.find(p => p.name === selectedTarget);
    if (!source || !target || source.name === target.name) return;
    // NOTE: Primary provider is NOT switched on transfer success
    // User must explicitly choose to disconnect source to switch primary
    await transfer(source, target);
  };
  
  // Trigger password re-entry ONLY if E2E is enabled AND master key is NOT already in memory
  const triggerPasswordReentryIfNeeded = () => {
    if (isE2EEnabled() && !storageServiceV2.getMasterKey()) {
      setTimeout(() => {
        toast.info(t('storage.passwordRequired'), { description: t('transfer.passwordRequiredAfterTransfer'), duration: 10000 });
        window.dispatchEvent(new CustomEvent('require-password-reentry'));
      }, 500);
    }
  };
  
  const handleDisconnectSource = async () => {
    try {
      // Set target as primary ONLY when user explicitly disconnects source
      if (transferTarget) {
        const { PrimaryProviderStorage } = await import('@/utils/primaryProviderStorage');
        PrimaryProviderStorage.set(transferTarget);
        connectionStateManager.setPreferredPrimaryProvider(transferTarget);
      }
      
      const service = connectionStateManager.getProvider(transferSource);
      connectionStateManager.unregisterProvider(transferSource);
      const disconnectFn = (service as { disconnect?: () => void | Promise<void> })?.disconnect;
      if (disconnectFn) try { await Promise.resolve(disconnectFn.call(service)); } catch {}
      if (transferSource === 'Google Drive') { CloudCredentialStorage.clearCredentials('google-drive'); SimpleModeCredentialStorage.clearGoogleDriveCredentials(); }
      else if (transferSource === 'Dropbox') { CloudCredentialStorage.clearCredentials('dropbox'); SimpleModeCredentialStorage.clearDropboxCredentials(); }
      else if (transferSource === 'Nextcloud') { CloudCredentialStorage.clearCredentials('nextcloud'); localStorage.removeItem('nextcloud_simple_credentials'); }
      else if (transferSource === 'iCloud') { CloudCredentialStorage.clearCredentials('icloud'); SimpleModeCredentialStorage.clearICloudCredentials(); }
      if (onDisconnectProvider) onDisconnectProvider(transferSource);
    } catch {}
    resetTransferSuccess(); setShowDisconnectDialog(false); setSelectedSource(""); setSelectedTarget("");
    triggerPasswordReentryIfNeeded();
  };
  
  const handleKeepBoth = () => { 
    resetTransferSuccess(); setShowDisconnectDialog(false); setSelectedSource(""); setSelectedTarget(""); 
    triggerPasswordReentryIfNeeded();
  };

  if (providers.length < 2) {
    return (<Card className="p-4 border-dashed"><div className="flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground" /><div><p className="text-sm font-medium">{t('storage.providerTransfer')}</p><p className="text-xs text-muted-foreground mt-1">{t('storage.providerTransferDesc')}</p></div></div></Card>);
  }

  return (
    <>
      <Dialog open={showDisconnectDialog && !!transferSource && !!transferTarget} onOpenChange={(open) => { if (!open && dialogOpenedAt && Date.now() - dialogOpenedAt < 500) return; if (!open) setShowDisconnectDialog(false); }} modal={true}>
        <DialogContent className="sm:max-w-md" aria-describedby="transfer-complete-description" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{t('transfer.transferCompleteDisconnect')}</DialogTitle><DialogDescription id="transfer-complete-description">{t('transfer.transferCompleteDisconnectDesc', { source: transferSource, target: transferTarget })}</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={handleKeepBoth}>{t('storage.keepBoth')}</Button><Button onClick={handleDisconnectSource}>{t('storage.disconnectSource', { source: transferSource })}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="p-4">
        <div className="space-y-4">
          {providers.length >= 2 && !isTransferring && (<Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50"><AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" /><AlertDescription className="text-amber-800 dark:text-amber-400 text-xs"><p className="font-medium mb-1">{t('storage.multipleProvidersWarning')}</p><p>{t('storage.multipleProvidersWarningDesc')}</p></AlertDescription></Alert>)}
          <div><h4 className="text-sm font-medium mb-2">{t('storage.transferBetweenProviders')}</h4><p className="text-xs text-muted-foreground">{t('storage.transferBetweenProvidersDesc')}</p></div>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-2"><Label htmlFor="source">{t('storage.from')}</Label>{!!(window as any).Capacitor?.isNativePlatform?.() && (window as any).Capacitor?.getPlatform?.() === 'ios' ? (
              <select id="source" value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} disabled={isTransferring} className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm disabled:opacity-50">{providers.map((p) => (<option key={p.name} value={p.name}>{p.name}</option>))}</select>
            ) : (
              <Select value={selectedSource} onValueChange={setSelectedSource} disabled={isTransferring}><SelectTrigger id="source"><SelectValue placeholder={t('storage.selectSource')} /></SelectTrigger><SelectContent>{providers.map((p) => (<SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>))}</SelectContent></Select>
            )}</div>
            <ArrowRight className="w-4 h-4 mt-6 text-muted-foreground" />
            <div className="flex-1 space-y-2"><Label htmlFor="target">{t('storage.to')}</Label>{!!(window as any).Capacitor?.isNativePlatform?.() && (window as any).Capacitor?.getPlatform?.() === 'ios' ? (
              <select id="target" value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} disabled={isTransferring} className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm disabled:opacity-50">{providers.filter((p) => p.name !== selectedSource).map((p) => (<option key={p.name} value={p.name}>{p.name}</option>))}</select>
            ) : (
              <Select value={selectedTarget} onValueChange={setSelectedTarget} disabled={isTransferring}><SelectTrigger id="target"><SelectValue placeholder={t('storage.selectTarget')} /></SelectTrigger><SelectContent>{providers.filter((p) => p.name !== selectedSource).map((p) => (<SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>))}</SelectContent></Select>
            )}</div>
          </div>
          {isTransferring && (<div className="space-y-2"><Progress value={phase === 'copying' ? progress : cleanupProgress} /><div className="space-y-1"><p className="text-xs text-center text-muted-foreground">{phase === 'copying' ? `${t('storage.transferring')} ${Math.round(progress)}%` : `${t('storage.cleaningUp')} ${Math.round(cleanupProgress)}%`}</p>{phase === 'copying' && currentFile && (<p className="text-xs text-center text-muted-foreground truncate">{currentFile}</p>)}</div></div>)}
          <div className="flex gap-2"><Button onClick={handleTransfer} disabled={isTransferring || !selectedSource || !selectedTarget} className="flex-1">{isTransferring ? t('storage.transferring') : t('storage.startTransfer')}</Button>{isTransferring && (<Button onClick={stop} variant="outline" className="flex-1">{t('common.stop')}</Button>)}</div>
        </div>
      </Card>
    </>
  );
};
