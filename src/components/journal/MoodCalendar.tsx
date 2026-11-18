import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isAfter } from "date-fns";
import { useTranslation } from "react-i18next";
import { getDateLocale } from "@/utils/dateLocale";
import { MOOD_EMOJI } from "@/utils/moodEmoji";
import { MOOD_CELL_COLORS } from "@/utils/moodColors";
import { cn } from "@/lib/utils";
import type { JournalEntryData } from "./JournalEntry";

const MOOD_SCORE: Record<string, number> = {
  terrible: 1, poor: 2, okay: 3, good: 4, great: 5
};

const SCORE_TO_MOOD: Record<number, string> = {
  1: 'terrible', 2: 'poor', 3: 'okay', 4: 'good', 5: 'great'
};

interface MoodCalendarProps {
  entries: JournalEntryData[];
  onDayClick?: (date: Date) => void;
}

export const MoodCalendar = ({ entries, onDayClick }: MoodCalendarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);

  // Build a map of date string -> average mood score
  const moodMap = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    entries.forEach(entry => {
      if (!entry.mood) return;
      const dateKey = format(entry.date, 'yyyy-MM-dd');
      const score = MOOD_SCORE[entry.mood];
      if (!score) return;
      const existing = map.get(dateKey) || { total: 0, count: 0 };
      map.set(dateKey, { total: existing.total + score, count: existing.count + 1 });
    });
    // Convert to average mood
    const result = new Map<string, string>();
    map.forEach((value, key) => {
      const avg = Math.round(value.total / value.count);
      result.set(key, SCORE_TO_MOOD[avg] || 'okay');
    });
    return result;
  }, [entries]);

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { locale: dateLocale });
    const calEnd = endOfWeek(monthEnd, { locale: dateLocale });

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth, dateLocale]);

  // Day-of-week headers
  const weekDayHeaders = useMemo(() => {
    const start = startOfWeek(new Date(), { locale: dateLocale });
    return Array.from({ length: 7 }, (_, i) =>
      format(addDays(start, i), 'EEEEEE', { locale: dateLocale })
    );
  }, [dateLocale]);

  const canGoForward = !isAfter(startOfMonth(addMonths(currentMonth, 1)), startOfMonth(new Date()));

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-soft">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4">
            <div className="flex min-w-0 items-center gap-2">
              <CalendarIcon aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-primary" />
              <h3 className="text-sm font-medium sm:text-base">{t('moodCalendar.title')}</h3>
            </div>
            <ChevronDown aria-hidden="true" className={cn("h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200", !isCollapsed && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          {/* Capped width: the card spans the full row when open on desktop,
              and a month stretched across it stops reading as a calendar. */}
          <div className="mx-auto max-w-[22rem] space-y-3 px-3 pb-4 sm:px-4 sm:pb-5">
            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} aria-label={t('moodCalendar.previousMonth', 'Previous month')}>
                <ChevronLeft aria-hidden="true" className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium sm:text-base">
                {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
              </span>
              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} disabled={!canGoForward} aria-label={t('moodCalendar.nextMonth', 'Next month')}>
                <ChevronRight aria-hidden="true" className="w-4 h-4" />
              </Button>
            </div>

            {/* Cells size to their column so seven always fit, down to 360px. */}
            <TooltipProvider>
              <div className="grid grid-cols-7 gap-1">
                {/* Day-of-week headers */}
                {weekDayHeaders.map((header, i) => (
                  <div key={i} className="py-1 text-center text-xs text-muted-foreground">
                    {header}
                  </div>
                ))}

                {/* Day cells */}
                {calendarDays.map((day, i) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const mood = moodMap.get(dateKey);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  if (!isCurrentMonth) {
                    return <div key={i} className="aspect-square" />;
                  }

                  const tooltipText = mood
                    ? `${format(day, 'PPP', { locale: dateLocale })} — ${MOOD_EMOJI[mood]} ${t(`journalEntry.moods.${mood}`)}`
                    : `${format(day, 'PPP', { locale: dateLocale })} — ${t('moodCalendar.noEntries')}`;

                  return (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "flex aspect-square w-full items-center justify-center rounded-md text-xs tabular-nums transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                            // Mood fills are the same mid-tones in every theme, so the
                            // day number on them stays dark instead of following the theme.
                            mood
                              ? cn(MOOD_CELL_COLORS[mood], "cursor-pointer text-black/80 hover:opacity-80")
                              : "cursor-default bg-muted/60 text-muted-foreground",
                            isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                          )}
                          onClick={() => mood && onDayClick?.(day)}
                          tabIndex={mood ? 0 : -1}
                          aria-label={tooltipText}
                        >
                          <span>{format(day, 'd')}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{tooltipText}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 pt-2 text-xs text-muted-foreground">
              {(['terrible', 'poor', 'okay', 'good', 'great'] as const).map(mood => (
                <div key={mood} className="flex items-center gap-1.5">
                  <div aria-hidden="true" className={cn("h-3 w-3 rounded-sm", MOOD_CELL_COLORS[mood])} />
                  <span aria-hidden="true">{MOOD_EMOJI[mood]}</span>
                  <span>{t(`journalEntry.moods.${mood}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
