import { Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sentenceSeparator } from "@/services/dreamService";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DreamGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Voice entry is Plus-only, so the dictation tip is shown to Plus users only. */
  isPro: boolean;
}

/**
 * Three-step guide shown the first time Dream is switched on, and from the
 * "How it works" link in the dream editor.
 */
export const DreamGuide = ({ open, onOpenChange, isPro }: DreamGuideProps) => {
  const { t, i18n } = useTranslation();
  const join = (...parts: string[]) => parts.join(sentenceSeparator(i18n.language));

  const steps = [
    isPro ? join(t("dream.guide.step1"), t("dream.guide.step1Voice")) : t("dream.guide.step1"),
    t("dream.guide.step2"),
    join(t("dream.guide.step3"), t("dream.guide.step3Patterns")),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
            {t("dream.guide.title")}
          </DialogTitle>
          {/* The steps are the description; screen readers get them via the list below. */}
          <DialogDescription className="sr-only">{steps[0]}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-4">
          {steps.map((text, index) => (
            <li key={index} className="flex gap-3">
              <span
                aria-hidden="true"
                className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border border-border text-sm font-medium tabular-nums"
              >
                {index + 1}
              </span>
              <p className="reading pt-0.5 text-base leading-7 text-foreground">{text}</p>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="rounded-full px-5">
            {t("dream.guide.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
