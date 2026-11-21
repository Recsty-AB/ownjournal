import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DREAM_FEELINGS, type DreamDetails, type DreamFeeling } from "@/types/dream";

interface DreamDetailsEditorProps {
  value: DreamDetails;
  onChange: (value: DreamDetails) => void;
  onShowGuide: () => void;
}

const FLAGS = ["recurring", "nightmare", "lucid"] as const;

/** Feelings and flags for a dream, shown in the editor in place of mood and activities. */
export const DreamDetailsEditor = ({ value, onChange, onShowGuide }: DreamDetailsEditorProps) => {
  const { t } = useTranslation();

  const toggleFeeling = (feeling: DreamFeeling) => {
    const feelings = value.feelings.includes(feeling)
      ? value.feelings.filter((f) => f !== feeling)
      : [...value.feelings, feeling];
    onChange({ ...value, feelings });
  };

  return (
    <div className="space-y-4">
      <div role="group" aria-labelledby="dream-feelings-label" className="space-y-2">
        <p id="dream-feelings-label" className="text-sm xl:text-base text-muted-foreground">
          {t("dream.editor.feelingsLabel")}
        </p>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {DREAM_FEELINGS.map((feeling) => (
            <button
              key={feeling}
              type="button"
              className="chip"
              aria-pressed={value.feelings.includes(feeling)}
              onClick={() => toggleFeeling(feeling)}
            >
              {t(`dream.feelings.${feeling}`)}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-labelledby="dream-flags-label" className="space-y-2">
        <p id="dream-flags-label" className="text-sm xl:text-base text-muted-foreground">
          {t("dream.editor.flagsLabel")}
        </p>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {FLAGS.map((flag) => (
            <button
              key={flag}
              type="button"
              className="chip"
              aria-pressed={value[flag] === true}
              onClick={() => onChange({ ...value, [flag]: !value[flag] || undefined })}
            >
              {t(`dream.flags.${flag}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("dream.flags.lucidExplained")}</p>
      </div>

      <button
        type="button"
        onClick={onShowGuide}
        className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:min-h-8"
      >
        <HelpCircle aria-hidden="true" className="h-4 w-4" />
        {t("dream.editor.howItWorks")}
      </button>
    </div>
  );
};
