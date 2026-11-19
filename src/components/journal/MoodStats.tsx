import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ChevronDown, Flame } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";
import { getDateLocale } from "@/utils/dateLocale";
import { format, subDays, startOfYear, addDays } from "date-fns";
import { MOOD_EMOJI } from "@/utils/moodEmoji";
import { MOOD_CELL_COLORS } from "@/utils/moodColors";
import { cn } from "@/lib/utils";
import { computeMoodDistribution, computeRollingAverage, computeDayOfWeekAverages, computeStreaks, MOOD_SCORE, SCORE_TO_MOOD } from "@/utils/moodAnalytics";
import type { JournalEntryData } from "./JournalEntry";

type DateRange = "last30days" | "last90days" | "thisYear" | "allTime";

interface MoodStatsProps {
  entries: JournalEntryData[];
}

export const MoodStats = ({ entries }: MoodStatsProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("last30days");
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);

  // Filter entries by date range
  const filteredEntries = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    switch (dateRange) {
      case "last30days": startDate = subDays(now, 30); break;
      case "last90days": startDate = subDays(now, 90); break;
      case "thisYear": startDate = startOfYear(now); break;
      case "allTime": startDate = new Date(0); break;
    }
    return entries.filter(e => e.date >= startDate);
  }, [entries, dateRange]);

  const distribution = useMemo(() => computeMoodDistribution(filteredEntries), [filteredEntries]);
  const rollingAvg = useMemo(() => computeRollingAverage(filteredEntries), [filteredEntries]);
  const dayOfWeekAvg = useMemo(() => {
    const data = computeDayOfWeekAverages(filteredEntries);
    // Add localized day names
    const weekStart = addDays(new Date(2024, 0, 7), 0); // A known Sunday
    return data.map(d => ({
      ...d,
      dayName: format(addDays(weekStart, d.dayIndex), 'EEE', { locale: dateLocale })
    }));
  }, [filteredEntries, dateLocale]);
  const streaks = useMemo(() => computeStreaks(filteredEntries), [filteredEntries]);

  const positivePercent = useMemo(() => {
    const positive = distribution.filter(d => d.mood === 'great' || d.mood === 'good');
    return positive.reduce((sum, d) => sum + d.percentage, 0);
  }, [distribution]);

  // Suppress best/worst on ties: surfacing an arbitrary tied day would read
  // as a statistical claim that isn't supported by the data.
  const { bestDay, worstDay } = useMemo(() => {
    if (dayOfWeekAvg.length < 2) return { bestDay: null, worstDay: null };
    const maxScore = Math.max(...dayOfWeekAvg.map(d => d.avgScore));
    const minScore = Math.min(...dayOfWeekAvg.map(d => d.avgScore));
    const topDays = dayOfWeekAvg.filter(d => d.avgScore === maxScore);
    const bottomDays = dayOfWeekAvg.filter(d => d.avgScore === minScore);
    return {
      bestDay: topDays.length === 1 ? topDays[0] : null,
      worstDay: bottomDays.length === 1 ? bottomDays[0] : null,
    };
  }, [dayOfWeekAvg]);

  const lineConfig: ChartConfig = {
    score: { label: t('moodStats.overTime'), color: "hsl(var(--primary))" },
  };

  const hasAnyMoodData = useMemo(
     () => entries.some(e => e.mood && MOOD_SCORE[e.mood]),
     [entries]
  );

  if (!hasAnyMoodData) {
    return null;
  }

  const isRangeEmpty = distribution.length === 0;

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-soft">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4">
            <div className="flex min-w-0 items-center gap-2">
              <BarChart3 aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-primary" />
              <h3 className="text-sm font-medium sm:text-base">{t('moodStats.title')}</h3>
            </div>
            <ChevronDown aria-hidden="true" className={cn("h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200", !isCollapsed && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <div className="space-y-6 px-3 pb-4 sm:px-4 sm:pb-5">
            {/* Date range selector */}
            <div className="flex flex-wrap gap-2">
              {(["last30days", "last90days", "thisYear", "allTime"] as const).map(range => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDateRange(range)}
                  className="chip"
                  aria-pressed={dateRange === range}
                >
                  {t(`moodStats.${range}`)}
                </button>
              ))}
            </div>

            {isRangeEmpty ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('moodStats.noDataInRange')}
              </div>
            ) : (<>
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              {positivePercent > 0 && (
                <Badge variant="outline" className="font-normal tabular-nums">
                  {t('moodStats.positivePercent', { percent: positivePercent })}
                </Badge>
              )}
              {bestDay && (
                <Badge variant="outline" className="font-normal">
                  {t('moodStats.bestDay', { day: bestDay.dayName })}
                </Badge>
              )}
              {worstDay && (
                <Badge variant="outline" className="font-normal">
                  {t('moodStats.worstDay', { day: worstDay.dayName })}
                </Badge>
              )}
            </div>

            {/* Mood distribution: one bar split by share, so the five moods
                compare along a common length. */}
            <div>
              <h4 className="eyebrow mb-3">{t('moodStats.distribution')}</h4>
              <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
                {distribution.map(d => (
                  <div
                    key={d.mood}
                    className={cn("h-full min-w-1 basis-0", MOOD_CELL_COLORS[d.mood])}
                    style={{ flexGrow: d.count }}
                    title={`${MOOD_EMOJI[d.mood] || ''} ${d.count} (${d.percentage}%)`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {distribution.map(d => (
                  <div key={d.mood} className="flex items-center gap-1.5 text-xs tabular-nums">
                    <div aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", MOOD_CELL_COLORS[d.mood])} />
                    <span>{MOOD_EMOJI[d.mood]} {t(`journalEntry.moods.${d.mood}`)}: {d.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mood Over Time - Line Chart */}
            {rollingAvg.length > 1 && (
              <div>
                <h4 className="eyebrow mb-3">{t('moodStats.overTime')}</h4>
                <ChartContainer config={lineConfig} className="aspect-auto h-[200px] w-full">
                  <LineChart data={rollingAvg} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => format(new Date(val), 'MMM d', { locale: dateLocale })}
                      tick={{ fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={24}
                    />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tickFormatter={(val) => MOOD_EMOJI[SCORE_TO_MOOD[val] || ''] || String(val)}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => {
                      const score = Number(value);
                      const roundedMood = SCORE_TO_MOOD[Math.round(score)];
                      return `${MOOD_EMOJI[roundedMood] || ''} ${score.toFixed(1)}`;
                    }} />} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            )}

            {/* Day of week: each bar carries its own value, so no axis is needed. */}
            {dayOfWeekAvg.length > 0 && (
              <div>
                <h4 className="eyebrow mb-3">{t('moodStats.dayOfWeek')}</h4>
                <div className="flex h-40 max-w-2xl items-stretch">
                  {dayOfWeekAvg.map((entry) => {
                    const mood = SCORE_TO_MOOD[Math.round(entry.avgScore)];
                    return (
                      <div key={entry.dayIndex} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                        <div className="flex w-full flex-1 flex-col items-center justify-end gap-1 px-0.5 sm:px-2">
                          <span className="text-xs tabular-nums">{entry.avgScore.toFixed(1)}</span>
                          <div
                            className={cn("w-full max-w-12 rounded-t-md", MOOD_CELL_COLORS[mood || 'okay'])}
                            style={{ height: `${(entry.avgScore / 5) * 80}%` }}
                            title={`${MOOD_EMOJI[mood] || ''} ${entry.avgScore.toFixed(1)}`}
                          />
                        </div>
                        <span className="w-full truncate border-t border-border pt-1.5 text-center text-xs text-muted-foreground">{entry.dayName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Streaks */}
            <div>
              <h4 className="eyebrow mb-3 flex items-center gap-2">
                <Flame aria-hidden="true" className="h-3.5 w-3.5" />
                {t('moodStats.streaks')}
              </h4>
              <div className="grid max-w-md grid-cols-2 divide-x divide-border">
                <div className="pr-4">
                  <div className="text-3xl font-semibold tabular-nums">{streaks.currentStreak}</div>
                  <div className="text-xs text-muted-foreground">{t('moodStats.currentStreak')}</div>
                  <div className="text-xs text-muted-foreground">{t('moodStats.days')}</div>
                </div>
                <div className="pl-4">
                  <div className="text-3xl font-semibold tabular-nums">{streaks.longestStreak}</div>
                  <div className="text-xs text-muted-foreground">{t('moodStats.longestStreak')}</div>
                  <div className="text-xs text-muted-foreground">{t('moodStats.days')}</div>
                </div>
              </div>
            </div>
            </>)}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
