import { Crown, Mic, Moon, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FeatureTipProps {
  /** Opens a new entry already marked as a dream. */
  onWriteDream: () => void;
  onDismiss: () => void;
}

const BADGE = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium";

/**
 * One-time note for people who used the app before dreams and voice entry
 * existed. Every item says whether it is free or part of Plus. Informational
 * only: it never links to a purchase (store compliance on native builds).
 */
export const FeatureTip = ({ onWriteDream, onDismiss }: FeatureTipProps) => {
  const { t } = useTranslation();

  const items = [
    { key: "dreamJournal", icon: Moon, name: t("featureTip.dreamJournal.name"), desc: t("featureTip.dreamJournal.desc"), plus: false },
    { key: "dreamReflection", icon: Sparkles, name: t("dream.reflection.title"), desc: t("featureTip.dreamReflection.desc"), plus: true },
    { key: "voice", icon: Mic, name: t("voice.title"), desc: t("featureTip.voice.desc"), plus: true },
  ];

  return (
    <Card role="region" aria-labelledby="feature-tip-title" className="rounded-2xl border-border bg-card p-4 shadow-soft sm:p-5">
      <h3 id="feature-tip-title" className="text-sm font-semibold text-foreground">{t("featureTip.title")}</h3>
      <ul className="mt-3 space-y-3">
        {items.map(({ key, icon: Icon, name, desc, plus }) => (
          <li key={key} className="flex gap-3">
            <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-foreground">{name}</span>
                <span className={cn(BADGE, plus ? "border-seal/40 text-seal" : "border-border text-muted-foreground")}>
                  {plus && <Crown aria-hidden="true" className="h-3 w-3" />}
                  {plus ? t("help.sections.proBadge") : t("featureTip.free")}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={onWriteDream} size="sm" className="min-h-10 h-auto rounded-full px-4 sm:min-h-9">
          <Moon aria-hidden="true" className="mr-2 h-4 w-4" />
          {t("featureTip.writeDream")}
        </Button>
        <Button onClick={onDismiss} size="sm" variant="ghost" className="min-h-10 h-auto rounded-full px-4 sm:min-h-9">
          {t("featureTip.dismiss")}
        </Button>
      </div>
    </Card>
  );
};
