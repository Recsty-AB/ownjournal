import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, Crown, Loader2, Moon, NotebookPen, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useDreamUsage } from "@/hooks/useDreamUsage";
import {
  dropDreamPatternsRequestOf,
  getDreamPatternsRequest,
  updateDreamPatternsRequest,
  useDreamPatternsRequest,
} from "@/hooks/useDreamPatternsRequest";
import { getCurrentUserId } from "@/utils/userScope";
import { getDateLocale } from "@/utils/dateLocale";
import { cn } from "@/lib/utils";
import { aiUsageLimits } from "@/services/aiUsageLimits";
import {
  DreamRequestError,
  hasDreamConsent,
  openDreamMethodHelp,
  sentenceSeparator,
  hasSeenPatternsReadyPrompt,
  isJournalLocked,
  onJournalLockChange,
  loadPatternsReport,
  dreamsForPatterns,
  tooShortDreams,
  requestDreamPatterns,
  requestDreamReflection,
  savePatternsReport,
  setPatternsReadyPromptSeen,
} from "@/services/dreamService";
import {
  DREAM_LIMITS,
  DREAM_PATTERNS_REPORT_CLEARED,
  type DreamPatternsReport,
  type DreamReflection,
  type DreamWakingComparison,
} from "@/types/dream";
import type { JournalEntryData } from "./JournalEntry";
import { DreamConsentDialog } from "./DreamConsentDialog";
import { CustomPeriodPicker, PeriodSelect } from "./PeriodPicker";
import { periodRange, type PeriodPreset } from "@/utils/period";

interface DreamPatternsProps {
  /** All journal entries, dreams included. */
  entries: JournalEntryData[];
  isPro: boolean;
  /** Saves the report text as a note so it syncs like other entries. */
  onSaveAsNote: (title: string, body: string) => Promise<void>;
  /**
   * Saves a reflection made for a dream of the period that had none, inside
   * that entry, like "Reflect on this dream" does.
   */
  onSaveReflection: (entry: JournalEntryData, reflection: DreamReflection) => Promise<void>;
}

// The three lists of the dreams-and-waking-life comparison, in reading order.
const WAKING_GROUPS = ["shared", "dreamsOnly", "wakingOnly"] as const;

const hasWakingItems = (waking: DreamWakingComparison | undefined): waking is DreamWakingComparison =>
  !!waking && WAKING_GROUPS.some((group) => waking[group].length > 0);

export const DreamPatterns = ({ entries, isPro, onSaveAsNote, onSaveReflection }: DreamPatternsProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  // The report saved on this device. A report made in this session comes from
  // the request, which outlives this card (see useDreamPatternsRequest).
  const [savedReport, setSavedReport] = useState<DreamPatternsReport | null>(null);
  const [reportLoaded, setReportLoaded] = useState(false);
  const request = useDreamPatternsRequest();
  const { loading, reflecting } = request;
  const report = request.report ?? savedReport;
  const [savingNote, setSavingNote] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const usage = useDreamUsage("dreamPatterns");
  const reflectionUsage = useDreamUsage("dreamReflection");

  // The period, as in Trend Analysis. Dreams in it that have no reflection
  // get one first (each counts towards the monthly reflections), then the
  // report is made from the labels saved with the reflections.
  const [preset, setPreset] = useState<PeriodPreset>("last30days");
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);
  const period = useMemo(() => periodRange(preset, customStart, customEnd), [preset, customStart, customEnd]);

  const hasDreams = useMemo(() => entries.some((e) => e.type === "dream"), [entries]);
  const periodDreams = useMemo(() => dreamsForPatterns(entries, period.start, period.end), [entries, period]);
  const withoutReflection = periodDreams.filter((d) => !d.dreamReflection).length;
  const tooShort = useMemo(() => tooShortDreams(entries, period.start, period.end), [entries, period]);
  const unlocked = periodDreams.length >= DREAM_LIMITS.dreamsForPatterns;
  const remaining = Math.max(0, usage.limit - usage.current);
  const reflectionsLeft = Math.max(0, reflectionUsage.limit - reflectionUsage.current);
  const tooFewReflections = withoutReflection > reflectionsLeft;

  // An encrypted journal that is still locked shows only the cached entry
  // list; nothing about the dreams, and the report cannot be decrypted yet.
  const [locked, setLocked] = useState(isJournalLocked);
  useEffect(() => onJournalLockChange(() => setLocked(isJournalLocked())), []);

  useEffect(() => {
    if (locked) {
      setSavedReport(null);
      setReportLoaded(false);
      return;
    }
    let cancelled = false;
    void loadPatternsReport().then((saved) => {
      if (cancelled) return;
      setSavedReport(saved);
      setReportLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [locked]);

  // "Delete all entries" removes the saved report along with the dreams.
  useEffect(() => {
    const onCleared = () => setSavedReport(null);
    window.addEventListener(DREAM_PATTERNS_REPORT_CLEARED, onCleared);
    return () => window.removeEventListener(DREAM_PATTERNS_REPORT_CLEARED, onCleared);
  }, []);

  // One-time nudge when the period first holds five dreams. No AI call is made
  // until the user taps Create.
  // Decided only after the saved report has loaded, so an existing report
  // never triggers the prompt.
  const shouldPrompt = reportLoaded && isPro && unlocked && !report && !hasSeenPatternsReadyPrompt();
  const [readyPrompt, setReadyPrompt] = useState(false);
  useEffect(() => {
    if (!shouldPrompt) return;
    setPatternsReadyPromptSeen();
    setReadyPrompt(true);
    setOpen(true);
  }, [shouldPrompt]);

  if (locked || !hasDreams) return null;

  const showError = (key: string) =>
    toast({
      title: t("dream.patterns.title"),
      description: t(`dream.patterns.errors.${key}`, { limit: DREAM_LIMITS.patternReportsPerMonth }),
      variant: "destructive",
    });

  const reflectionErrorKeys = ["limitReached", "offline", "failedLimitReached"];

  const runReport = async () => {
    if (getDreamPatternsRequest().loading) return;
    // The answer takes seconds. If the user signed out meanwhile (or another
    // account signed in), it is dropped: saving it now would put it in the
    // wrong account's storage, unencrypted when nobody is signed in.
    const startedBy = getCurrentUserId();
    const sameUser = () => getCurrentUserId() === startedBy;
    // The period and its dreams as they are when Create is tapped.
    const dreams = periodDreams;
    const range = period;
    const todo = dreams.filter((d) => !d.dreamReflection);
    updateDreamPatternsRequest({ loading: true, reflecting: null });
    try {
      // Reflect on the dreams that have none yet, one at a time. A dream the
      // AI could not reflect on is left out; the report still needs five.
      const made = new Map<string, DreamReflection>();
      for (let i = 0; i < todo.length; i++) {
        updateDreamPatternsRequest({ reflecting: { current: i + 1, total: todo.length } });
        try {
          const result = await requestDreamReflection(todo[i], entries, i18n.language);
          if (!sameUser()) return;
          aiUsageLimits.setMonthlyDreamCount("dreamReflection", result.used);
          made.set(todo[i].id, result.reflection);
          try {
            await onSaveReflection(todo[i], result.reflection);
          } catch {
            // Not saved with the dream; the report still uses it.
          }
        } catch (error) {
          if (!sameUser()) return;
          const code = error instanceof DreamRequestError ? error.code : "failed";
          if (reflectionErrorKeys.includes(code)) {
            if (code === "limitReached") aiUsageLimits.markLimitReached("dreamReflection");
            toast({
              title: t("dream.patterns.title"),
              description: t(`dream.reflection.errors.${code}`, { limit: DREAM_LIMITS.reflectionsPerMonth }),
              variant: "destructive",
            });
            return;
          }
        }
      }
      updateDreamPatternsRequest({ reflecting: null });

      const ready = dreams.map((d) => (made.has(d.id) ? { ...d, dreamReflection: made.get(d.id) } : d));
      const result = await requestDreamPatterns(ready, entries, i18n.language, range);
      if (!sameUser()) return;
      aiUsageLimits.setMonthlyDreamCount("dreamPatterns", result.used);
      updateDreamPatternsRequest({ report: result.report });
      await savePatternsReport(result.report);
    } catch (error) {
      if (!sameUser()) return;
      const code = error instanceof DreamRequestError ? error.code : "failed";
      if (code === "limitReached") {
        aiUsageLimits.markLimitReached("dreamPatterns");
        showError("limitReached");
      } else if (code === "offline" || code === "failedLimitReached" || code === "blocked") {
        showError(code);
      } else {
        showError("failed");
      }
    } finally {
      if (sameUser()) updateDreamPatternsRequest({ loading: false, reflecting: null });
      else dropDreamPatternsRequestOf(startedBy);
    }
  };

  const handleCreate = () => {
    if (!isPro || loading || !unlocked || tooFewReflections) return;
    if (!aiUsageLimits.canUseFeature("dreamPatterns").allowed) return showError("limitReached");
    if (!hasDreamConsent()) {
      setConsentOpen(true);
      return;
    }
    void runReport();
  };

  const reportAsText = (r: DreamPatternsReport) => {
    const lines = [r.overview, ""];
    if (r.recurring.length) {
      lines.push(`## ${t("dream.patterns.recurring")}`);
      // Middle dots and line breaks only, so no language-specific punctuation is assumed.
      r.recurring.forEach((item) =>
        lines.push(
          `- **${item.label}** · ${t(`dream.patterns.kinds.${item.kind}`)} · ${t("dream.patterns.inDreams", { count: item.count })}`,
          `  ${item.note}`,
        ),
      );
      lines.push("");
    }
    if (r.changes.length) {
      lines.push(`## ${t("dream.patterns.changes")}`, ...r.changes.map((c) => `- ${c}`), "");
    }
    if (hasWakingItems(r.waking)) {
      lines.push(`## ${t("dream.patterns.waking.title")}`, t("dream.patterns.waking.basedOn", { count: r.waking.entryCount }), "");
      WAKING_GROUPS.filter((group) => r.waking![group].length > 0).forEach((group) => {
        lines.push(`### ${t(`dream.patterns.waking.${group}`)}`);
        r.waking![group].forEach((item) => lines.push(`- **${item.label}**`, `  ${item.note}`));
        lines.push("");
      });
    }
    if (r.questions.length) {
      lines.push(`## ${t("dream.patterns.questions")}`, ...r.questions.map((q, i) => `${i + 1}. ${q}`), "");
    }
    lines.push(`_${t("dream.patterns.footer")}_`);
    return lines.join("\n");
  };

  const handleSaveAsNote = async () => {
    if (!report || savingNote) return;
    setSavingNote(true);
    try {
      const date = new Date(report.createdAt).toLocaleDateString(i18n.language);
      // The note save shows its own saving/saved toasts.
      await onSaveAsNote(t("dream.patterns.noteTitle", { date }), reportAsText(report));
    } finally {
      setSavingNote(false);
    }
  };

  const early = report ? report.dreamCount < DREAM_LIMITS.dreamsForFullPatterns : false;
  const dateLocale = getDateLocale(i18n.language);
  const day = (value: string) => format(parseISO(value), "PP", { locale: dateLocale });

  return (
    <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-soft">
      <Collapsible open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-accent/50 sm:p-4"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Moon aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-primary" />
            <span className="text-sm font-medium sm:text-base">{t("dream.patterns.title")}</span>
            {!isPro && <Crown aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-seal" />}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          />
        </button>

        <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
          <div className="space-y-4 px-3 pb-4 sm:px-4 sm:pb-5">
            <p className="text-sm text-muted-foreground">{t("dream.patterns.intro")}</p>

            <div className="space-y-2">
              {readyPrompt && !report && <p className="text-sm font-medium text-foreground">{t("dream.patterns.ready")}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <PeriodSelect value={preset} onChange={setPreset} disabled={loading} />
                <Button
                  onClick={handleCreate}
                  disabled={loading || !isPro || !unlocked || tooFewReflections}
                  size="sm"
                  variant={isPro ? "default" : "outline"}
                  className="min-h-11 h-auto"
                >
                  {loading ? (
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                  ) : isPro ? (
                    <Sparkles aria-hidden="true" className="mr-2 h-4 w-4" />
                  ) : (
                    <Crown aria-hidden="true" className="mr-2 h-4 w-4 text-seal" />
                  )}
                  {loading
                    ? reflecting
                      ? t("dream.patterns.reflecting", { current: reflecting.current, total: reflecting.total })
                      : t("dream.patterns.creating")
                    : report
                      ? t("dream.patterns.createNew")
                      : t("dream.patterns.create")}
                </Button>
                {report && (
                  <Button onClick={handleSaveAsNote} disabled={savingNote} size="sm" variant="outline" className="min-h-11 h-auto">
                    <NotebookPen aria-hidden="true" className="mr-2 h-4 w-4" />
                    {t("dream.patterns.saveAsNote")}
                  </Button>
                )}
              </div>
              {/* A meta row like Trend Analysis's: separate items, no sentence joining. */}
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
                <span>{t("dream.patterns.dreamsInPeriod", { count: periodDreams.length })}</span>
                {!unlocked && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{t("dream.patterns.needMore", { min: DREAM_LIMITS.dreamsForPatterns })}</span>
                  </>
                )}
              </p>
              {tooShort > 0 && (
                <p className="text-xs tabular-nums text-muted-foreground">
                  {t("dream.patterns.tooShort", { count: tooShort, min: DREAM_LIMITS.minCharacters })}
                </p>
              )}
              {isPro && unlocked && withoutReflection > 0 && (
                <p className={cn("text-xs tabular-nums", tooFewReflections ? "font-medium text-diagnostic-warning" : "text-muted-foreground")}>
                  {!tooFewReflections
                    ? t("dream.patterns.reflectFirst", { count: withoutReflection, remaining: reflectionsLeft })
                    : reflectionsLeft === 0
                      ? t("dream.patterns.noReflectionsLeft", { count: withoutReflection })
                      : t("dream.patterns.notEnoughReflections", { count: reflectionsLeft, dreams: withoutReflection })}
                </p>
              )}
              <p className="text-xs tabular-nums text-muted-foreground">
                {isPro
                  ? t("dream.patterns.remaining", { remaining, limit: usage.limit })
                  : t("dream.patterns.plusOnly")}
              </p>
              {preset === "custom" && (
                <CustomPeriodPicker start={customStart} end={customEnd} onStartChange={setCustomStart} onEndChange={setCustomEnd} />
              )}
            </div>

            {report && (
              <div className="space-y-5 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  <span>{new Date(report.createdAt).toLocaleDateString(i18n.language)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t("dream.patterns.basedOn", { count: report.dreamCount })}</span>
                  {report.periodStart && report.periodEnd && (
                    <>
                      <span aria-hidden="true">·</span>
                      {/* Written like the period of a Trend Analysis. */}
                      <span>{day(report.periodStart)} – {day(report.periodEnd)}</span>
                    </>
                  )}
                </div>

                {early && (
                  <div className="space-y-1">
                    <Badge variant="outline">{t("dream.patterns.earlyThemes")}</Badge>
                    <p className="text-xs text-muted-foreground">
                      {t("dream.patterns.earlyThemesNote", { count: report.dreamCount })}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t("dream.patterns.overview")}</h4>
                  <p className="reading text-base leading-7 text-foreground">{report.overview}</p>
                </div>

                {report.recurring.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t("dream.patterns.recurring")}</h4>
                    <ul className="space-y-3">
                      {report.recurring.map((item, i) => (
                        <li key={i} className="space-y-1">
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{item.label}</span>
                            <Badge variant="outline" className="font-normal">{t(`dream.patterns.kinds.${item.kind}`)}</Badge>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {t("dream.patterns.inDreams", { count: item.count })}
                            </span>
                          </p>
                          <p className="reading text-base leading-7 text-foreground">{item.note}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.changes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t("dream.patterns.changes")}</h4>
                    <ul className="list-disc space-y-1 pl-5">
                      {report.changes.map((text, i) => (
                        <li key={i} className="reading text-base leading-7 text-foreground">{text}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {hasWakingItems(report.waking) ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">{t("dream.patterns.waking.title")}</h4>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {t("dream.patterns.waking.basedOn", { count: report.waking.entryCount })}
                      </p>
                    </div>
                    {WAKING_GROUPS.filter((group) => report.waking![group].length > 0).map((group) => (
                      <div key={group} className="space-y-2">
                        <h5 className="text-sm font-medium text-muted-foreground">{t(`dream.patterns.waking.${group}`)}</h5>
                        <ul className="space-y-3">
                          {report.waking![group].map((item, i) => (
                            <li key={i} className="space-y-1">
                              <p className="font-medium text-foreground">{item.label}</p>
                              <p className="reading text-base leading-7 text-foreground">{item.note}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  // No comparison was made: too few analysed journal entries.
                  !report.waking && (
                    <p className="text-sm text-muted-foreground">
                      {t("dream.patterns.waking.none", { min: DREAM_LIMITS.wakingEntriesForPatterns })}
                    </p>
                  )
                )}

                {report.questions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t("dream.patterns.questions")}</h4>
                    <ol className="list-decimal space-y-1 pl-5">
                      {report.questions.map((q, i) => (
                        <li key={i} className="reading text-base leading-7 text-foreground">{q}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {t("dream.patterns.footer")}
                  {sentenceSeparator(i18n.language)}
                  <button type="button" onClick={openDreamMethodHelp} className="underline underline-offset-4 hover:text-foreground">
                    {t("dream.reflection.howThisWorks")}
                  </button>
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
      <DreamConsentDialog open={consentOpen} onOpenChange={setConsentOpen} onAccept={() => void runReport()} />
    </Card>
  );
};
