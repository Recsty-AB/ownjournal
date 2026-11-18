import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { journalNameStorage } from "@/utils/journalNameStorage";

export const JournalNameSettings = () => {
  const [journalName, setJournalName] = useState("");
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    // Load current journal name
    setJournalName(journalNameStorage.getJournalName());
  }, []);

  const handleSave = () => {
    journalNameStorage.setJournalName(journalName);
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('journalNameChanged', { 
      detail: { name: journalName } 
    }));
    toast({
      title: t('settings.journalName.updated'),
      description: t('settings.journalName.updatedDesc'),
    });
  };

  const handleReset = () => {
    journalNameStorage.resetJournalName();
    const defaultName = journalNameStorage.getJournalName();
    setJournalName(defaultName);
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('journalNameChanged', { 
      detail: { name: defaultName } 
    }));
    toast({
      title: t('settings.journalName.resetToast'),
      description: t('settings.journalName.resetDesc'),
    });
  };

  return (
    <section className="space-y-4 py-6 first:pt-0">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-foreground">
          {t('settings.journalName.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('settings.journalName.description')}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="journal-name">{t('settings.journalName.customName')}</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id="journal-name"
            value={journalName}
            onChange={(e) => setJournalName(e.target.value)}
            placeholder={t('settings.journalName.placeholder')}
            className="min-w-0 sm:max-w-sm sm:flex-1"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave}>
              {t('settings.journalName.save')}
            </Button>
            {journalNameStorage.hasCustomName() && (
              <Button onClick={handleReset} variant="ghost">
                {t('settings.journalName.reset')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
