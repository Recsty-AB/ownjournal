import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Crown, HeartHandshake, Loader2, Moon, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDreamUsage } from "@/hooks/useDreamUsage";
import {
  getDreamReflectionRequest,
  updateDreamReflectionRequest,
  useDreamReflectionRequest,
} from "@/hooks/useDreamReflectionRequest";
import { aiUsageLimits } from "@/services/aiUsageLimits";
import {
  DreamRequestError,
  dreamChangedSinceReflection,
  hasDreamConsent,
  openDreamMethodHelp,
  sentenceSeparator,
  requestDreamReflection,
} from "@/services/dreamService";
import { DREAM_LIMITS, isDreamTooLong, type DreamReflection as DreamReflectionData } from "@/types/dream";
import { getCurrentUserId } from "@/utils/userScope";
import type { JournalEntryData } from "./JournalEntry";
import { DreamConsentDialog } from "./DreamConsentDialog";

interface DreamReflectionProps {
  entry: JournalEntryData;
  allEntries: JournalEntryData[];
  isPro: boolean;
  isDemo?: boolean;
  /** Saves the reflection inside the entry (encrypted payload) and syncs it. */
  onSaveReflection: (reflection: DreamReflectionData) => Promise<void>;
  /**
   * Saves the dreamer's own thoughts with the dream, like an edit of the entry.
   * Without it the thoughts field is not shown.
   */
  onSaveThoughts?: (thoughts: string) => Promise<void>;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <h5 className="text-sm font-medium">{title}</h5>
    {children}
  </div>
);

export const DreamReflection = ({
  entry,
  allEntries,
  isPro,
  isDemo = false,
  onSaveReflection,
  onSaveThoughts,
}: DreamReflectionProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [consentOpen, setConsentOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const usage = useDreamUsage("dreamReflection");
  // The dreamer's own thoughts: typed here, saved with the dream on Save. Once
  // saved they count as an edit, so "Reflect again" takes them into account.
  const savedThoughts = entry.dream?.thoughts ?? "";
  const [thoughts, setThoughts] = useState(savedThoughts);
  const [savingThoughts, setSavingThoughts] = useState(false);
  useEffect(() => setThoughts(savedThoughts), [savedThoughts]);
  const thoughtsChanged = thoughts.trim() !== savedThoughts;

  const saveThoughts = async () => {
    if (!onSaveThoughts || savingThoughts || !thoughtsChanged) return;
    setSavingThoughts(true);
    try {
      // Reports its own outcome, like any save of the entry.
      await onSaveThoughts(thoughts.trim());
    } finally {
      setSavingThoughts(false);
    }
  };
  // Kept outside this card, which unmounts when the entry is edited or hidden
  // while the request carries on (see useDreamReflectionRequest).
  const request = useDreamReflectionRequest(entry.id);
  // The entry to reflect on: the one shown, or the one with thoughts just saved
  // from the field, before the page has passed the saved copy back down.
  const pendingTarget = useRef<JournalEntryData>(entry);

  const { loading, saving, unsaved } = request;
  // A reflection that came back but is not in the saved entry yet is shown
  // from the request; a saved one (also from another device) from the entry.
  const reflection = request.reflection ?? entry.dreamReflection;

  const saveReflection = async (value: DreamReflectionData) => {
    updateDreamReflectionRequest(entry.id, { reflection: value, saving: true, unsaved: false });
    try {
      await onSaveReflection(value);
      updateDreamReflectionRequest(entry.id, { reflection: null, saving: false });
    } catch {
      // It already counted towards the monthly limit: keep it with Retry.
      updateDreamReflectionRequest(entry.id, { saving: false, unsaved: true });
      showError("saveFailed");
    }
  };

  // No details yet: the entry comes from the startup list of a journal that is
  // locked or still loading, without its text or its saved reflection.
  if (isDemo || !entry.dream) return null;

  const remaining = Math.max(0, usage.limit - usage.current);
  const changed = dreamChangedSinceReflection({ body: entry.body, dream: entry.dream, dreamReflection: reflection });

  const showError = (key: string) =>
    toast({
      title: t("dream.reflection.title"),
      description: t(`dream.reflection.errors.${key}`, {
        limit: DREAM_LIMITS.reflectionsPerMonth,
        min: DREAM_LIMITS.minCharacters,
      }),
      variant: "destructive",
    });

  const runReflection = async (target: JournalEntryData = entry) => {
    if (getDreamReflectionRequest(entry.id).loading) return;
    // The answer takes seconds. If the user signed out meanwhile (or another
    // account signed in), it is dropped: its count and its save belong to an
    // account that is no longer the one on screen.
    const startedBy = getCurrentUserId();
    const sameUser = () => getCurrentUserId() === startedBy;
    updateDreamReflectionRequest(entry.id, { loading: true });
    try {
      const result = await requestDreamReflection(target, allEntries, i18n.language);
      if (!sameUser()) return;
      aiUsageLimits.setMonthlyDreamCount("dreamReflection", result.used);
      setCollapsed(false);
      await saveReflection(result.reflection);
    } catch (error) {
      if (!sameUser()) return;
      const code = error instanceof DreamRequestError ? error.code : "failed";
      if (code === "limitReached") aiUsageLimits.markLimitReached("dreamReflection");
      showError(code === "notEnoughDreams" ? "failed" : code);
    } finally {
      updateDreamReflectionRequest(entry.id, { loading: false });
    }
  };

  const handleReflect = (target: JournalEntryData = entry) => {
    if (!isPro || loading) return;
    const text = target.body.trim();
    if (text.length < DREAM_LIMITS.minCharacters) return showError("tooShort");
    if (isDreamTooLong(text)) return showError("tooLong");
    if (!aiUsageLimits.canUseFeature("dreamReflection").allowed) return showError("limitReached");
    pendingTarget.current = target;
    if (!hasDreamConsent()) {
      setConsentOpen(true);
      return;
    }
    void runReflection(target);
  };

  // "Reflect again" under the thoughts: saves what was typed first, so the new
  // reflection is made from the thoughts on screen. A failed save shows its
  // own message; the reflection is still made from what is on screen.
  const reflectWithThoughts = async () => {
    if (!isPro || loading || savingThoughts) return;
    let target = entry;
    if (thoughtsChanged && onSaveThoughts) {
      const value = thoughts.trim();
      setSavingThoughts(true);
      try {
        await onSaveThoughts(value);
      } finally {
        setSavingThoughts(false);
      }
      const { thoughts: _previous, ...details } = entry.dream ?? { feelings: [] };
      target = { ...entry, dream: { ...details, ...(value ? { thoughts: value } : {}) } };
    }
    handleReflect(target);
  };

  const consent = (
    <DreamConsentDialog
      open={consentOpen}
      onOpenChange={setConsentOpen}
      onAccept={() => void runReflection(pendingTarget.current)}
    />
  );

  if (!reflection) {
    return (
      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <Moon aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="eyebrow whitespace-nowrap">{t("dream.reflection.title")}</span>
            {!isPro && <Crown aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0 text-seal" />}
          </div>
          <Button
            onClick={() => handleReflect()}
            disabled={loading || !isPro}
            size="sm"
            variant="outline"
            className="min-h-10 h-auto rounded-full sm:min-h-9"
          >
            {loading ? (
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
            ) : isPro ? (
              <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" />
            ) : (
              <Crown aria-hidden="true" className="mr-2 h-4 w-4 text-seal" />
            )}
            {loading ? t("dream.reflection.reflecting") : t("dream.reflection.reflect")}
          </Button>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {isPro
            ? t("dream.reflection.remaining", { remaining, limit: usage.limit })
            : t("dream.reflection.plusOnly")}
        </p>
        {consent}
      </div>
    );
  }

  const canReflectAgain = isPro && changed;

  return (
    <div className="space-y-5 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Moon aria-hidden="true" className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <h4 className="eyebrow whitespace-nowrap">{t("dream.reflection.title")}</h4>
          <span className="text-xs tabular-nums text-muted-foreground">
            {new Date(reflection.createdAt).toLocaleDateString(i18n.language)}
          </span>
        </div>
        <div className="-mr-2 ml-auto flex items-center gap-1">
          {isPro && (
            <Button
              onClick={() => handleReflect()}
              disabled={loading || !canReflectAgain}
              size="sm"
              variant="ghost"
              title={canReflectAgain ? undefined : t("dream.reflection.editToReflectAgain")}
              className="min-h-10 h-auto text-muted-foreground sm:min-h-9"
            >
              {loading ? (
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles aria-hidden="true" className="mr-2 h-4 w-4 flex-shrink-0" />
              )}
              <span className="truncate">
                {loading ? t("dream.reflection.reflecting") : t("dream.reflection.reflectAgain")}
              </span>
            </Button>
          )}
          <Button
            onClick={() => setCollapsed(!collapsed)}
            size="sm"
            variant="ghost"
            aria-expanded={!collapsed}
            className="min-h-10 h-auto sm:min-h-9"
          >
            {collapsed ? t("dream.reflection.show") : t("dream.reflection.hide")}
          </Button>
        </div>
      </div>

      {unsaved && (
        <div className="notice notice-warning" role="alert">
          <AlertTriangle aria-hidden="true" />
          <div className="space-y-2">
            <p>{t("dream.reflection.errors.saveFailed")}</p>
            <Button
              onClick={() => void saveReflection(reflection)}
              disabled={saving}
              size="sm"
              variant="outline"
              className="min-h-10 h-auto sm:min-h-9"
            >
              {saving && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.retry")}
            </Button>
          </div>
        </div>
      )}

      {!collapsed && (
        <>
          {reflection.care === "distress" && (
            <div className="notice notice-info" role="note">
              <HeartHandshake aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-medium">{t("dream.reflection.care.title")}</p>
                <p>{t("dream.reflection.care.body")}</p>
                <p>{t("dream.reflection.care.urgent")}</p>
              </div>
            </div>
          )}

          {/* Made with the dreamer's thoughts: first, so the effect of what they wrote is visible. */}
          {reflection.fromThoughts && (
            <div className="border-l-2 border-border pl-4">
              <Section title={t("dream.reflection.fromThoughts")}>
                <p className="reading text-base leading-7 text-foreground">{reflection.fromThoughts}</p>
              </Section>
            </div>
          )}

          <Section title={t("dream.reflection.summary")}>
            <p className="reading text-base leading-7 text-foreground">{reflection.summary}</p>
          </Section>

          {reflection.themes.length > 0 && (
            <Section title={t("dream.reflection.themes")}>
              {/* Title and note on separate lines: no punctuation joins them, so it works in every script. */}
              <ul className="space-y-3">
                {reflection.themes.map((theme, i) => (
                  <li key={i} className="space-y-1">
                    <p className="font-medium text-foreground">{theme.title}</p>
                    <p className="reading text-base leading-7 text-foreground">{theme.note}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {reflection.images.length > 0 && (
            <Section title={t("dream.reflection.images")}>
              <ul className="space-y-3">
                {reflection.images.map((image, i) => (
                  <li key={i} className="space-y-1">
                    <p className="font-medium text-foreground">{image.image}</p>
                    <p className="reading text-base leading-7 text-foreground">{image.possibilities}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {reflection.wakingLinks.length > 0 && (
            <Section title={t("dream.reflection.wakingLinks")}>
              <ul className="list-disc space-y-1 pl-5">
                {reflection.wakingLinks.map((link, i) => (
                  <li key={i} className="reading text-base leading-7 text-foreground">{link}</li>
                ))}
              </ul>
            </Section>
          )}

          {reflection.questions.length > 0 && (
            <Section title={t("dream.reflection.questions")}>
              <ol className="list-decimal space-y-1 pl-5">
                {reflection.questions.map((question, i) => (
                  <li key={i} className="reading text-base leading-7 text-foreground">{question}</li>
                ))}
              </ol>
            </Section>
          )}

          {onSaveThoughts && (
            <div className="space-y-2">
              <label htmlFor={`dream-thoughts-${entry.id}`} className="block text-sm font-medium">
                {t("dream.reflection.thoughts.label")}
              </label>
              <Textarea
                id={`dream-thoughts-${entry.id}`}
                value={thoughts}
                onChange={(event) => setThoughts(event.target.value)}
                maxLength={DREAM_LIMITS.maxThoughtsCharacters}
                rows={3}
                placeholder={t("dream.reflection.thoughts.placeholder")}
                aria-describedby={isPro ? `dream-thoughts-hint-${entry.id}` : undefined}
                className="reading text-base leading-7"
              />
              <div className="flex flex-wrap items-center gap-2">
                {isPro && (
                  <p id={`dream-thoughts-hint-${entry.id}`} className="mr-auto text-xs text-muted-foreground">
                    {t("dream.reflection.thoughts.hint")}
                  </p>
                )}
                <Button
                  onClick={() => void saveThoughts()}
                  disabled={savingThoughts || !thoughtsChanged}
                  size="sm"
                  variant="outline"
                  className="ml-auto min-h-10 h-auto sm:min-h-9"
                >
                  {savingThoughts && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.save")}
                </Button>
                {/* Saves the thoughts and reflects on them in one step. */}
                {isPro && (
                  <Button
                    onClick={() => void reflectWithThoughts()}
                    disabled={loading || savingThoughts || !(thoughtsChanged || changed)}
                    size="sm"
                    className="min-h-10 h-auto sm:min-h-9"
                  >
                    {loading ? (
                      <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles aria-hidden="true" className="mr-2 h-4 w-4 flex-shrink-0" />
                    )}
                    {loading ? t("dream.reflection.reflecting") : t("dream.reflection.reflectAgain")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Always visible, even when the reflection is folded away. */}
      <p className="text-xs text-muted-foreground">
        {t("dream.reflection.footer")}
        {sentenceSeparator(i18n.language)}
        <button
          type="button"
          onClick={openDreamMethodHelp}
          className="underline underline-offset-4 hover:text-foreground"
        >
          {t("dream.reflection.howThisWorks")}
        </button>
      </p>
      {consent}
    </div>
  );
};
