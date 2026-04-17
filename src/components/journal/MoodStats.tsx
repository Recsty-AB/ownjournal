import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ChevronDown, Flame } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { useTranslation } from "react-i18next";
import { getDateLocale } from "@/utils/dateLocale";
import { format, subDays, startOfYear, addDays } from "date-fns";
import { MOOD_EMOJI } from "@/utils/moodEmoji";
import { computeMoodDistribution, computeRollingAverage, computeDayOfWeekAverages, computeStreaks, MOOD_SCORE, SCORE_TO_MOOD } from "@/utils/moodAnalytics";
import type { JournalEntryData } from "./JournalEntry";

const MOOD_CHART_COLORS: Record<string, string> = {
  great: "#34d399",   // emerald-400
  good: "#60a5fa",    // blue-400
  okay: "#facc15",    // yellow-400
  poor: "#fb923c",    // orange-400
  terrible: "#f87171", // red-400
};

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

  const bestDay = useMemo(() => {
    if (dayOfWeekAvg.length === 0) return null;
    return dayOfWeekAvg.reduce((best, d) => d.avgScore > best.avgScore ? d : best);
  }, [dayOfWeekAvg]);

  const worstDay = useMemo(() => {
    if (dayOfWeekAvg.length === 0) return null;
    return dayOfWeekAvg.reduce((worst, d) => d.avgScore < worst.avgScore ? d : worst);
  }, [dayOfWeekAvg]);

  // Chart configs for shadcn chart wrapper
  const pieConfig: ChartConfig = {
    great: { label: t('journalEntry.moods.great'), color: MOOD_CHART_COLORS.great },
    good: { label: t('journalEntry.moods.good'), color: MOOD_CHART_COLORS.good },
    okay: { label: t('journalEntry.moods.okay'), color: MOOD_CHART_COLORS.okay },
    poor: { label: t('journalEntry.moods.poor'), color: MOOD_CHART_COLORS.poor },
    terrible: { label: t('journalEntry.moods.terrible'), color: MOOD_CHART_COLORS.terrible },
  };

  const lineConfig: ChartConfig = {
    score: { label: t('moodStats.overTime'), color: "hsl(var(--primary))" },
  };

  const barConfig: ChartConfig = {
    avgScore: { label: t('moodStats.dayOfWeek'), color: "hsl(var(--primary))" },
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
      <Card className="bg-gradient-paper border border-border shadow-soft overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm sm:text-base">{t('moodStats.title')}</h3>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${!isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-4">
            {/* Date range selector */}
            <div className="flex flex-wrap gap-2">
              {(["last30days", "last90days", "thisYear", "allTime"] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    dateRange === range
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
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
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {t('moodStats.positivePercent', { percent: positivePercent })}
                </Badge>
              )}
              {bestDay && (
                <Badge variant="secondary">
                  {t('moodStats.bestDay', { day: bestDay.dayName })}
                </Badge>
              )}
              {worstDay && bestDay && worstDay.dayName !== bestDay.dayName && (
                <Badge variant="secondary">
                  {t('moodStats.worstDay', { day: worstDay.dayName })}
                </Badge>
              )}
            </div>

            {/* Mood Distribution - Donut Chart */}
            <div>
              <h4 className="text-sm font-medium mb-2">{t('moodStats.distribution')}</h4>
              <ChartContainer config={pieConfig} className="h-[200px]">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="count"
                    nameKey="mood"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {distribution.map((entry) => (
                      <Cell key={entry.mood} fill={MOOD_CHART_COLORS[entry.mood]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => {
                    const mood = name as string;
                    return `${MOOD_EMOJI[mood] || ''} ${value} (${distribution.find(d => d.mood === mood)?.percentage || 0}%)`;
                  }} />} />
                </PieChart>
              </ChartContainer>
              {/* Legend below chart */}
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {distribution.map(d => (
                  <div key={d.mood} className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MOOD_CHART_COLORS[d.mood] }} />
                    <span>{MOOD_EMOJI[d.mood]} {t(`journalEntry.moods.${d.mood}`)}: {d.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mood Over Time - Line Chart */}
            {rollingAvg.length > 1 && (
              <div>
                <h4 className="text-sm font-medium mb-2">{t('moodStats.overTime')}</h4>
                <ChartContainer config={lineConfig} className="h-[200px]">
                  <LineChart data={rollingAvg}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => format(new Date(val), 'MMM d', { locale: dateLocale })}
                      className="text-xs"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tickFormatter={(val) => MOOD_EMOJI[SCORE_TO_MOOD[val] || ''] || String(val)}
                      tick={{ fontSize: 12 }}
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

            {/* Day of Week - Bar Chart */}
            {dayOfWeekAvg.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">{t('moodStats.dayOfWeek')}</h4>
                <ChartContainer config={barConfig} className="h-[200px]">
                  <BarChart data={dayOfWeekAvg}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="dayName" tick={{ fontSize: 10 }} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} width={30} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => {
                      const score = Number(value);
                      const mood = SCORE_TO_MOOD[Math.round(score)];
                      return `${MOOD_EMOJI[mood] || ''} ${score.toFixed(1)}`;
                    }} />} />
                    <Bar dataKey="avgScore" radius={[4, 4, 0, 0]}>
                      {dayOfWeekAvg.map((entry) => (
                        <Cell
                          key={entry.dayIndex}
                          fill={MOOD_CHART_COLORS[SCORE_TO_MOOD[Math.round(entry.avgScore)] || 'okay']}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            {/* Streaks */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                {t('moodStats.streaks')}
              </h4>
              <div className="flex gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50 flex-1">
                  <div className="text-2xl font-bold">{streaks.currentStreak}</div>
                  <div className="text-xs text-muted-foreground">{t('moodStats.currentStreak')}</div>
                  <div className="text-xs text-muted-foreground">{t('moodStats.days')}</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50 flex-1">
                  <div className="text-2xl font-bold">{streaks.longestStreak}</div>
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
