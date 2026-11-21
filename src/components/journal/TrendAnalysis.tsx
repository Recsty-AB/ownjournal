import { useState, useEffect, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Loader2, Crown, ChevronDown, Calendar as CalendarIcon, AlertTriangle, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, isAfter, isBefore } from "date-fns";
import { CustomPeriodPicker, PeriodSelect } from "./PeriodPicker";
import { periodRange, type PeriodPreset } from "@/utils/period";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithRetry } from "@/utils/edgeFunctionRetry";
import { useToast } from "@/hooks/use-toast";
import type { JournalEntryData } from "./JournalEntry";
import { analyzeMissingEntries, isFailedEntryAnalysis, loadEntryAnalyses, needsEntryAnalysis } from "@/services/entryAnalysisService";
import type { EntryAIMetadata, AggregatedMetadata } from "@/types/aiMetadata";
import { aiUsageLimits } from "@/services/aiUsageLimits";
import { useTranslation } from "react-i18next";
import { aiCacheService } from "@/services/aiCacheService";
import { cloudStorageService } from "@/services/cloudStorageService";
import { storageServiceV2 } from "@/services/storageServiceV2";
import { encryptData, decryptData, arrayBufferToBase64, base64ToArrayBuffer } from "@/utils/encryption";
import { isE2EEnabled } from "@/utils/encryptionModeStorage";
import { getMockTrendAnalysis } from "@/demo/mockAIResponses";
import { computeTimeBuckets, shouldUseTimeBuckets, type EntryWithDateAndMetadata } from "@/utils/timeBucketAggregation";
import { getDateLocale } from "@/utils/dateLocale";
import { canShowAnyPurchaseCTA } from "@/utils/platformDetection";

interface TrendAnalysisProps {
  entries: JournalEntryData[];
  isPro: boolean;
  isDemo?: boolean;
}

interface TrendData {
  periodSummary: string;
  moodTrend: string;
  insights: string[];
  focusAreas: string[];
  closingReflection?: string;
}

interface CloudTrendData {
  version: number;
  timestamp: number;
  entryIds: string[];
  periodStart: string;  // ISO date string of analyzed period start
  periodEnd: string;    // ISO date string of analyzed period end
  analysis: TrendData;
}

export const TrendAnalysis = ({ entries, isPro, isDemo = false }: TrendAnalysisProps) => {
  const [analysis, setAnalysis] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null);
  const [analyzingCount, setAnalyzingCount] = useState(0);
  const [progress, setProgress] = useState({ step: 0, totalSteps: 5, currentAction: '', currentEntry: 0, totalEntries: 0 });
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed when loaded from storage
  const [focusAreasOpen, setFocusAreasOpen] = useState(false); // Suggested Focus Areas collapsed by default
  const [reflectionOpen, setReflectionOpen] = useState(false); // Reflection collapsed by default
  const [isSelectingPeriod, setIsSelectingPeriod] = useState(false); // Track if user is selecting a new period
  // Setup/empty-state card visibility. For free users the card is a permanent
  // upsell (they can never run an analysis), so it starts collapsed like the
  // sibling insight cards; Plus users get the form expanded so they can run
  // their first analysis.
  const [isSetupCollapsed, setIsSetupCollapsed] = useState(!isPro);

  // Subscription state can resolve after first render (cold start before the
  // cached subscription applies); expand once Plus is confirmed so paying
  // users aren't left with a collapsed setup form.
  useEffect(() => {
    if (isPro) setIsSetupCollapsed(false);
  }, [isPro]);
  const [dateRangePreset, setDateRangePreset] = useState<PeriodPreset>("last30days");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  // Store the actual period that was analyzed (not the current selection)
  const [analyzedPeriodStart, setAnalyzedPeriodStart] = useState<Date | null>(null);
  const [analyzedPeriodEnd, setAnalyzedPeriodEnd] = useState<Date | null>(null);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Get date-fns locale based on current language (supports all 17 app languages)
  const dateLocale = getDateLocale(i18n.language);

  // Calculate date range and filter entries based on selection
  const { startDate, endDate, filteredEntries } = useMemo(() => {
    const { start, end } = periodRange(dateRangePreset, customStartDate, customEndDate);

    const filtered = entries.filter(entry => {
      const entryDate = entry.date;
      return isAfter(entryDate, start) && isBefore(entryDate, end);
    });

    return { startDate: start, endDate: end, filteredEntries: filtered };
  }, [entries, dateRangePreset, customStartDate, customEndDate]);

  const canAnalyze = () => {
    const limitCheck = aiUsageLimits.canUseFeature('trendAnalysis');
    return limitCheck.allowed;
  };

  // --- Cloud helpers that handle both E2E and Simple mode ---
  const CLOUD_FILE = '/analysis/trend_analysis.json.enc';

  const uploadTrendToCloud = async (data: CloudTrendData): Promise<void> => {
    const e2e = isE2EEnabled();
    const masterKey = storageServiceV2.getMasterKey();

    let content: string;
    if (e2e && masterKey) {
      const { encrypted, iv } = await encryptData(JSON.stringify(data), masterKey);
      content = JSON.stringify({ data: arrayBufferToBase64(encrypted), iv: arrayBufferToBase64(iv) });
    } else {
      // Simple mode — store as plain JSON
      content = JSON.stringify(data);
    }

    await cloudStorageService.uploadToAll(CLOUD_FILE, content);
  };

  const downloadTrendFromCloud = async (): Promise<CloudTrendData | null> => {
    const raw = await cloudStorageService.downloadFromPrimary(CLOUD_FILE);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // If it has data+iv fields, it's encrypted
    if (parsed.data && parsed.iv) {
      const masterKey = storageServiceV2.getMasterKey();
      if (!masterKey) return null; // Can't decrypt without key
      const decrypted = await decryptData(
        base64ToArrayBuffer(parsed.data),
        masterKey,
        base64ToArrayBuffer(parsed.iv)
      );
      return JSON.parse(decrypted);
    }

    // Otherwise it's plain JSON (Simple mode)
    return parsed as CloudTrendData;
  };

  const syncedForFingerprintRef = useRef<string>('');
  const loadInFlightRef = useRef(false);

  // Load trend analysis from local cache and/or cloud, and ensure cloud has the latest.
  useEffect(() => {
    // Build fingerprint of current entries to detect meaningful changes
    const entriesFingerprint = filteredEntries.map(e => e.id).sort().join(',');
    if (syncedForFingerprintRef.current === entriesFingerprint) return;
    if (loadInFlightRef.current) return;

    let cancelled = false;
    loadInFlightRef.current = true;

    const run = async () => {
      try {
        // --- Determine cloud access ---
        const providers = cloudStorageService.getConnectedProviderNames();
        const e2e = isE2EEnabled();

        // In E2E mode, masterKey loads asynchronously — wait up to 5s
        let hasCloud = false;
        if (providers.length > 0) {
          if (e2e) {
            let masterKey = storageServiceV2.getMasterKey();
            if (!masterKey) {
              for (let i = 0; i < 10; i++) {
                await new Promise(r => setTimeout(r, 500));
                if (cancelled) return;
                masterKey = storageServiceV2.getMasterKey();
                if (masterKey) break;
              }
            }
            hasCloud = !!masterKey;
          } else {
            // Simple mode — no key needed
            hasCloud = true;
          }
        }

        // --- Load from local IndexedDB cache ---
        let localData: { analysis: TrendData; timestamp: number; periodStart?: string; periodEnd?: string } | null = null;
        if (filteredEntries.length >= 8) {
          const cacheKey = await aiCacheService.getTrendCacheKey(filteredEntries);
          const cached = await aiCacheService.getCached(cacheKey, 'trendAnalysis');
          if (cached?.analysis) {
            localData = {
              analysis: cached.analysis,
              timestamp: cached.timestamp || 0,
              periodStart: cached.periodStart,
              periodEnd: cached.periodEnd,
            };
          }
        }

        // --- Load from cloud ---
        let cloudData: CloudTrendData | null = null;
        if (hasCloud) {
          try {
            cloudData = await downloadTrendFromCloud();
          } catch {
            // File doesn't exist or failed — not an error
          }
        }

        if (cancelled) return;

        // --- Ownership guard ---
        // Reject any cloud payload whose entryIds do not belong to the
        // current user's entries. Prevents another account's trend analysis
        // from being rendered if a stale cloud file is read (defense in depth
        // on top of the component being keyed by user.id in Index.tsx).
        if (cloudData?.entryIds && cloudData.entryIds.length > 0) {
          const knownIds = new Set(entries.map(e => e.id));
          const allBelong = cloudData.entryIds.every(id => knownIds.has(id));
          if (!allBelong) {
            cloudData = null;
          }
        }

        // --- Pick the best source ---
        let best: { analysis: TrendData; timestamp: number; periodStart: string | null; periodEnd: string | null } | null = null;
        let localIsNewer = false;

        if (cloudData?.analysis) {
          best = {
            analysis: cloudData.analysis,
            timestamp: cloudData.timestamp,
            periodStart: cloudData.periodStart || null,
            periodEnd: cloudData.periodEnd || null,
          };
        }

        if (localData) {
          if (!best || localData.timestamp > best.timestamp) {
            best = {
              analysis: localData.analysis,
              timestamp: localData.timestamp,
              periodStart: localData.periodStart || null,
              periodEnd: localData.periodEnd || null,
            };
            localIsNewer = true;
          }
        }

        // --- Apply to state ---
        if (best && !cancelled) {
          setAnalysis(best.analysis);
          if (best.periodStart) setAnalyzedPeriodStart(new Date(best.periodStart));
          if (best.periodEnd) setAnalyzedPeriodEnd(new Date(best.periodEnd));
          setLastAnalyzed(new Date(best.timestamp));
        } else if (!cancelled) {
          // No cached/cloud analysis matches the current entry set (e.g. after
          // account switch or import). Clear stale state from a prior session
          // so we don't render another user's analysis.
          setAnalysis(null);
          setLastAnalyzed(null);
          setAnalyzedPeriodStart(null);
          setAnalyzedPeriodEnd(null);
        }

        // --- Backfill cloud if local is newer or cloud is missing ---
        if (hasCloud && best && localIsNewer && (!cloudData || localData!.timestamp > (cloudData?.timestamp || 0))) {
          try {
            const payload: CloudTrendData = {
              version: 1,
              timestamp: best.timestamp,
              entryIds: filteredEntries.map(e => e.id),
              periodStart: best.periodStart || new Date().toISOString(),
              periodEnd: best.periodEnd || new Date().toISOString(),
              analysis: best.analysis,
            };
            await uploadTrendToCloud(payload);
            console.log('[TrendAnalysis] Backfilled cloud with local analysis');
          } catch (error) {
            console.error('[TrendAnalysis] Failed to backfill cloud:', error);
          }
        }

        syncedForFingerprintRef.current = entriesFingerprint;
      } catch (error) {
        if (import.meta.env.DEV) console.error('[TrendAnalysis] Load error:', error);
      } finally {
        loadInFlightRef.current = false;
      }
    };

    run();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, filteredEntries]);

  // Save trend analysis to both local cache and cloud storage
  const saveTrendAnalysis = async (analysisData: TrendData, periodStart: Date, periodEnd: Date) => {
    try {
      const timestamp = Date.now();
      const entryIds = filteredEntries.map(e => e.id);
      
      // Save to local cache (include period dates)
      const cacheKey = await aiCacheService.getTrendCacheKey(filteredEntries);
      await aiCacheService.setCached(cacheKey, 'trendAnalysis', {
        timestamp,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        analysis: analysisData
      });
      
      // Save to cloud storage (encrypted in E2E mode, plain in Simple mode)
      if (cloudStorageService.getConnectedProviderNames().length > 0) {
        const e2e = isE2EEnabled();
        const masterKey = storageServiceV2.getMasterKey();
        // In E2E mode, require masterKey. In Simple mode, proceed without it.
        if (!e2e || masterKey) {
          const cloudPayload: CloudTrendData = {
            version: 1,
            timestamp,
            entryIds,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            analysis: analysisData
          };
          await uploadTrendToCloud(cloudPayload);
          console.log('[TrendAnalysis] ✅ Uploaded to cloud storage');
        }
      }
    } catch (error) {
      console.error('[TrendAnalysis] Failed to save to cloud:', error);
      // Don't fail the whole operation if cloud save fails
    }
  };

  const aggregateMetadata = (metadataList: EntryAIMetadata[]): AggregatedMetadata => {
    const emotions: Record<string, number> = {};
    const topics: Record<string, number> = {};
    const timeOfDay: Record<string, number> = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0
    };
    const lengthDist: Record<string, number> = {
      short: 0,
      medium: 0,
      long: 0
    };
    
    let totalSentiment = 0;

    metadataList.forEach(meta => {
      totalSentiment += meta.sentimentScore;
      
      meta.emotions.forEach(emotion => {
        emotions[emotion] = (emotions[emotion] || 0) + 1;
      });
      
      meta.topics.forEach(topic => {
        topics[topic] = (topics[topic] || 0) + 1;
      });
      
      timeOfDay[meta.timeOfDay] = (timeOfDay[meta.timeOfDay] || 0) + 1;
      lengthDist[meta.lengthCategory] = (lengthDist[meta.lengthCategory] || 0) + 1;
    });

    const sortedEmotions = Object.entries(emotions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([emotion, count]) => ({ emotion, count }));

    const sortedTopics = Object.entries(topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    return {
      entryCount: metadataList.length,
      avgSentiment: totalSentiment / metadataList.length,
      topEmotions: sortedEmotions,
      topTopics: sortedTopics,
      timeOfDayDistribution: timeOfDay,
      lengthDistribution: lengthDist
    };
  };

  const handleAnalyze = async () => {
    // Demo mode: use mock responses
    if (isDemo) {
      setLoading(true);
      setProgress({ step: 1, totalSteps: 3, currentAction: t('trendAnalysis.progress.checkingEntries'), currentEntry: 0, totalEntries: 0 });
      
      // Simulate network delay for realism
      await new Promise(resolve => setTimeout(resolve, 600));
      setProgress({ step: 2, totalSteps: 3, currentAction: t('trendAnalysis.progress.aggregatingPatterns'), currentEntry: 0, totalEntries: 0 });
      await new Promise(resolve => setTimeout(resolve, 800));
      setProgress({ step: 3, totalSteps: 3, currentAction: t('trendAnalysis.progress.generatingInsights'), currentEntry: 0, totalEntries: 0 });
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const mockTrend = getMockTrendAnalysis();
      setAnalysis({
        periodSummary: mockTrend.summary,
        moodTrend: mockTrend.moodTrend.map(m => m.label).join(", "),
        insights: mockTrend.insights,
        focusAreas: mockTrend.topThemes.map(t => t.theme),
        closingReflection: "This is a demo preview - start your real journal to get personalized insights based on your own entries!"
      });
      setAnalyzedPeriodStart(startDate);
      setAnalyzedPeriodEnd(endDate);
      setLastAnalyzed(new Date());
      setIsSelectingPeriod(false);
      setIsCollapsed(false);
      setLoading(false);
      return;
    }

    // Check Pro status first
    if (!isPro) {
      toast({
        title: t('trendAnalysis.proFeature'),
        description: t('trendAnalysis.proRequired'),
        variant: "destructive",
      });
      return;
    }

    if (filteredEntries.length < 8) {
      toast({
        title: t('trendAnalysis.notEnoughEntries'),
        description: t('trendAnalysis.need8Entries'),
        variant: "destructive",
      });
      return;
    }

    const limitCheck = aiUsageLimits.canUseFeature('trendAnalysis');
    if (!limitCheck.allowed) {
      toast({
        title: t('trendAnalysis.limitReached'),
        description: limitCheck.reason,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProgress({ step: 1, totalSteps: 5, currentAction: t('trendAnalysis.progress.checkingEntries'), currentEntry: 0, totalEntries: 0 });
    
    try {
      // Step 1: Check which entries have metadata
      const entriesWithMetadata = await loadEntryAnalyses(filteredEntries);

      // Step 2: Analyze missing OR failed entries
      const missingCount = entriesWithMetadata.filter(needsEntryAnalysis).length;
      if (missingCount > 0) {
        setAnalyzingCount(missingCount);
        setProgress({ step: 2, totalSteps: 5, currentAction: t('trendAnalysis.progress.analyzingEntry', { current: 0, total: missingCount }), currentEntry: 0, totalEntries: missingCount });
        toast({
          title: t('trendAnalysis.analyzingEntries'),
          description: t('trendAnalysis.analyzingEntriesDesc', { count: missingCount }),
        });

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast({
            title: t('trendAnalysis.authRequired'),
            description: t('trendAnalysis.signInRequired'),
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        await analyzeMissingEntries(entriesWithMetadata, {
          language: i18n.language,
          accessToken: session.access_token,
          onProgress: ({ done, total, retrying }) =>
            setProgress({
              step: 2,
              totalSteps: 5,
              currentAction: retrying
                ? t('trendAnalysis.progress.retrying', { defaultValue: 'Retrying...' })
                : t('trendAnalysis.progress.analyzingEntry', { current: done, total }),
              currentEntry: done,
              totalEntries: total,
            }),
        });
      }

      // Step 3: Collect all VALID metadata (exclude failed analyses)
      const allMetadata = entriesWithMetadata
        .map(e => e.metadata)
        .filter((m): m is EntryAIMetadata => m !== null && !isFailedEntryAnalysis(m));

      // Track failed entries for logging
      const failedCount = entriesWithMetadata.filter(e => 
        e.metadata && isFailedEntryAnalysis(e.metadata)
      ).length;

      if (failedCount > 0) {
        console.log(`[INFO] ${failedCount} entries have failed analysis and will be excluded from trends`);
      }

      if (allMetadata.length < 8) {
        toast({
          title: t('trendAnalysis.notEnoughData'),
          description: t('trendAnalysis.notEnoughDataDesc'),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Step 3: Aggregate locally
      setProgress({ step: 3, totalSteps: 5, currentAction: t('trendAnalysis.progress.aggregatingPatterns'), currentEntry: 0, totalEntries: 0 });
      const aggregated = aggregateMetadata(allMetadata);

      // Step 4: Call trend endpoint with aggregated data
      setProgress({ step: 4, totalSteps: 5, currentAction: t('trendAnalysis.progress.generatingInsights'), currentEntry: 0, totalEntries: 0 });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: t('trendAnalysis.authRequired'),
          description: t('trendAnalysis.signInRequired'),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const currentLanguage = i18n.language.split('-')[0]; // 'en', 'es', or 'ja'
      
      // Calculate period length in days for adaptive data strategy
      const periodDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Prepare request body with adaptive data strategy
      const requestBody: Record<string, unknown> = {
        type: 'analyzeTrends',
        language: currentLanguage,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        aggregates: aggregated,
      };
      
      if (shouldUseTimeBuckets(periodDays)) {
        // Long period (>90 days): Use time-bucketed aggregation
        // Prepare entries with metadata and dates for bucketing
        const entriesWithDates: EntryWithDateAndMetadata[] = entriesWithMetadata
          .filter(e => e.metadata && !isFailedEntryAnalysis(e.metadata))
          .map(e => ({
            entry: e.entry,
            metadata: e.metadata as EntryAIMetadata
          }));
        
        requestBody.timeBuckets = computeTimeBuckets(
          entriesWithDates,
          startDate,
          endDate,
          periodDays
        );
        
        console.log(`[TrendAnalysis] Using time buckets for ${periodDays}-day period: ${(requestBody.timeBuckets as unknown[]).length} buckets`);
      } else {
        // Short period (≤90 days): Send individual entry metadata
        requestBody.entryMetadata = allMetadata.slice(0, 90).map(m => ({
          analyzedAt: m.analyzedAt,
          sentimentScore: m.sentimentScore,
          dominantEmotion: m.dominantEmotion,
          topics: m.topics.slice(0, 3),
          timeOfDay: m.timeOfDay
        }));
        
        console.log(`[TrendAnalysis] Using individual entries for ${periodDays}-day period: ${(requestBody.entryMetadata as unknown[]).length} entries`);
      }
      
      const { data, error } = await invokeWithRetry(supabase, 'ai-analyze', {
        body: requestBody,
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: t('trendAnalysis.analysisFailed'),
          description: data.error,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Validate returned data is not fallback values
      if (!data || 
          data.periodSummary === "Unable to analyze trends" || 
          data.moodTrend === "Data unavailable" ||
          !data.insights || data.insights.length === 0) {
        console.error("Received invalid trend analysis data:", data);
        
        // Clear any bad cached data
        const cacheKey = await aiCacheService.getTrendCacheKey(filteredEntries);
        localStorage.removeItem(cacheKey);
        
        toast({
          title: t('trendAnalysis.analysisIncomplete'),
          description: t('trendAnalysis.analysisIncompleteDesc'),
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setAnalysis(data);
      setLastAnalyzed(new Date());
      setIsCollapsed(false); // AUTO-SHOW results after analysis
      setIsSelectingPeriod(false); // Return to insights view after analysis
      
      // Store the period that was actually analyzed
      setAnalyzedPeriodStart(startDate);
      setAnalyzedPeriodEnd(endDate);
      
      // Step 5: Save to both local cache and cloud storage (include period dates)
      setProgress({ step: 5, totalSteps: 5, currentAction: t('trendAnalysis.progress.savingAnalysis'), currentEntry: 0, totalEntries: 0 });
      await saveTrendAnalysis(data, startDate, endDate);
      
      aiUsageLimits.recordUsage('trendAnalysis');
      
      toast({
        title: t('trendAnalysis.analysisComplete'),
        description: t('trendAnalysis.analysisCompleteDesc'),
      });
    } catch (error: any) {
      console.error('Trend analysis error:', error);
      
      // Try to extract error details from FunctionsHttpError
      let errorMessage = '';
      try {
        if (error?.context?.json) {
          const responseBody = await error.context.json();
          errorMessage = responseBody?.error || '';
        } else {
          errorMessage = error?.message || '';
        }
      } catch {
        errorMessage = error?.message || '';
      }
      
      // Check if this is a rate limit error (429)
      if (errorMessage.includes('once per week') || 
          error?.message?.includes('429') ||
          error?.context?.status === 429) {
        // Sync localStorage to reflect the limit
        aiUsageLimits.markLimitReached('trendAnalysis');
        
        toast({
          title: t('trendAnalysis.weeklyLimitReached'),
          description: t('trendAnalysis.weeklyLimitDesc'),
          variant: "destructive",
        });
      } else {
        toast({
          title: t('trendAnalysis.analysisFailed'),
          description: errorMessage || t('trendAnalysis.analysisFailedDesc'),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      setAnalyzingCount(0);
      setProgress({ step: 0, totalSteps: 5, currentAction: '', currentEntry: 0, totalEntries: 0 });
    }
  };

  const timeUntilNextAnalysis = () => {
    const limitCheck = aiUsageLimits.canUseFeature('trendAnalysis');
    if (limitCheck.allowed) return null;
    // Show weekly limit message
    return "weekly";
  };

  // On native (iOS/Android) free users, hide the trend analysis surface
  // entirely. The empty-state form shows a Crown icon + "Plus" toast on tap;
  // the results view (only reachable if the user had Plus previously) shows a
  // Crown re-analyze button. App stores flag both as references to a paid
  // tier without a corresponding in-app purchase.
  if (!isPro && !canShowAnyPurchaseCTA()) return null;

  // Shown in both the setup and the results state while an analysis runs.
  const progressPanel = loading && (
    <div className="max-w-2xl space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span className="font-medium text-foreground">{progress.currentAction}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {t('trendAnalysis.progress.step', { current: progress.step, total: progress.totalSteps })}
        </span>
      </div>
      <Progress value={(progress.step / progress.totalSteps) * 100} className="h-1.5" />
      {progress.totalEntries > 0 && (
        <div className="text-center text-xs tabular-nums text-muted-foreground">
          {t('trendAnalysis.progress.entryProgress', { current: progress.currentEntry, total: progress.totalEntries })}
        </div>
      )}
      <div className="notice notice-warning">
        <AlertTriangle aria-hidden="true" />
        <span>{t('trendAnalysis.progress.doNotCloseApp')}</span>
      </div>
    </div>
  );

  if (!analysis || isSelectingPeriod) {
    return (
      <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-soft">
        <Collapsible open={!isSetupCollapsed} onOpenChange={(open) => setIsSetupCollapsed(!open)}>
          {/* Compact header matching the sibling insight cards (MoodCalendar /
              MoodStats / MoodCorrelations). A clickable div rather than a
              CollapsibleTrigger button because it hosts the nested
              "Back to insights" button. */}
          <div
            className="w-full p-3 sm:p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setIsSetupCollapsed(!isSetupCollapsed)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp aria-hidden="true" className="w-5 h-5 text-primary flex-shrink-0" />
              <h3 className="text-sm font-medium sm:text-base">{t('trendAnalysis.title')}</h3>
              {!isPro && <Crown aria-hidden="true" className="w-4 h-4 text-seal flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {analysis && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSelectingPeriod(false);
                  }}
                  size="sm"
                  variant="outline"
                >
                  {t('trendAnalysis.backToInsights')}
                </Button>
              )}
              <ChevronDown aria-hidden="true" className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0",
                !isSetupCollapsed && "rotate-180"
              )} />
            </div>
          </div>

          <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
            <div className="space-y-4 px-3 pb-4 sm:px-4 sm:pb-5">
              {/* Description above the action bar at every width. A side-by-side
                  split keyed to the viewport broke when the card sat in a narrow
                  column on a wide screen: the fixed-width controls crushed the
                  description to one word per line. */}
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  {t('trendAnalysis.description')}
                </p>

                {/* Action bar — dropdown and Analyze button; wraps when the card is narrow */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <PeriodSelect value={dateRangePreset} onChange={setDateRangePreset} />

                  <Button
                    onClick={handleAnalyze}
                    disabled={loading || !canAnalyze() || !isPro || filteredEntries.length < 8}
                    size="sm"
                    className="min-h-11 h-auto min-w-[10rem] flex-1"
                    variant={isPro ? "default" : "outline"}
                  >
                    {loading ? (
                      <>
                        <Loader2 aria-hidden="true" className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                        <span>{t('trendAnalysis.analyzing')}</span>
                      </>
                    ) : isPro ? (
                      <>
                        <TrendingUp aria-hidden="true" className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>{t('trendAnalysis.analyzePeriod')}</span>
                      </>
                    ) : (
                      <>
                        <Crown aria-hidden="true" className="w-4 h-4 mr-2 flex-shrink-0 text-seal" />
                        <span>{t('trendAnalysis.analyzePeriod')}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Meta row — entries count, need-8 hint, and weekly availability.
                  Full card width so long status text wraps under the header. */}
              <div role="list" className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
                <span role="listitem" className="inline-flex items-center gap-2">
                  <FileText aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{t('trendAnalysis.entriesInPeriod', { count: filteredEntries.length })}</span>
                </span>
                {filteredEntries.length < 8 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span role="listitem">{t('trendAnalysis.need8')}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                {!canAnalyze() ? (
                  <span role="listitem" className="font-medium text-diagnostic-warning">{t('trendAnalysis.limitMessage')}</span>
                ) : (
                  <span role="listitem">{t('trendAnalysis.availableOnceWeek')}</span>
                )}
              </div>

              {/* Custom Date Range Pickers */}
              {dateRangePreset === "custom" && (
                <CustomPeriodPicker
                  start={customStartDate}
                  end={customEndDate}
                  onStartChange={setCustomStartDate}
                  onEndChange={setCustomEndDate}
                />
              )}

              {progressPanel}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border bg-card shadow-soft">
      <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
        {/* Same header as the setup state and the sibling insight cards. */}
        <div
          className="w-full p-3 sm:p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <TrendingUp aria-hidden="true" className="w-5 h-5 text-primary flex-shrink-0" />
            <h3 className="text-sm font-medium sm:text-base">{t('trendAnalysis.yourInsights')}</h3>
          </div>
          <ChevronDown aria-hidden="true" className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0",
            !isCollapsed && "rotate-180"
          )} />
        </div>

        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <div className="space-y-4 px-3 pb-5 sm:px-4 sm:pb-6">
            {/* The period that was actually analysed, not the current selection. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarIcon aria-hidden="true" className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {format(analyzedPeriodStart || startDate, "MMM d, yyyy", { locale: dateLocale })} – {format(analyzedPeriodEnd || endDate, "MMM d, yyyy", { locale: dateLocale })}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{t('trendAnalysis.entriesAnalyzed', { count: filteredEntries.length })}</span>
              {lastAnalyzed && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{t('trendAnalysis.analyzedAt', { date: format(lastAnalyzed, "PPp", { locale: dateLocale }) })}</span>
                </>
              )}
              {!canAnalyze() && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-diagnostic-warning">{t('trendAnalysis.limitMessage')}</span>
                </>
              )}
            </div>

            {/* Action bar; wraps when the card sits in a narrow column. */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button
                onClick={handleAnalyze}
                disabled={loading || !canAnalyze() || !isPro}
                size="sm"
                variant="outline"
                title={!isPro ? t('trendAnalysis.proRequired') : !canAnalyze() ? t('trendAnalysis.availableOnceWeek') : t('trendAnalysis.reAnalyze')}
                className="min-h-10 h-auto min-w-[9rem] flex-1 sm:flex-none"
              >
                {loading ? (
                  <>
                    <Loader2 aria-hidden="true" className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                    <span>{t('trendAnalysis.analyzing', { count: filteredEntries.length })}</span>
                  </>
                ) : !isPro ? (
                  <>
                    <Crown aria-hidden="true" className="w-4 h-4 mr-2 flex-shrink-0 text-seal" />
                    <span>{t('trendAnalysis.analyzePeriod')}</span>
                  </>
                ) : (
                  <>
                    <TrendingUp aria-hidden="true" className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span>{t('trendAnalysis.analyzePeriod')}</span>
                  </>
                )}
              </Button>
              <Button
                onClick={() => setIsSelectingPeriod(true)}
                size="sm"
                variant="ghost"
                title={t('trendAnalysis.selectDifferentPeriod')}
                className="min-h-10 h-auto min-w-[9rem] flex-1 sm:flex-none"
              >
                <CalendarIcon aria-hidden="true" className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{t('trendAnalysis.changePeriod')}</span>
              </Button>
            </div>

            {progressPanel}

            {/* The report reads as one piece of writing: titled sections
                separated by hairlines, no boxes. */}
            <article className="divide-y divide-border border-t border-border">
              <section className="space-y-2 py-5">
                <h4 className="text-xl font-semibold">{t('trendAnalysis.periodSummary')}</h4>
                <p className="reading">{analysis.periodSummary}</p>
              </section>

              <section className="space-y-2 py-5">
                <h4 className="text-xl font-semibold">{t('trendAnalysis.moodTrend')}</h4>
                <p className="reading">{analysis.moodTrend}</p>
              </section>

              {analysis.insights.length > 0 && (
                <section className="space-y-3 py-5">
                  <h4 className="text-xl font-semibold">{t('trendAnalysis.keyInsights')}</h4>
                  <ul className="reading space-y-3">
                    {analysis.insights.map((insight, index) => (
                      <li key={index} className="flex gap-3">
                        <span aria-hidden="true" className="text-muted-foreground">•</span>
                        <span className="min-w-0">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {analysis.focusAreas.length > 0 && (
                <Collapsible open={focusAreasOpen} onOpenChange={setFocusAreasOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex min-h-[52px] w-full items-center justify-between gap-2 text-left transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="text-xl font-semibold">{t('trendAnalysis.suggestedFocusAreas')}</span>
                      <ChevronDown aria-hidden="true" className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0",
                        focusAreasOpen && "rotate-180"
                      )} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                    <div className="flex flex-wrap gap-2 pb-5">
                      {analysis.focusAreas.map((area, index) => (
                        <Badge key={index} variant="outline" className="px-3 py-1 text-sm font-normal">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {analysis.closingReflection && (
                <Collapsible open={reflectionOpen} onOpenChange={setReflectionOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex min-h-[52px] w-full items-center justify-between gap-2 text-left transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="text-xl font-semibold">{t('trendAnalysis.reflection')}</span>
                      <ChevronDown aria-hidden="true" className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0",
                        reflectionOpen && "rotate-180"
                      )} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                    <p className="reading mb-5 border-l-2 border-seal/60 pl-4 italic">
                      {analysis.closingReflection}
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </article>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
