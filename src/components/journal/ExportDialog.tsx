import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, File, Loader2, Lock, Share2 } from 'lucide-react';
import { exportToPDF, exportToWord, type JournalEntry, type NativeExportResult } from '@/utils/journalExport';
import { isNativePlatform, shareFileNative, openFileNative } from '@/utils/nativeExport';
import { canShowAnyPurchaseCTA } from '@/utils/platformDetection';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { ToastAction } from '@/components/ui/toast';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: JournalEntry[];
  journalName?: string;
  isPro: boolean;
}

export const ExportDialog = ({ 
  open, 
  onOpenChange, 
  entries, 
  journalName,
  isPro 
}: ExportDialogProps) => {
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [lastExportResult, setLastExportResult] = useState<NativeExportResult | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const isNative = isNativePlatform();

  const handleExportPDF = async () => {
    if (!isPro) {
      toast({
        title: t('exportDialog.proFeature'),
        description: t('journalEntry.pdfExportPro'),
        variant: "destructive",
      });
      return;
    }

    if (entries.length === 0) {
      toast({
        title: t('exportDialog.noEntries'),
        description: t('exportDialog.noEntries'),
      });
      return;
    }

    setExportingPDF(true);
    try {
      const result = await exportToPDF(entries, journalName);
      setLastExportResult(result);
      
      if (isNative && result.uri) {
        // Auto-open the PDF file
        try {
          await openFileNative(result.uri, 'application/pdf');
        } catch {
          // Opening failed, user will still see toast with share option
        }
        
        // On native: show path and offer share action with extended duration
        toast({
          title: t('exportDialog.exportSuccess'),
          description: t('exportDialog.savedToPath', { path: result.path }),
          duration: 15000,
          action: (
            <ToastAction 
              altText={t('exportDialog.share')}
              onClick={() => shareFileNative(result.uri, result.fileName)}
            >
              <Share2 className="h-4 w-4 mr-1" />
              {t('exportDialog.share')}
            </ToastAction>
          ),
        });
      } else {
        // On web: standard success message
        toast({
          title: t('exportDialog.exportSuccess'),
          description: t('exportDialog.exportSuccessDesc', { count: entries.length, format: 'PDF' }),
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: t('exportDialog.exportError'),
        description: t('exportDialog.exportErrorDesc', { format: 'PDF' }),
        variant: "destructive",
      });
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportWord = async () => {
    if (!isPro) {
      toast({
        title: t('exportDialog.proFeature'),
        description: t('journalEntry.wordExportPro'),
        variant: "destructive",
      });
      return;
    }

    if (entries.length === 0) {
      toast({
        title: t('exportDialog.noEntries'),
        description: t('exportDialog.noEntries'),
      });
      return;
    }

    setExportingWord(true);
    try {
      const result = await exportToWord(entries, journalName);
      setLastExportResult(result);
      
      if (isNative && result.uri) {
        // Auto-open the Word file
        try {
          await openFileNative(
            result.uri, 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          );
        } catch {
          // Opening failed, user will still see toast with share option
        }
        
        // On native: show path and offer share action with extended duration
        toast({
          title: t('exportDialog.exportSuccess'),
          description: t('exportDialog.savedToPath', { path: result.path }),
          duration: 15000,
          action: (
            <ToastAction 
              altText={t('exportDialog.share')}
              onClick={() => shareFileNative(result.uri, result.fileName)}
            >
              <Share2 className="h-4 w-4 mr-1" />
              {t('exportDialog.share')}
            </ToastAction>
          ),
        });
      } else {
        // On web: standard success message
        toast({
          title: t('exportDialog.exportSuccess'),
          description: t('exportDialog.exportSuccessDesc', { count: entries.length, format: 'Word' }),
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Word export error:', error);
      toast({
        title: t('exportDialog.exportError'),
        description: t('exportDialog.exportErrorDesc', { format: 'Word' }),
        variant: "destructive",
      });
    } finally {
      setExportingWord(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="export-dialog-description">
        <DialogHeader>
          <DialogTitle className="text-xl font-medium leading-snug">
            {t('exportDialog.title')}
          </DialogTitle>
          <DialogDescription id="export-dialog-description">
            {t('exportDialog.description')} 
            {entries.length > 0 ? ` ${t('exportDialog.entriesReady', { count: entries.length })}` : ` ${t('exportDialog.noEntries')}`}
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border border-y border-border">
          {/* PDF Export — hidden on native for free users to avoid Lock/Plus
              branding that app stores read as referencing a paid tier without
              an in-app purchase product. */}
          {(isPro || canShowAnyPurchaseCTA()) && (
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{t('exportDialog.pdfDocument')}</h3>
                    {!isPro && <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('exportDialog.pdfDescription')}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleExportPDF}
                disabled={exportingPDF || !isPro || entries.length === 0}
                variant="outline"
                className="h-auto min-h-10 w-full whitespace-normal sm:w-auto sm:flex-shrink-0"
              >
                {exportingPDF ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    {t('exportDialog.generatingPDF')}
                  </>
                ) : !isPro ? (
                  <>
                    <Lock className="h-4 w-4 mr-2" aria-hidden="true" />
                    {t('exportDialog.proOnly')}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                    {t('exportDialog.exportAsPDF')}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Word Export — same gating as PDF above. */}
          {(isPro || canShowAnyPurchaseCTA()) && (
            <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <File className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{t('exportDialog.wordDocument')}</h3>
                    {!isPro && <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('exportDialog.wordDescription')}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleExportWord}
                disabled={exportingWord || !isPro || entries.length === 0}
                variant="outline"
                className="h-auto min-h-10 w-full whitespace-normal sm:w-auto sm:flex-shrink-0"
              >
                {exportingWord ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    {t('exportDialog.generatingWord')}
                  </>
                ) : !isPro ? (
                  <>
                    <Lock className="h-4 w-4 mr-2" aria-hidden="true" />
                    {t('exportDialog.proOnly')}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                    {t('exportDialog.exportAsWord')}
                  </>
                )}
              </Button>
            </div>
          )}

          {!isPro && !canShowAnyPurchaseCTA() && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('exportDialog.unavailableNative')}
            </p>
          )}

          {!isPro && canShowAnyPurchaseCTA() && (
            <p className="py-4 text-sm text-muted-foreground">
              {t('exportDialog.upgradePrompt')}
            </p>
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
