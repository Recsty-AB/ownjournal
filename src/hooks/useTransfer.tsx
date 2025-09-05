import { useState, useCallback, useEffect } from 'react';
import type { CloudProvider } from '@/types/cloudProvider';
import { transferService } from '@/services/transferService';
import { storageServiceV2 } from '@/services/storageServiceV2';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { translateCloudError } from '@/utils/translateCloudError';
import { isE2EEnabled } from '@/utils/encryptionModeStorage';
import { retrievePassword } from '@/utils/passwordStorage';

interface UseTransferResult {
  isTransferring: boolean;
  progress: number;
  currentFile: string | null;
  lastTransferSuccess: boolean;
  sourceProvider: string | null;
  targetProvider: string | null;
  phase: 'copying' | 'cleaning';
  cleanupProgress: number;
  transfer: (source: CloudProvider, target: CloudProvider) => Promise<boolean>;
  stop: () => void;
  resetTransferSuccess: () => void;
}

export function useTransfer(): UseTransferResult {
  const [isTransferring, setIsTransferring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [lastTransferSuccess, setLastTransferSuccess] = useState(false);
  const [sourceProvider, setSourceProvider] = useState<string | null>(null);
  const [targetProvider, setTargetProvider] = useState<string | null>(null);
  const [phase, setPhase] = useState<'copying' | 'cleaning'>('copying');
  const [cleanupProgress, setCleanupProgress] = useState(0);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Restore state on mount and subscribe to progress updates
  useEffect(() => {
    // Restore state if transfer is already running
    if (transferService.running) {
      setIsTransferring(true);
      const savedProgress = transferService.getProgress();
      if (savedProgress) {
        if (savedProgress.totalFiles > 0) {
          setProgress((savedProgress.completedFiles / savedProgress.totalFiles) * 100);
        }
        setSourceProvider(savedProgress.sourceProvider);
        setTargetProvider(savedProgress.targetProvider);
        setPhase(savedProgress.phase || 'copying');
        if (savedProgress.phase === 'cleaning' && savedProgress.cleanupFiles && savedProgress.cleanupFiles > 0) {
          setCleanupProgress(((savedProgress.cleanedFiles || 0) / savedProgress.cleanupFiles) * 100);
        }
      }
    }

    // Subscribe to progress updates
    const unsubscribe = transferService.onProgress((progressData) => {
      if (progressData.status === 'running') {
        setIsTransferring(true);
        setSourceProvider(progressData.sourceProvider);
        setTargetProvider(progressData.targetProvider);
        setPhase(progressData.phase || 'copying');
        
        if (progressData.phase === 'copying' && progressData.totalFiles > 0) {
          setProgress((progressData.completedFiles / progressData.totalFiles) * 100);
        } else if (progressData.phase === 'cleaning' && progressData.cleanupFiles && progressData.cleanupFiles > 0) {
          setCleanupProgress(((progressData.cleanedFiles || 0) / progressData.cleanupFiles) * 100);
        }
      } else if (progressData.status === 'completed' || progressData.status === 'failed') {
        setIsTransferring(false);
      }
    });

    return unsubscribe;
  }, []);
  
  const transfer = useCallback(async (source: CloudProvider, target: CloudProvider): Promise<boolean> => {
    if (!source.isConnected || !target.isConnected) {
      toast({ title: t('transfer.connectionError'), description: t('transfer.connectionErrorDesc'), variant: "destructive" });
      return false;
    }
    setIsTransferring(true);
    setProgress(0);
    setCurrentFile(null);
    setLastTransferSuccess(false);
    setSourceProvider(source.name);
    setTargetProvider(target.name);
    setPhase('copying');
    setCleanupProgress(0);
    try {
      const result = await transferService.transfer(source, target, {
        onProgress: (current, total, fileName) => { setProgress((current / total) * 100); setCurrentFile(fileName || null); },
        onConflict: () => 'overwrite',
        verifyChecksums: true,
        maxRetries: 3,
      });
      if (result.cancelled) {
        toast({ title: t('transfer.cancelled'), description: t('transfer.cancelledDesc', { transferred: result.transferredFiles }), duration: 5000 });
        return false;
      } else if (result.success) {
        toast({ title: t('transfer.mirrorComplete'), description: t('transfer.mirrorCompleteDesc', { count: result.transferredFiles, source: source.name, target: target.name }), duration: 10000 });
        setLastTransferSuccess(true);
        // Post-transfer key validation: ensure transferred key can decrypt entries on target
        if (result.transferredEncryptionKey && isE2EEnabled()) {
          try {
            const password = await retrievePassword();
            if (password) {
              const valid = await storageServiceV2.validateEncryptionKeyFromProvider(target, password);
              if (!valid) {
                toast({
                  title: t('transfer.keyValidationFailed', 'Encryption key mismatch'),
                  description: t('transfer.keyValidationFailedDesc', 'The transferred encryption key cannot decrypt your entries. Connect from the device that has the correct key and sync, or restore the key from version history.'),
                  variant: 'destructive',
                  duration: 15000,
                });
              }
            }
          } catch {
            // Validation error (e.g. no password) - skip silently
          }
        }
        return true;
      } else {
        toast({ title: t('transfer.completedWithErrors'), description: t('transfer.completedWithErrorsDesc', { transferred: result.transferredFiles, failed: result.failedFiles.length }), variant: "destructive", duration: 10000 });
        return false;
      }
    } catch (error) {
      toast({ title: t('transfer.failed'), description: error instanceof Error ? translateCloudError(error, t) : t('common.unknownError'), variant: "destructive", duration: 10000 });
      return false;
    } finally {
      setIsTransferring(false);
      setProgress(0);
      setCurrentFile(null);
      setPhase('copying');
      setCleanupProgress(0);
    }
  }, [toast, t]);
  
  const stop = useCallback(() => {
    if (isTransferring) { transferService.stop(); toast({ title: t('transfer.stopped'), description: t('transfer.stoppedDesc') }); }
  }, [isTransferring, toast, t]);
  
  const resetTransferSuccess = useCallback(() => { setLastTransferSuccess(false); setSourceProvider(null); setTargetProvider(null); setPhase('copying'); setCleanupProgress(0); }, []);
  
  return { isTransferring, progress, currentFile, lastTransferSuccess, sourceProvider, targetProvider, phase, cleanupProgress, transfer, stop, resetTransferSuccess };
}
