import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { useDocumentTitle } from "@/hooks/useDocumentMeta";
import { DemoProvider, useDemo } from "@/components/demo/DemoProvider";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { Header } from "@/components/layout/Header";
import { Timeline } from "@/components/journal/Timeline";
import { TrendAnalysis } from "@/components/journal/TrendAnalysis";
import { JournalEntryData } from "@/components/journal/JournalEntry";
import { HelpDialog } from "@/components/help/HelpDialog";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

function DemoContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const { entries, saveEntry, deleteEntry } = useDemo();
  useDocumentTitle(t('demo.mode'));
  
  const cleanMode = searchParams.get('clean') === 'true';
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSave = (entry: Omit<JournalEntryData, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Create a full entry with generated id and timestamps
    const fullEntry: JournalEntryData = {
      ...entry,
      id: `demo-new-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    saveEntry(fullEntry);
    toast.success(t('journal.entrySaved'));
  };

  const handleDelete = (id: string) => {
    deleteEntry(id);
    toast.success(t('journal.entryDeleted'));
  };

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleStartJournal = () => {
    navigate('/');
  };

  const handleExport = () => {
    toast.info(t('demo.exportUnavailableTitle'), {
      description: t('demo.exportUnavailableDesc')
    });
  };

  const handleImportData = (_data: unknown) => {
    toast.info(t('demo.importUnavailableTitle'), {
      description: t('demo.importUnavailableDesc')
    });
  };

  // Calculate offset for demo banner
  const contentOffset = cleanMode ? "" : "pt-14";

  return (
    <div className={`min-h-screen bg-background ${contentOffset}`}>
      <DemoBanner 
        onStartJournal={handleStartJournal} 
        cleanMode={cleanMode}
      />
      
      <Header
        user={undefined}
        isDarkMode={theme === 'dark'}
        onToggleTheme={toggleDarkMode}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHelp={() => setShowHelp(true)}
        onExportData={handleExport}
        onExportToFile={handleExport}
        onSignOut={() => navigate('/')}
        syncStatus="success"
        connectedProviders={['demo']}
      />

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* TrendAnalysis - show first on mobile, sidebar on desktop */}
          <div className="lg:col-span-1 order-first lg:order-last">
            <TrendAnalysis
              entries={entries}
              isPro={true}
              isDemo={true}
            />
          </div>
          {/* Timeline - main content */}
          <div className="lg:col-span-3 order-last lg:order-first">
            <Timeline
              entries={entries}
              onSaveEntry={handleSave}
              onDeleteEntry={handleDelete}
              isPro={true}
              isDemo={true}
              hideFooter={true}
            />
          </div>
        </div>
        
        {/* Footer - outside grid, always at bottom */}
        <footer className="border-t border-border pt-4 sm:pt-6 mt-6 sm:mt-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} OwnJournal</span>
            <span className="hidden sm:inline">·</span>
            <a href="/terms" className="hover:text-primary hover:underline">
              {t('legal.terms.title')}
            </a>
            <span className="hidden sm:inline">·</span>
            <a href="/privacy" className="hover:text-primary hover:underline">
              {t('legal.privacy.title')}
            </a>
          </div>
        </footer>
      </main>

      <HelpDialog
        open={showHelp}
        onOpenChange={setShowHelp}
      />

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        onExportData={handleExport}
        onExportToFile={handleExport}
        onImportData={handleImportData}
        isDarkMode={theme === 'dark'}
        onToggleTheme={toggleDarkMode}
      />
    </div>
  );
}

export default function Demo() {
  return (
    <DemoProvider>
      <DemoContent />
    </DemoProvider>
  );
}
