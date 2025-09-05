import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Play, X } from "lucide-react";
import { useState } from "react";

interface DemoBannerProps {
  onStartJournal: () => void;
  cleanMode?: boolean;
}

export function DemoBanner({ onStartJournal, cleanMode = false }: DemoBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (cleanMode || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2.5 shadow-lg">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-primary-foreground/20 rounded-full px-3 py-1">
            <Play className="h-3.5 w-3.5" />
            <span className="text-sm font-medium">{t('demo.mode')}</span>
          </div>
          <p className="text-sm hidden sm:block">
            {t('demo.description')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={onStartJournal}
            size="sm"
            variant="secondary"
            className="whitespace-nowrap"
          >
            {t('demo.startJournal')}
          </Button>
          <Button
            onClick={() => setDismissed(true)}
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t('accessibility.close')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
