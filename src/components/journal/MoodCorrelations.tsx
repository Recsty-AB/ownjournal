import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ChevronDown, TrendingUp, TrendingDown, Crown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { useTranslation } from "react-i18next";
import { MOOD_EMOJI } from "@/utils/moodEmoji";
import { PREDEFINED_ACTIVITIES, getActivityEmoji } from "@/utils/activities";
import { computeActivityCorrelations, SCORE_TO_MOOD } from "@/utils/moodAnalytics";
import type { JournalEntryData } from "./JournalEntry";

interface MoodCorrelationsProps {
  entries: JournalEntryData[];
  isPro: boolean;
}

export const MoodCorrelations = ({ entries, isPro }: MoodCorrelationsProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { t } = useTranslation();

  const correlations = useMemo(() => computeActivityCorrelations(entries), [entries]);

  // Prepare chart data with labels
  const chartData = useMemo(() =>
    correlations.map(c => ({
      ...c,
      label: getActivityEmoji(c.activity)
        ? `${getActivityEmoji(c.activity)} ${PREDEFINED_ACTIVITIES.some(p => p.key === c.activity) ? t(`activities.${c.activity}`) : c.activity}`
        : c.activity,
      fill: c.delta >= 0 ? "#34d399" : "#f87171",
    })),
    [correlations, t]
  );

  const topPositive = correlations.find(c => c.delta > 0);
  const topNegative = [...correlations].reverse().find(c => c.delta < 0);

  const chartConfig: ChartConfig = {
    delta: { label: t('moodCorrelations.title'), color: "hsl(var(--primary))" },
  };

  // Check if there are any entries with activities at all
  const hasActivities = entries.some(e => e.activities && e.activities.length > 0);
  if (!hasActivities && correlations.length === 0) return null;

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <Card className="bg-gradient-paper border border-border shadow-soft overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 sm:p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm sm:text-base">{t('moodCorrelations.title')}</h3>
              {!isPro && <Crown className="w-4 h-4 text-amber-500" />}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${!isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          {!isPro ? (
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 text-center space-y-2">
              <Crown className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-sm font-medium">{t('moodCorrelations.proFeature')}</p>
              <p className="text-xs text-muted-foreground">{t('moodCorrelations.proFeatureDesc')}</p>
            </div>
          ) : correlations.length === 0 ? (
            <div className="px-3 sm:px-4 pb-3 sm:pb-4">
              <p className="text-sm text-muted-foreground">{t('moodCorrelations.notEnoughData')}</p>
            </div>
          ) : (
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-4">
            <p className="text-xs text-muted-foreground">{t('moodCorrelations.description')}</p>

            {/* Horizontal bar chart */}
            <div style={{ height: `${Math.max(200, chartData.length * 40)}px` }}>
              <ChartContainer config={chartConfig} className="h-full">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <ReferenceLine x={0} stroke="hsl(var(--border))" />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value, name, props) => {
                    const delta = Number(value);
                    const mood = SCORE_TO_MOOD[Math.round(props.payload.avgMood)] || '';
                    const emoji = MOOD_EMOJI[mood] || '';
                    return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} (${t('moodCorrelations.tooltipAvg')}: ${emoji} ${props.payload.avgMood.toFixed(1)}, ${props.payload.count} ${t('moodCorrelations.tooltipEntries')})`;
                  }} />} />
                  <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>

            {/* Summary insights */}
            <div className="space-y-2">
              {topPositive && (
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>
                    {t('moodCorrelations.topPositive', {
                      activity: getActivityEmoji(topPositive.activity)
                        ? `${getActivityEmoji(topPositive.activity)} ${PREDEFINED_ACTIVITIES.some(p => p.key === topPositive.activity) ? t(`activities.${topPositive.activity}`) : topPositive.activity}`
                        : topPositive.activity
                    })}
                    {' '}
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {t('moodCorrelations.improvement', { value: topPositive.delta.toFixed(1) })}
                    </Badge>
                  </span>
                </div>
              )}
              {topNegative && (
                <div className="flex items-center gap-2 text-sm">
                  <TrendingDown className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span>
                    {t('moodCorrelations.topNegative', {
                      activity: getActivityEmoji(topNegative.activity)
                        ? `${getActivityEmoji(topNegative.activity)} ${PREDEFINED_ACTIVITIES.some(p => p.key === topNegative.activity) ? t(`activities.${topNegative.activity}`) : topNegative.activity}`
                        : topNegative.activity
                    })}
                    {' '}
                    <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                      {t('moodCorrelations.decline', { value: topNegative.delta.toFixed(1) })}
                    </Badge>
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">{t('moodCorrelations.minEntries')}</p>
          </div>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
