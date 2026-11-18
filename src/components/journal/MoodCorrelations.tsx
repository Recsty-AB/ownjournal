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
import { canShowAnyPurchaseCTA } from "@/utils/platformDetection";
import { cn } from "@/lib/utils";
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
      fill: c.delta >= 0 ? "hsl(var(--diagnostic-success))" : "hsl(var(--diagnostic-error))",
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

  // On native (iOS/Android), free users see no Plus marketing surface — hide
  // the lock card entirely to avoid app-store rejections for referencing a
  // paid tier without a corresponding in-app purchase product. Pro users on
  // native still get the full feature.
  if (!isPro && !canShowAnyPurchaseCTA()) return null;

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-soft">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4">
            <div className="flex min-w-0 items-center gap-2">
              <Lightbulb aria-hidden="true" className="h-5 w-5 flex-shrink-0 text-primary" />
              <h3 className="text-sm font-medium sm:text-base">{t('moodCorrelations.title')}</h3>
              {!isPro && <Crown aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-seal" />}
            </div>
            <ChevronDown aria-hidden="true" className={cn("h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200", !isCollapsed && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          {!isPro ? (
            <div className="space-y-1 px-3 pb-4 sm:px-4 sm:pb-5">
              <p className="text-sm font-medium">{t('moodCorrelations.proFeature')}</p>
              <p className="text-sm text-muted-foreground">{t('moodCorrelations.proFeatureDesc')}</p>
            </div>
          ) : correlations.length === 0 ? (
            <div className="px-3 pb-4 sm:px-4 sm:pb-5">
              <p className="text-sm text-muted-foreground">{t('moodCorrelations.notEnoughData')}</p>
            </div>
          ) : (
          <div className="space-y-5 px-3 pb-4 sm:px-4 sm:pb-5">
            <p className="text-sm text-muted-foreground">{t('moodCorrelations.description')}</p>

            {/* Horizontal bar chart */}
            <div className="max-w-3xl" style={{ height: `${Math.max(200, chartData.length * 40)}px` }}>
              <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={120}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value, name, props) => {
                    const delta = Number(value);
                    const mood = SCORE_TO_MOOD[Math.round(props.payload.avgMood)] || '';
                    const emoji = MOOD_EMOJI[mood] || '';
                    return t('moodCorrelations.tooltipDetail', {
                      delta: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`,
                      emoji,
                      avg: props.payload.avgMood.toFixed(1),
                      count: props.payload.count,
                    });
                  }} />} />
                  <Bar dataKey="delta" radius={3} barSize={14}>
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
                <div className="flex items-start gap-2 text-sm">
                  <TrendingUp aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-diagnostic-success" />
                  <span>
                    {t('moodCorrelations.topPositive', {
                      activity: getActivityEmoji(topPositive.activity)
                        ? `${getActivityEmoji(topPositive.activity)} ${PREDEFINED_ACTIVITIES.some(p => p.key === topPositive.activity) ? t(`activities.${topPositive.activity}`) : topPositive.activity}`
                        : topPositive.activity
                    })}
                    {' '}
                    <Badge variant="outline" className="border-diagnostic-success/30 bg-diagnostic-success/10 font-medium tabular-nums">
                      {t('moodCorrelations.improvement', { value: topPositive.delta.toFixed(1) })}
                    </Badge>
                  </span>
                </div>
              )}
              {topNegative && (
                <div className="flex items-start gap-2 text-sm">
                  <TrendingDown aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-diagnostic-error" />
                  <span>
                    {t('moodCorrelations.topNegative', {
                      activity: getActivityEmoji(topNegative.activity)
                        ? `${getActivityEmoji(topNegative.activity)} ${PREDEFINED_ACTIVITIES.some(p => p.key === topNegative.activity) ? t(`activities.${topNegative.activity}`) : topNegative.activity}`
                        : topNegative.activity
                    })}
                    {' '}
                    <Badge variant="outline" className="border-diagnostic-error/30 bg-diagnostic-error/10 font-medium tabular-nums">
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
