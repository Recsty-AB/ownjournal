import { useState, useEffect, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Loader2, Lightbulb, Heart, Target, Clock, Crown, ChevronDown, Calendar as CalendarIcon, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, subDays, startOfYear, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithRetry } from "@/utils/edgeFunctionRetry";
import { useToast } from "@/hooks/use-toast";
import type { JournalEntryData } from "./JournalEntry";
import { aiMetadataService } from "@/services/aiMetadataService";
import type { EntryAIMetadata, AggregatedMetadata } from "@/types/aiMetadata";
import { aiUsageLimits } from "@/services/aiUsageLimits";
import { useTranslation } from "react-i18next";
import { aiCacheService } from "@/services/aiCacheService";
import { cloudStorageService } from "@/services/cloudStorageService";
import { storageServiceV2 } from "@/services/storageServiceV2";
import { encryptData, decryptData, arrayBufferToBase64, base64ToArrayBuffer } from "@/utils/encryption";
import { getMockTrendAnalysis } from "@/demo/mockAIResponses";
import { computeTimeBuckets, shouldUseTimeBuckets, type EntryWithDateAndMetadata } from "@/utils/timeBucketAggregation";
import { getDateLocale } from "@/utils/dateLocale";

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

type DateRangePreset = "last30days" | "last90days" | "thisYear" | "custom";

const DATE_RANGE_OPTIONS = [
  { value: "last30days" as const, label: "trendAnalysis.last30days" },
  { value: "last90days" as const, label: "trendAnalysis.last90days" },
  { value: "thisYear" as const, label: "trendAnalysis.thisYear" },
  { value: "custom" as const, label: "trendAnalysis.customRange" },
];

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
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("last30days");
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
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (dateRangePreset) {
      case "last30days":
        start = subDays(now, 30);
        break;
      case "last90days":
        start = subDays(now, 90);
        break;
      case "thisYear":
        start = startOfYear(now);
        break;
      case "custom":
        if (customStartDate && customEndDate) {
          start = startOfDay(customStartDate);
          end = endOfDay(customEndDate);
        } else {
          // Default to last 30 days if custom dates not set
          start = subDays(now, 30);
        }
        break;
      default:
        start = subDays(now, 30);
    }

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

  const loadedForEntriesRef = useRef<string>('');

  // Load cached trend analysis from cloud and local storage
  useEffect(() => {
    const loadCachedAnalysis = async () => {
      if (filteredEntries.length < 8) return;

      // Build a fingerprint of current entries to detect meaningful changes
      const entriesFingerprint = filteredEntries.map(e => e.id).sort().join(',');
      if (loadedForEntriesRef.current === entriesFingerprint) return;
      loadedForEntriesRef.current = entriesFingerprint;
      
      try {
        // Generate cache key based on entry IDs
        const cacheKey = await aiCacheService.getTrendCacheKey(filteredEntries);
        
        // Load from local cache first (fast)
        const localCached = await aiCacheService.getCached(cacheKey, 'trendAnalysis');
        
        // Try to load from cloud (may be more recent)
        let cloudCached: CloudTrendData | null = null;
        const masterKey = storageServiceV2.getMasterKey();
        if (masterKey && cloudStorageService.getConnectedProviderNames().length > 0) {
          try {
            // Try to download directly - handle errors gracefully (404, 412, etc.)
            const cloudData = await cloudStorageService.downloadFromPrimary('/analysis/trend_analysis.json.enc');
            if (cloudData) {
              // Decrypt and parse
              const encryptedParts = JSON.parse(cloudData);
              const decrypted = await decryptData(
                base64ToArrayBuffer(encryptedParts.data),
                masterKey,
                base64ToArrayBuffer(encryptedParts.iv)
              );
              cloudCached = JSON.parse(decrypted);
            }
          } catch (error) {
            // File doesn't exist or failed to load - this is normal for new storage
            if (import.meta.env.DEV) console.log('No cloud trend analysis found:', error);
          }
        }
        
        // Use whichever is more recent
        let selectedAnalysis: TrendData | null = null;
        let selectedTimestamp: number | null = null;
        let selectedPeriodStart: string | null = null;
        let selectedPeriodEnd: string | null = null;
        
        if (cloudCached && cloudCached.analysis) {
          selectedAnalysis = cloudCached.analysis;
          selectedTimestamp = cloudCached.timestamp;
          selectedPeriodStart = cloudCached.periodStart || null;
          selectedPeriodEnd = cloudCached.periodEnd || null;
        }
        
        if (localCached) {
          const localTimestamp = localCached.timestamp || 0;
          if (!selectedTimestamp || localTimestamp > selectedTimestamp) {
            selectedAnalysis = localCached.analysis || localCached;
            selectedTimestamp = localTimestamp;
            selectedPeriodStart = localCached.periodStart || null;
            selectedPeriodEnd = localCached.periodEnd || null;
          }
        }
        
        if (selectedAnalysis) {
          setAnalysis(selectedAnalysis);
          // Restore the period that was actually analyzed
          if (selectedPeriodStart) {
            setAnalyzedPeriodStart(new Date(selectedPeriodStart));
          }
          if (selectedPeriodEnd) {
            setAnalyzedPeriodEnd(new Date(selectedPeriodEnd));
          }
          if (selectedTimestamp) {
            setLastAnalyzed(new Date(selectedTimestamp));
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to load cached analysis:', error);
      }
    };
    
    loadCachedAnalysis();
  }, [filteredEntries]);

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
      
      // Save to cloud storage (encrypted)
      const masterKey = storageServiceV2.getMasterKey();
      if (masterKey && cloudStorageService.getConnectedProviderNames().length > 0) {
        const cloudData: CloudTrendData = {
          version: 1,
          timestamp,
          entryIds,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          analysis: analysisData
        };
        
        // Encrypt before uploading
        const { encrypted, iv } = await encryptData(JSON.stringify(cloudData), masterKey);
        const encryptedPackage = JSON.stringify({
          data: arrayBufferToBase64(encrypted),
          iv: arrayBufferToBase64(iv)
        });
        
        await cloudStorageService.uploadToAll('/analysis/trend_analysis.json.enc', encryptedPackage);
        
        if (import.meta.env.DEV) console.log('✅ Trend analysis saved to cloud');
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to save trend analysis:', error);
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
      const entriesWithMetadata: Array<{ entry: JournalEntryData; metadata: EntryAIMetadata | null }> = [];
      
      for (const entry of filteredEntries) {
        const metadata = await aiMetadataService.getMetadata(entry.id);
        entriesWithMetadata.push({ entry, metadata });
      }

      // Step 2: Analyze missing OR failed entries
      // Helper to detect failed analysis metadata
      const isFailedMetadata = (metadata: EntryAIMetadata | null): boolean => {
        if (!metadata) return false;
        
        const summary = metadata.shortSummary?.toLowerCase().trim() || '';
        
        // Check for explicit failure indicators in multiple languages
        const failureIndicators = [
          'could not analyze',
          'analysis failed',
          'error analyzing',
          'failed to analyze',
          'unable to analyze',
          'cannot analyze',
          // Japanese failure indicators
          '分析できませんでした',
          '分析に失敗',
          '分析エラー',
        ];
        
        if (failureIndicators.some(indicator => summary.includes(indicator))) {
          console.log(`[isFailedMetadata] Detected failure indicator in summary: "${metadata.shortSummary}"`);
          return true;
        }
        
        // Detect default/placeholder metadata indicating failed extraction
        // This catches old fallback metadata that used neutral defaults
        const hasDefaultValues = 
          metadata.sentimentScore === 0 &&
          metadata.dominantEmotion === 'neutral' &&
          (summary === '' || summary.length < 10);
        
        if (hasDefaultValues) {
          console.log(`[isFailedMetadata] Detected default values indicating failure: sentiment=0, emotion=neutral, summary="${metadata.shortSummary}"`);
          return true;
        }
        
        return false;
      };
      
      const missingEntries = entriesWithMetadata.filter(e => !e.metadata || isFailedMetadata(e.metadata));
      
      if (missingEntries.length > 0) {
        setAnalyzingCount(missingEntries.length);
        setProgress({ step: 2, totalSteps: 5, currentAction: t('trendAnalysis.progress.analyzingEntry', { current: 0, total: missingEntries.length }), currentEntry: 0, totalEntries: missingEntries.length });
        toast({
          title: t('trendAnalysis.analyzingEntries'),
          description: t('trendAnalysis.analyzingEntriesDesc', { count: missingEntries.length }),
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

        // Analyze missing entries in parallel batches of 4 for speed
        const PARALLEL_BATCH_SIZE = 4;
        let processedCount = 0;

        for (let i = 0; i < missingEntries.length; i += PARALLEL_BATCH_SIZE) {
          const batch = missingEntries.slice(i, i + PARALLEL_BATCH_SIZE);
          const batchEndIndex = Math.min(i + PARALLEL_BATCH_SIZE, missingEntries.length);
          
          setProgress({ 
            step: 2, 
            totalSteps: 5, 
            currentAction: t('trendAnalysis.progress.analyzingEntry', { 
              current: `${i + 1}-${batchEndIndex}`, 
              total: missingEntries.length 
            }), 
            currentEntry: batchEndIndex, 
            totalEntries: missingEntries.length 
          });
          
          // Process batch in parallel
          const batchResults = await Promise.allSettled(
            batch.map(async ({ entry, metadata }) => {
              // If this entry had failed metadata, clear it before retry
              if (metadata && isFailedMetadata(metadata)) {
                await aiMetadataService.deleteMetadata(entry.id);
              }
              
              const { data, error } = await supabase.functions.invoke('ai-analyze', {
                body: { 
                  type: 'analyzeEntry',
                  entryId: entry.id, 
                  content: entry.body,
                  createdAt: entry.createdAt.toISOString(),
                  tags: entry.tags,
                  mood: entry.mood,
                  forceReanalyze: metadata ? isFailedMetadata(metadata) : false,
                  batchContext: {
                    isTrendBatch: true,
                    entryCount: missingEntries.length
                  }
                },
                headers: {
                  Authorization: `Bearer ${session.access_token}`
                }
              });
              
              if (error) throw error;
              return { entryId: entry.id, data };
            })
          );
          
          // Process results from this batch and collect failed entries for retry
          const failedInBatch: typeof batch = [];
          
          for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            if (result.status === 'fulfilled' && result.value.data) {
              // Find the original entry to include analyzedContentLength
              const originalEntry = batch.find(b => b.entry.id === result.value.entryId);
              const metadataWithLength = {
                ...result.value.data,
                analyzedContentLength: originalEntry?.entry.body?.trim().length || 0
              };
              
              await aiMetadataService.setMetadata(result.value.entryId, metadataWithLength);
              const index = entriesWithMetadata.findIndex(e => e.entry.id === result.value.entryId);
              if (index !== -1) {
                entriesWithMetadata[index].metadata = metadataWithLength;
              }
              processedCount++;
            } else if (result.status === 'rejected') {
              console.error('Failed to analyze entry in batch, will retry:', result.reason);
              // Clear any existing failed metadata so this entry will be picked up next run
              if (batch[j]) {
                await aiMetadataService.deleteMetadata(batch[j].entry.id);
                failedInBatch.push(batch[j]);
              }
            }
          }
          
          // Retry failed entries from this batch (one attempt each with delay)
          if (failedInBatch.length > 0) {
            console.log(`[RETRY] Retrying ${failedInBatch.length} failed entries from batch`);
            
            for (const { entry } of failedInBatch) {
              try {
                // Small delay before retry to avoid rate limiting
                await new Promise(r => setTimeout(r, 800));
                
                setProgress({ 
                  step: 2, 
                  totalSteps: 5, 
                  currentAction: t('trendAnalysis.progress.retrying', { defaultValue: 'Retrying...' }), 
                  currentEntry: processedCount, 
                  totalEntries: missingEntries.length 
                });
                
                const { data, error } = await supabase.functions.invoke('ai-analyze', {
                  body: { 
                    type: 'analyzeEntry',
                    entryId: entry.id, 
                    content: entry.body,
                    createdAt: entry.createdAt.toISOString(),
                    tags: entry.tags,
                    mood: entry.mood,
                    forceReanalyze: true, // Force since it failed before
                    batchContext: { isTrendBatch: true, entryCount: missingEntries.length, isRetry: true }
                  },
                  headers: {
                    Authorization: `Bearer ${session.access_token}`
                  }
                });
                
                if (!error && data) {
                  const metadataWithLength = {
                    ...data,
                    analyzedContentLength: entry.body?.trim().length || 0
                  };
                  await aiMetadataService.setMetadata(entry.id, metadataWithLength);
                  const index = entriesWithMetadata.findIndex(e => e.entry.id === entry.id);
                  if (index !== -1) {
                    entriesWithMetadata[index].metadata = metadataWithLength;
                  }
                  processedCount++;
                  console.log(`[RETRY] Successfully analyzed entry ${entry.id} on retry`);
                } else {
                  console.error(`[RETRY] Entry ${entry.id} failed with error:`, error);
                }
              } catch (retryError) {
                console.error(`[RETRY] Entry ${entry.id} failed again:`, retryError);
                // Clear metadata so entry will be picked up on next trend analysis run
                await aiMetadataService.deleteMetadata(entry.id);
              }
            }
          }
        }
        
        // Sync analyzed entries to cloud for cross-device persistence
        // Update updatedAt timestamp to ensure other devices detect the metadata change
        if (processedCount > 0) {
          console.log(`[SYNC] Syncing ${processedCount} entries with new metadata to cloud`);
          
          for (const { entry, metadata } of entriesWithMetadata) {
            if (metadata && !isFailedMetadata(metadata)) {
              try {
                const fullEntry = await storageServiceV2.getEntry(entry.id);
                if (fullEntry) {
                  // Force timestamp update so other devices detect the metadata change
                  fullEntry.updatedAt = new Date();
                  await storageServiceV2.saveEntry(fullEntry);
                }
              } catch (syncError) {
                console.warn(`[SYNC] Failed to sync entry ${entry.id}:`, syncError);
              }
            }
          }
        }
      }

      // Step 3: Collect all VALID metadata (exclude failed analyses)
      const allMetadata = entriesWithMetadata
        .map(e => e.metadata)
        .filter((m): m is EntryAIMetadata => m !== null && !isFailedMetadata(m));

      // Track failed entries for logging
      const failedCount = entriesWithMetadata.filter(e => 
        e.metadata && isFailedMetadata(e.metadata)
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
          .filter(e => e.metadata && !isFailedMetadata(e.metadata))
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

  if (!analysis || isSelectingPeriod) {
    return (
      <Card className="p-6 bg-gradient-subtle border-primary/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              <h3 className="text-xl font-semibold">{t('trendAnalysis.title')}</h3>
            </div>
            {analysis && (
              <Button
                onClick={() => setIsSelectingPeriod(false)}
                size="sm"
                variant="outline"
              >
                {t('trendAnalysis.backToInsights')}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {t('trendAnalysis.description')}
          </p>
          
          {/* Date Range Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">{t('trendAnalysis.selectPeriod')}</label>
            <Select value={dateRangePreset} onValueChange={(value) => setDateRangePreset(value as DateRangePreset)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Custom Date Range Pickers */}
            {dateRangePreset === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t('trendAnalysis.startDate')}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !customStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStartDate ? format(customStartDate, "PPP", { locale: dateLocale }) : t('trendAnalysis.pickDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customStartDate}
                        onSelect={setCustomStartDate}
                        disabled={(date) => 
                          date > new Date() || (customEndDate && date > customEndDate)
                        }
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">{t('trendAnalysis.endDate')}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !customEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEndDate ? format(customEndDate, "PPP", { locale: dateLocale }) : t('trendAnalysis.pickDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customEndDate}
                        onSelect={setCustomEndDate}
                        disabled={(date) => 
                          date > new Date() || (customStartDate && date < customStartDate)
                        }
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            {!canAnalyze() ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">{t('trendAnalysis.limitMessage')}</span>
            ) : (
              <span>{t('trendAnalysis.availableOnceWeek')}</span>
            )}
          </div>
          
          {/* Show entry count for selected range */}
          <div className="text-sm text-muted-foreground bg-background/50 p-3 rounded-md">
            {t('trendAnalysis.entriesInPeriod', { count: filteredEntries.length })}
            {filteredEntries.length < 8 && ` (${t('trendAnalysis.need8')})`}
          </div>
          
          {/* Progress bar during analysis */}
          {loading && (
            <div className="space-y-3 bg-background/50 p-4 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{progress.currentAction}</span>
                <span className="text-muted-foreground">
                  {t('trendAnalysis.progress.step', { current: progress.step, total: progress.totalSteps })}
                </span>
              </div>
              <Progress value={(progress.step / progress.totalSteps) * 100} className="h-2" />
              {progress.totalEntries > 0 && (
                <div className="text-xs text-muted-foreground text-center">
                  {t('trendAnalysis.progress.entryProgress', { current: progress.currentEntry, total: progress.totalEntries })}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{t('trendAnalysis.progress.doNotCloseApp')}</span>
              </div>
            </div>
          )}
          
          <Button
            onClick={handleAnalyze}
            disabled={loading || !canAnalyze() || !isPro || filteredEntries.length < 8}
            className={isPro ? "bg-gradient-primary w-full" : "w-full whitespace-normal text-center h-auto min-h-10 py-2 break-words"}
            variant={isPro ? "default" : "outline"}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {progress.currentAction || t('trendAnalysis.analyzing')}
              </>
            ) : isPro ? (
              <>
                <TrendingUp className="w-4 h-4 mr-2" />
                {t('trendAnalysis.analyzePeriod')}
              </>
            ) : (
              <>
                <Crown className="w-4 h-4 mr-2" />
                {t('trendAnalysis.proFeatureDesc')}
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 space-y-6 bg-gradient-subtle">
      <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
        <div 
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer min-h-[44px]"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary flex-shrink-0" />
            <h3 className="text-lg sm:text-xl font-semibold">{t('trendAnalysis.yourInsights')}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleAnalyze();
              }}
              disabled={loading || !canAnalyze() || !isPro}
              size="sm"
              variant={canAnalyze() && isPro ? "default" : "outline"}
              title={!isPro ? t('trendAnalysis.proRequired') : !canAnalyze() ? t('trendAnalysis.availableOnceWeek') : t('trendAnalysis.reAnalyze')}
              className="flex-1 sm:flex-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" />
                  <span className="hidden sm:inline">{t('trendAnalysis.analyzing', { count: filteredEntries.length })}</span>
                </>
              ) : !isPro ? (
                <>
                  <Crown className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t('trendAnalysis.analyzePeriod')}</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t('trendAnalysis.analyzePeriod')}</span>
                </>
              )}
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setIsSelectingPeriod(true);
              }}
              size="sm"
              variant="outline"
              title={t('trendAnalysis.selectDifferentPeriod')}
              className="flex-1 sm:flex-none"
            >
              <CalendarIcon className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('trendAnalysis.changePeriod')}</span>
            </Button>
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground transition-transform duration-200 flex-shrink-0",
              !isCollapsed && "rotate-180"
            )} />
          </div>
        </div>

        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          {!canAnalyze() && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pb-2 pt-4 border-b">
              <Clock className="w-3 h-3" />
              <span>{t('trendAnalysis.limitMessage')}</span>
            </div>
          )}

          {/* Progress bar during re-analysis */}
          {loading && (
            <div className="space-y-3 bg-background/50 p-4 rounded-lg border border-primary/20 mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{progress.currentAction}</span>
                <span className="text-muted-foreground">
                  {t('trendAnalysis.progress.step', { current: progress.step, total: progress.totalSteps })}
                </span>
              </div>
              <Progress value={(progress.step / progress.totalSteps) * 100} className="h-2" />
              {progress.totalEntries > 0 && (
                <div className="text-xs text-muted-foreground text-center">
                  {t('trendAnalysis.progress.entryProgress', { current: progress.currentEntry, total: progress.totalEntries })}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-md">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{t('trendAnalysis.progress.doNotCloseApp')}</span>
              </div>
            </div>
          )}

          {/* Analysis Period Summary - show the actual period that was analyzed */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 text-xs text-muted-foreground pt-4 pb-2 border-b">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {format(analyzedPeriodStart || startDate, "MMM d, yyyy", { locale: dateLocale })} – {format(analyzedPeriodEnd || endDate, "MMM d, yyyy", { locale: dateLocale })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{t('trendAnalysis.entriesAnalyzed', { count: filteredEntries.length })}</span>
            </div>
            {lastAnalyzed && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{t('trendAnalysis.analyzedAt', { date: format(lastAnalyzed, "PPp", { locale: dateLocale }) })}</span>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Heart className="w-4 h-4 text-primary" />
                {t('trendAnalysis.periodSummary')}
              </div>
              <p className="text-sm bg-background/50 p-3 rounded-md">
                {analysis.periodSummary}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="w-4 h-4 text-primary" />
                {t('trendAnalysis.moodTrend')}
              </div>
              <p className="text-sm bg-background/50 p-3 rounded-md">
                {analysis.moodTrend}
              </p>
            </div>

            {analysis.insights.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  {t('trendAnalysis.keyInsights')}
                </div>
                <ul className="space-y-2">
                  {analysis.insights.map((insight, index) => (
                    <li key={index} className="text-sm bg-background/50 p-3 rounded-md">
                      • {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.focusAreas.length > 0 && (
              <Collapsible open={focusAreasOpen} onOpenChange={setFocusAreasOpen}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer min-h-[44px] hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Target className="w-4 h-4 text-primary" />
                      {t('trendAnalysis.suggestedFocusAreas')}
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-200",
                      focusAreasOpen && "rotate-180"
                    )} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                  <div className="flex flex-wrap gap-2 pt-2">
                    {analysis.focusAreas.map((area, index) => (
                      <Badge key={index} variant="secondary">
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
                  <div className="flex items-center justify-between cursor-pointer min-h-[44px] hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Heart className="w-4 h-4 text-primary" />
                      {t('trendAnalysis.reflection')}
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-200",
                      reflectionOpen && "rotate-180"
                    )} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                  <p className="text-sm bg-background/50 p-4 rounded-md italic leading-relaxed mt-2">
                    {analysis.closingReflection}
                  </p>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
