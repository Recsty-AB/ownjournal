import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { journalNameStorage } from "@/utils/journalNameStorage";
import logo from "@/assets/logo.png";

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
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <img src={logo} alt="OwnJournal" className="w-5 h-5 object-contain" />
        <h3 className="text-lg font-semibold">{t('settings.journalName.title')}</h3>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="journal-name">{t('settings.journalName.customName')}</Label>
        <Input
          id="journal-name"
          value={journalName}
          onChange={(e) => setJournalName(e.target.value)}
          placeholder={t('settings.journalName.placeholder')}
          className="max-w-md"
        />
        <p className="text-xs text-muted-foreground">
          {t('settings.journalName.description')}
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} size="sm">
          {t('settings.journalName.save')}
        </Button>
        {journalNameStorage.hasCustomName() && (
          <Button onClick={handleReset} variant="outline" size="sm">
            {t('settings.journalName.reset')}
          </Button>
        )}
      </div>
    </div>
  );
};
