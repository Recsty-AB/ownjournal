import { useState, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Crown, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithRetry } from "@/utils/edgeFunctionRetry";
import { useToast } from "@/hooks/use-toast";
import { aiMetadataService } from "@/services/aiMetadataService";
import type { EntryAIMetadata } from "@/types/aiMetadata";
import { aiUsageLimits } from "@/services/aiUsageLimits";
import { useTranslation } from "react-i18next";
import { storageServiceV2 } from "@/services/storageServiceV2";
import { getMockAnalysis } from "@/demo/mockAIResponses";

// Helper to detect if metadata indicates a failed analysis
const isFailedAnalysis = (metadata: EntryAIMetadata | null): boolean => {
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
    return true;
  }
  
  // Detect default/placeholder metadata indicating failed extraction
  // This catches old fallback metadata that used neutral defaults
  const hasDefaultValues = 
    metadata.sentimentScore === 0 &&
    metadata.dominantEmotion === 'neutral' &&
    (summary === '' || summary.length < 10);
  
  if (hasDefaultValues) {
    return true;
  }
  
  return false;
};

interface AIAnalysisProps {
  entryId: string;
  content: string;
  createdAt: Date;
  tags?: string[];
  mood?: string;
  isPro: boolean;
  isDemo?: boolean;
  onApplyTags?: (tags: string[]) => void;
}

export const AIAnalysis = ({ entryId, content, createdAt, tags, mood, isPro, isDemo = false, onApplyTags }: AIAnalysisProps) => {
  const [metadata, setMetadata] = useState<EntryAIMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed when loaded from storage
  const { toast } = useToast();
  const lastCallTimeRef = useRef<number>(0);
  const prevEntryIdRef = useRef<string | null>(null);
  const { i18n, t } = useTranslation();

  // Detect if content has changed since last analysis
  const hasContentChanged = useMemo(() => {
    if (!metadata) return true; // No analysis yet, allow analysis
    
    const currentLength = content.trim().length;
    
    // If analyzedContentLength is set, use it for precise comparison
    if (metadata.analyzedContentLength !== undefined) {
      return currentLength !== metadata.analyzedContentLength;
    }
    
    // Legacy metadata without analyzedContentLength:
    // Estimate original length from wordCount (avg ~5 chars/word for English)
    // For Japanese/CJK text, wordCount is unreliable (no spaces), so be generous
    if (metadata.wordCount !== undefined) {
      // Use a tolerance of 20% to account for estimation errors
      const estimatedLength = metadata.wordCount * 5;
      const tolerance = Math.max(10, estimatedLength * 0.2);
      const difference = Math.abs(currentLength - estimatedLength);
      
      // If difference is significant (more than tolerance), content has changed
      return difference > tolerance;
    }
    
    // No tracking data at all - allow re-analysis
    return true;
  }, [metadata, content]);

  // Load existing metadata on mount AND when entryId changes (e.g., after trend analysis)
  useEffect(() => {
    const loadMetadata = async () => {
      setInitialLoading(true);
      
      // Clear previous metadata when switching entries
      if (prevEntryIdRef.current !== entryId) {
        setMetadata(null);
        prevEntryIdRef.current = entryId;
      }
      
      // First check local cache
      let existingMetadata = await aiMetadataService.getMetadata(entryId);
      
      // If not in local cache, try to load the entry which will restore metadata from cloud
      if (!existingMetadata) {
        try {
          await storageServiceV2.getEntry(entryId);
          // After loading entry, check cache again (metadata restored in decryptEntry)
          existingMetadata = await aiMetadataService.getMetadata(entryId);
        } catch (err) {
          if (import.meta.env.DEV) console.warn('Failed to load entry for AI metadata:', err);
        }
      }
      
      if (existingMetadata) {
        setMetadata(existingMetadata);
      }
      
      setInitialLoading(false);
    };
    loadMetadata();
  }, [entryId]);

  const handleAnalyze = async () => {
    // Demo mode: use mock responses
    if (isDemo) {
      setLoading(true);
      // Simulate network delay for realism
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockResult = getMockAnalysis(entryId);
      const mockMetadata: EntryAIMetadata = {
        metaVersion: 1,
        shortSummary: mockResult.insights,
        dominantEmotion: mockResult.mood,
        emotions: mockResult.themes.slice(0, 3),
        topics: mockResult.themes,
        keywords: mockResult.themes.slice(0, 2),
        peopleMentioned: [],
        sentimentScore: 0.7,
        timeOfDay: 'morning',
        lengthCategory: 'medium',
        wordCount: content.trim().split(/\s+/).length,
        analyzedContentLength: content.trim().length,
        analyzedAt: new Date().toISOString(),
        suggestedTags: mockResult.suggestions
      } as EntryAIMetadata;
      setMetadata(mockMetadata);
      setIsCollapsed(false);
      setLoading(false);
      toast({
        title: t('ai.analysisComplete'),
        description: t('ai.analysisCompleteDesc'),
      });
      return;
    }

    // Check Pro status first
    if (!isPro) {
      toast({
        title: t('journalEntry.proFeature'),
        description: t('ai.proSubscriptionRequired'),
        variant: "destructive",
      });
      return;
    }

    // Allow re-analysis if the existing metadata shows a failure
    const shouldForceReanalyze = isFailedAnalysis(metadata);

    // If content hasn't changed AND analysis didn't fail, just show existing metadata
    if (metadata && !hasContentChanged && !shouldForceReanalyze) {
      setIsCollapsed(false);
      toast({
        title: t('ai.analysisLoaded'),
        description: t('ai.editToReanalyze'),
      });
      return;
    }

    // Check word limit
    const wordCheck = aiUsageLimits.checkWordLimit(content);
    if (!wordCheck.allowed) {
      toast({
        title: t('ai.contentTooLong'),
        description: t('ai.contentTooLongDesc', { wordCount: wordCheck.wordCount, limit: wordCheck.limit }),
        variant: "destructive",
      });
      return;
    }

    // Skip usage limit check if we're retrying a failed analysis
    // The backend will handle forceReanalyze correctly
    if (!shouldForceReanalyze) {
      const limitCheck = aiUsageLimits.canUseFeature('entryAnalysis', entryId);
      if (!limitCheck.allowed) {
        toast({
          title: t('ai.limitReached'),
          description: limitCheck.reason,
          variant: "destructive",
        });
        return;
      }
    }

    // Rate limiting: enforce 500ms minimum between calls
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;
    if (timeSinceLastCall < 500) {
      toast({
        title: t('ai.tooFast'),
        description: t('ai.tooFastDesc'),
        variant: "destructive",
      });
      return;
    }
    lastCallTimeRef.current = now;

    if (content.trim().length < 50) {
      toast({
        title: t('ai.entryTooShort'),
        description: t('ai.entryTooShortDesc'),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: t('auth.required'),
          description: t('ai.authRequiredDesc'),
          variant: "destructive",
        });
        return;
      }

      // Allow re-analysis if the existing metadata shows a failure
      const shouldForceReanalyze = isFailedAnalysis(metadata);

      // Call backend to analyze entry and get metadata
      const { data, error } = await invokeWithRetry(supabase, 'ai-analyze', {
        body: { 
          type: 'analyzeEntry',
          entryId, 
          content,
          createdAt: createdAt.toISOString(),
          tags,
          mood,
          forceReanalyze: shouldForceReanalyze
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: t('ai.analysisFailed'),
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      // Save metadata with analyzed content length for change tracking
      const metadataWithLength = {
        ...data,
        analyzedContentLength: content.trim().length
      };
      await aiMetadataService.setMetadata(entryId, metadataWithLength);
      setMetadata(metadataWithLength);
      setIsCollapsed(false); // AUTO-SHOW results after analysis
      aiUsageLimits.recordUsage('entryAnalysis', entryId);
      
      // Trigger entry save to sync AI metadata cross-device
      try {
        const entry = await storageServiceV2.getEntry(entryId);
        if (entry) {
          await storageServiceV2.saveEntry(entry);
        }
      } catch (saveError) {
        if (import.meta.env.DEV) console.warn('Failed to sync AI metadata to cloud:', saveError);
        // Don't fail the analysis if sync fails
      }
      
      toast({
        title: t('ai.analysisComplete'),
        description: t('ai.analysisCompleteDesc'),
      });
    } catch (error: any) {
      console.error('AI analysis error:', error);
      
      // Try to parse the response body for more details
      let errorMessage = '';
      let isAlreadyAnalyzed = false;
      
      try {
        if (error?.context?.json) {
          const responseBody = await error.context.json();
          errorMessage = responseBody?.error || '';
          isAlreadyAnalyzed = responseBody?.alreadyAnalyzed === true;
        } else if (error?.message) {
          const jsonMatch = error.message.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            errorMessage = parsed?.error || '';
            isAlreadyAnalyzed = parsed?.alreadyAnalyzed === true;
          } else {
            errorMessage = error.message;
          }
        }
      } catch {
        errorMessage = error?.message || '';
      }
      
      // Check for duplicate entry error (alreadyAnalyzed flag or message)
      if (isAlreadyAnalyzed || 
          errorMessage.includes('already been analyzed') || 
          errorMessage.includes('already analyzed')) {
        toast({
          title: t('ai.alreadyAnalyzed'),
          description: t('ai.alreadyAnalyzedDesc'),
        });
        // Try to load existing metadata
        const existingMetadata = await aiMetadataService.getMetadata(entryId);
        if (existingMetadata) {
          setMetadata(existingMetadata);
          setIsCollapsed(false);
        }
        return;
      }
      
      // Reactive 429 handling for actual rate limits (not alreadyAnalyzed)
      if ((error?.message?.includes('429') || error?.context?.status === 429) && !isAlreadyAnalyzed) {
        // Check if it's a real monthly limit message
        if (errorMessage.includes('monthly limit') || errorMessage.includes('reached')) {
          aiUsageLimits.markLimitReached('entryAnalysis');
          toast({
            title: t('ai.monthlyLimitReached'),
            description: t('ai.monthlyLimitReachedDesc'),
            variant: "destructive",
          });
          return;
        }
      }
      
      toast({
        title: t('ai.analysisFailed'),
        description: t('ai.analysisFailedDesc'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSentimentLabel = (score: number, t: (key: string) => string): string => {
    if (score > 0.5) return t('ai.veryPositive');
    if (score > 0.15) return t('ai.positive');
    if (score >= -0.15) return t('ai.mixed');
    if (score >= -0.5) return t('ai.negative');
    return t('ai.veryNegative');
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.5) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (score > 0.15) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= -0.15) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (score >= -0.5) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const formatMetaLine = (timeOfDay: string, lengthCategory: string, t: (key: string) => string): string => {
    const timeLabel = t(`ai.${timeOfDay}`);
    return `${timeLabel} ${t('ai.entry')} · ${t(`ai.${lengthCategory}`)} ${t('ai.length')}`;
  };

  // Determine if this is a failed analysis that can be retried
  const canRetry = isFailedAnalysis(metadata);

  if (!metadata) {
    return (
      <Card className="p-3 sm:p-4 bg-gradient-subtle border-primary/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap">{t('ai.analysis')}</span>
            {!isPro && <Crown className="w-4 h-4 text-primary flex-shrink-0" />}
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={loading || !isPro || initialLoading}
            size="sm"
            variant={isPro ? "default" : "outline"}
            className="w-full sm:w-auto"
          >
            {initialLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('ai.loading')}
              </>
            ) : loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('ai.analyzing')}
              </>
            ) : !isPro ? (
              <>
                <Crown className="w-4 h-4 mr-2" />
                {t('ai.analyzeEntry')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {t('ai.analyzeEntry')}
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  const sentiment = getSentimentLabel(metadata.sentimentScore, t);

  return (
    <Card className="p-3 sm:p-4 space-y-4 bg-gradient-subtle">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
          <h4 className="font-semibold whitespace-nowrap">{t('ai.analysis')}</h4>
          <Badge variant="outline" className="text-xs">
            {new Date(metadata.analyzedAt).toLocaleDateString()}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsCollapsed(!isCollapsed)}
            size="sm"
            variant="ghost"
            className="flex-1 sm:flex-none"
          >
            {isCollapsed ? t('ai.show') : t('ai.hide')}
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={loading || (!hasContentChanged && !canRetry)}
            size="sm"
            variant={hasContentChanged || canRetry ? "default" : "outline"}
            title={canRetry ? t('ai.retryAnalysis') : !hasContentChanged ? t('ai.editToReanalyze') : t('ai.reanalyzeWithChanges')}
            className="flex-1 sm:flex-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="truncate">{t('ai.analyzing')}</span>
              </>
            ) : canRetry ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">{t('ai.retryAnalysis')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">{t('ai.analyzeEntry')}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              {t('ai.summary')}
            </div>
            <p className="text-sm text-muted-foreground bg-background/50 p-3 rounded-md">
              {metadata.shortSummary}
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">
              {t('ai.moodSnapshot')}
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {t('ai.overallTone')}: <span className="font-medium text-foreground">{sentiment}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('ai.dominantEmotion')}:</span>
                <Badge variant="secondary">{metadata.dominantEmotion}</Badge>
              </div>
            </div>
          </div>

          {metadata.emotions.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {t('ai.emotionsPresent')}
              </div>
              <div className="flex flex-wrap gap-2">
                {metadata.emotions.slice(0, 5).map((emotion, i) => (
                  <Badge key={i} variant="outline">{emotion}</Badge>
                ))}
              </div>
            </div>
          )}

          {metadata.topics.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {t('ai.keyThemes')}
              </div>
              <div className="flex flex-wrap gap-2">
                {metadata.topics.slice(0, 5).map((topic, index) => (
                  <Badge key={index} variant="outline">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {metadata.peopleMentioned.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {t('ai.peopleMentioned')}
              </div>
              <div className="flex flex-wrap gap-2">
                {metadata.peopleMentioned.map((person, index) => (
                  <Badge key={index} variant="secondary">
                    {person}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-2 border-t">
            {formatMetaLine(metadata.timeOfDay, metadata.lengthCategory, t)}
          </div>
        </>
      )}
    </Card>
  );
};
