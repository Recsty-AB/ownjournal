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
import type { JournalEntryData } from "./JournalEntry";

// Re-export so existing imports from this module keep working during the transition.
export { MOOD_CELL_COLORS };

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
      <Card className="bg-gradient-paper border border-border shadow-soft overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-2">
              <CalendarIcon aria-hidden="true" className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm sm:text-base">{t('moodCalendar.title')}</h3>
            </div>
            <ChevronDown aria-hidden="true" className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${!isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3">
            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} aria-label={t('moodCalendar.previousMonth', 'Previous month')}>
                <ChevronLeft aria-hidden="true" className="w-4 h-4" />
              </Button>
              <span className="text-base sm:text-lg font-semibold">
                {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} disabled={!canGoForward} aria-label={t('moodCalendar.nextMonth', 'Next month')}>
                <ChevronRight aria-hidden="true" className="w-4 h-4" />
              </Button>
            </div>

            {/* Calendar grid — justify-items-center keeps fixed-size cells aligned
                under their day-of-week column header on wide layouts. */}
            <TooltipProvider>
              <div className="grid grid-cols-7 gap-1 justify-items-center">
                {/* Day-of-week headers */}
                {weekDayHeaders.map((header, i) => (
                  <div key={i} className="text-xs text-muted-foreground font-medium py-1">
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
                    return <div key={i} className="w-11 h-11 sm:w-10 sm:h-10" />;
                  }

                  const cellColor = mood ? MOOD_CELL_COLORS[mood] : "bg-muted/50";
                  const tooltipText = mood
                    ? `${format(day, 'PPP', { locale: dateLocale })} — ${MOOD_EMOJI[mood]} ${t(`journalEntry.moods.${mood}`)}`
                    : `${format(day, 'PPP', { locale: dateLocale })} — ${t('moodCalendar.noEntries')}`;

                  return (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <button
                          className={`w-11 h-11 sm:w-10 sm:h-10 rounded-sm ${cellColor} transition-colors hover:opacity-80 flex items-center justify-center text-xs ${isToday ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''} ${mood ? 'cursor-pointer' : 'cursor-default'}`}
                          onClick={() => mood && onDayClick?.(day)}
                          tabIndex={mood ? 0 : -1}
                          aria-label={tooltipText}
                        >
                          <span className="text-[10px] sm:text-xs opacity-70">{format(day, 'd')}</span>
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
            <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
              {(['terrible', 'poor', 'okay', 'good', 'great'] as const).map(mood => (
                <div key={mood} className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 rounded-sm ${MOOD_CELL_COLORS[mood]}`} />
                  <span className="text-base">{MOOD_EMOJI[mood]}</span>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
