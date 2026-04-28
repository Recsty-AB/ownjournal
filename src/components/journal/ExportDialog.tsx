import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, File, Loader2, Lock, Share2 } from 'lucide-react';
import { exportToPDF, exportToWord, type JournalEntry, type NativeExportResult } from '@/utils/journalExport';
import { isNativePlatform, shareFileNative, openFileNative } from '@/utils/nativeExport';
import { canShowPurchaseCTA } from '@/utils/platformDetection';
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
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('exportDialog.title')}
          </DialogTitle>
          <DialogDescription id="export-dialog-description">
            {t('exportDialog.description')} 
            {entries.length > 0 ? ` ${t('exportDialog.entriesReady', { count: entries.length })}` : ` ${t('exportDialog.noEntries')}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* PDF Export — hidden on native for free users to avoid Lock/Plus
              branding that app stores read as referencing a paid tier without
              an in-app purchase product. */}
          {(isPro || canShowPurchaseCTA()) && (
            <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/50">
              <div className="flex-shrink-0 mt-1">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{t('exportDialog.pdfDocument')}</h3>
                  {!isPro && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('exportDialog.pdfDescription')}
                </p>
                <Button
                  onClick={handleExportPDF}
                  disabled={exportingPDF || !isPro || entries.length === 0}
                  size="sm"
                  className="w-full"
                >
                  {exportingPDF ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('exportDialog.generatingPDF')}
                    </>
                  ) : !isPro ? (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      {t('exportDialog.proOnly')}
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      {t('exportDialog.exportAsPDF')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Word Export — same gating as PDF above. */}
          {(isPro || canShowPurchaseCTA()) && (
            <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/50">
              <div className="flex-shrink-0 mt-1">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <File className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{t('exportDialog.wordDocument')}</h3>
                  {!isPro && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('exportDialog.wordDescription')}
                </p>
                <Button
                  onClick={handleExportWord}
                  disabled={exportingWord || !isPro || entries.length === 0}
                  size="sm"
                  variant="secondary"
                  className="w-full"
                >
                  {exportingWord ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('exportDialog.generatingWord')}
                    </>
                  ) : !isPro ? (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      {t('exportDialog.proOnly')}
                    </>
                  ) : (
                    <>
                      <File className="h-4 w-4 mr-2" />
                      {t('exportDialog.exportAsWord')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {!isPro && !canShowPurchaseCTA() && (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                {t('exportDialog.unavailableNative')}
              </p>
            </div>
          )}

          {!isPro && canShowPurchaseCTA() && (
            <div className="text-center pt-2">
              <p className="text-sm text-muted-foreground">
                {t('exportDialog.upgradePrompt')}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
