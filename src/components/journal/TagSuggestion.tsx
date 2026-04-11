import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Check, RefreshCw, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithRetry } from "@/utils/edgeFunctionRetry";
import { useToast } from "@/hooks/use-toast";
import { aiCacheService } from "@/services/aiCacheService";
import { localAI } from "@/services/localAI";
import { aiModeStorage } from "@/utils/aiModeStorage";
import { aiUsageLimits } from "@/services/aiUsageLimits";
import { useTranslation } from "react-i18next";

interface TagSuggestionProps {
  content: string;
  existingTags: string[];
  onApplyTags: (tags: string[]) => void;
  isPro: boolean;
  predefinedActivities?: string[];
  existingActivities?: string[];
  onApplyActivities?: (activities: string[]) => void;
  getActivityLabel?: (key: string) => string;
}

// Maximum tag sets generated per API call
const MAX_TAG_SETS = 20;

export const TagSuggestion = ({
  content,
  existingTags,
  onApplyTags,
  isPro,
  predefinedActivities,
  existingActivities,
  onApplyActivities,
  getActivityLabel,
}: TagSuggestionProps) => {
  const [loading, setLoading] = useState(false);
  const [allTagSets, setAllTagSets] = useState<string[][]>([]); // Array of tag sets
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [showingNext, setShowingNext] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestedActivities, setSuggestedActivities] = useState<string[]>([]);
  const { toast } = useToast();
  const lastCallTimeRef = useRef<number>(0);
  const mode = aiModeStorage.getMode();
  const { i18n, t } = useTranslation();

  // Clear suggestions when mode changes OR content changes (cancelled edit, new entry)
  useEffect(() => {
    setAllTagSets([]);
    setCurrentSetIndex(0);
    setShowSuggestion(false);
    setSuggestedActivities([]);
  }, [mode, content]);

  const generateTags = async (resetIndex = true, skipCache = false) => {
    // Check word limit
    const wordCheck = aiUsageLimits.checkWordLimit(content);
    if (!wordCheck.allowed) {
      toast({
        title: t('suggestions.contentTooLong'),
        description: t('suggestions.contentTooLongDescTags', { wordCount: wordCheck.wordCount, limit: wordCheck.limit }),
        variant: "destructive",
      });
      return;
    }

    // Check usage limit
    const limitCheck = aiUsageLimits.canUseFeature('tags');
    if (!limitCheck.allowed) {
      toast({
        title: t('suggestions.limitReached'),
        description: limitCheck.reason,
        variant: "destructive",
      });
      return;
    }

    // Rate limiting: enforce 500ms minimum between calls
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;
    if (timeSinceLastCall < 500) {
      toast({
        title: t('suggestions.tooFast'),
        description: t('suggestions.tooFastDesc'),
        variant: "destructive",
      });
      return;
    }
    lastCallTimeRef.current = now;

    // Match title generation minimum content length
    if (content.trim().length < 10) {
      toast({
        title: t('suggestions.contentTooShort'),
        description: t('suggestions.contentTooShortDescTags'),
        variant: "destructive",
      });
      return;
    }

    // Check cache only if not skipping - include mode in cache key
    if (!skipCache) {
      const cacheKey = `${mode}_${content.substring(0, 500)}`;
      const cached = await aiCacheService.getCached(cacheKey, 'tags');
      if (cached?.tagSets && Array.isArray(cached.tagSets)) {
        // Re-filter against current existingTags (may have changed since cache)
        const existingTagSet = new Set(existingTags);
        const refilteredTagSets = cached.tagSets
          .map((s: string[]) => s.filter((t: string) => !existingTagSet.has(t)))
          .filter((s: string[]) => s.length > 0);
        // Re-filter activities
        const cachedActivities: string[] = Array.isArray(cached.activities)
          ? cached.activities.filter((a: string) => !(new Set(existingActivities || [])).has(a))
          : [];
        // If activities were expected (predefinedActivities provided) but cache has none,
        // treat cache as stale and regenerate to get activity suggestions
        const activitiesExpectedButMissing = predefinedActivities && predefinedActivities.length > 0
          && (!Array.isArray(cached.activities) || cached.activities.length === 0);
        // If everything was already applied or cache is stale, fall through to fresh generation
        if ((refilteredTagSets.length === 0 && cachedActivities.length === 0) || activitiesExpectedButMissing) {
          // Don't return — fall through to fresh generation below
        } else {
          setAllTagSets(refilteredTagSets);
          if (resetIndex || currentSetIndex >= refilteredTagSets.length) {
            setCurrentSetIndex(0);
          }
          setSuggestedActivities(cachedActivities);
          setShowSuggestion(true);
          return;
        }
      }
    }

    setLoading(true);
    try {
      if (mode === 'local') {
        // Local AI mode - zero-knowledge, requires Pro
        if (!isPro) {
          toast({
            title: t('suggestions.proFeature'),
            description: t('suggestions.proFeatureDescPrivate'),
            variant: "destructive",
          });
          return;
        }
        
        if (!localAI.isReady()) {
          toast({
            title: t('suggestions.aiModelsLoading'),
            description: t('suggestions.aiModelsLoadingDesc'),
            variant: "destructive",
          });
          return;
        }

        const analysis = await localAI.analyzeEntry(content);
        const allTags = [...(analysis.suggestedTags || []), ...(analysis.keywords || [])];
        const uniqueTags = [...new Set(allTags)];
        const filteredTags = uniqueTags.filter((tag: string) => !existingTags.includes(tag));
        
        if (filteredTags.length === 0) {
          toast({
            title: t('suggestions.noNewTags'),
            description: t('suggestions.noNewTagsDesc'),
            variant: "default",
          });
          return;
        }
        
        // For local AI, create a single set with available tags
        const tagSet = [filteredTags.slice(0, 5)];
        setAllTagSets(tagSet);
        setCurrentSetIndex(0);
        setShowSuggestion(true);
        const cacheKey = `${mode}_${content.substring(0, 500)}`;
        await aiCacheService.setCached(cacheKey, 'tags', { tagSets: tagSet });
        aiUsageLimits.recordUsage('tags');
      } else {
        // Cloud AI mode - generate 20 sets of tags in one call
        if (!isPro) {
          toast({
            title: t('suggestions.proFeature'),
            description: t('suggestions.proFeatureDescCloud'),
            variant: "destructive",
          });
          return;
        }


        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast({
            title: t('suggestions.authRequired'),
            description: t('suggestions.authRequiredDesc'),
            variant: "destructive",
          });
          return;
        }

        // Collect all unique tags from the journal (up to 200) to send to AI
        const allEntriesJson = localStorage.getItem('journal_entries');
        let allExistingTags: string[] = [];
        if (allEntriesJson) {
          try {
            const allEntries = JSON.parse(allEntriesJson);
            const tagSet = new Set<string>();
            allEntries.forEach((entry: any) => {
              if (entry.tags && Array.isArray(entry.tags)) {
                entry.tags.forEach((tag: string) => tagSet.add(tag));
              }
            });
            allExistingTags = Array.from(tagSet).slice(0, 200);
          } catch (e) {
            console.error('Failed to parse journal entries for existing tags:', e);
          }
        }

        const currentLanguage = i18n.language.split('-')[0]; // 'en', 'es', or 'ja'
        const { data, error } = await invokeWithRetry(supabase, 'ai-analyze', {
          body: {
            type: 'tags',
            language: currentLanguage,
            content,
            existingTags: allExistingTags,
            ...(predefinedActivities && predefinedActivities.length > 0 ? {
              predefinedActivities,
              existingActivities: existingActivities || [],
            } : {}),
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (error) {
          console.error('Edge function error details:', error);
          let description = t('suggestions.generationFailedDescEdge');
          try {
            const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
            if (typeof ctx?.json === 'function') {
              const body = await ctx.json();
              if (body?.error) description = body.error;
            }
          } catch {
            // use default description
          }
          toast({
            title: t('suggestions.generationFailed'),
            description,
            variant: "destructive",
          });
          return;
        }

        if (!data) {
          console.error('No data returned from edge function');
          toast({
            title: t('suggestions.generationFailed'),
            description: t('suggestions.generationFailedDescNoResponse'),
            variant: "destructive",
          });
          return;
        }

        if (data?.error) {
          console.error('AI service error:', data.error);
          toast({
            title: t('suggestions.generationFailed'),
            description: data.error,
            variant: "destructive",
          });
          return;
        }

        // Handle tag sets from AI
        if (data.tagSets && Array.isArray(data.tagSets)) {
          // Filter out tags that are already applied
          const filteredTagSets = data.tagSets.map((tagSet: string[]) =>
            tagSet.filter((tag: string) => !existingTags.includes(tag))
          ).filter((tagSet: string[]) => tagSet.length > 0); // Remove empty sets

          // Filter activities against current existing list
          let filteredActivities: string[] = [];
          if (Array.isArray(data.activities)) {
            const existingSet = new Set(existingActivities || []);
            filteredActivities = data.activities.filter((a: string) => typeof a === 'string' && !existingSet.has(a));
          }

          if (filteredTagSets.length === 0 && filteredActivities.length === 0) {
            toast({
              title: t('suggestions.noNewTags'),
              description: t('suggestions.noNewTagsDesc'),
              variant: "default",
            });
            return;
          }

          setAllTagSets(filteredTagSets);
          setSuggestedActivities(filteredActivities);
          if (resetIndex) {
            setCurrentSetIndex(0);
          }
          setShowSuggestion(true);
          const cacheKey = `${mode}_${content.substring(0, 500)}`;
          await aiCacheService.setCached(cacheKey, 'tags', data);
          aiUsageLimits.recordUsage('tags');
        } else {
          toast({
            title: t('suggestions.noTagsGenerated'),
            description: t('suggestions.noTagsGeneratedDesc'),
            variant: "default",
          });
        }
      }
    } catch (error: any) {
      console.error('Tag generation error:', error);
      
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
      
      // Reactive 429 handling
      if (error?.message?.includes('429') || error?.context?.status === 429) {
        aiUsageLimits.markLimitReached('tags');
        toast({
          title: t('suggestions.monthlyLimitReached'),
          description: t('suggestions.monthlyLimitReachedDescTags'),
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: t('suggestions.generationFailed'),
        description: errorMessage || t('suggestions.generationFailedDescGeneric'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const showNextTagSet = async () => {
    if (currentSetIndex < allTagSets.length - 1) {
      setShowingNext(true);
      // Brief artificial delay to make it feel like we're generating
      await new Promise(resolve => setTimeout(resolve, 400));
      setCurrentSetIndex(currentSetIndex + 1);
      setShowingNext(false);
    } else {
      // Reached the end, generate a NEW batch (skip cache to force fresh generation)
      await generateTags(true, true);
    }
  };

  const applyTags = () => {
    if (allTagSets.length > 0 && allTagSets[currentSetIndex]) {
      const currentTags = allTagSets[currentSetIndex];
      onApplyTags(currentTags);
      toast({
        title: t('suggestions.tagsApplied'),
        description: t('suggestions.tagsAppliedDesc', { count: currentTags.length }),
      });
      // Hide suggestion but keep batch and move to next
      setShowSuggestion(false);
      if (currentSetIndex < allTagSets.length - 1) {
        setCurrentSetIndex(currentSetIndex + 1);
      } else {
        // If we've used all tag sets, reset for next batch
        setAllTagSets([]);
        setCurrentSetIndex(0);
      }
    }
  };

  const applyActivities = () => {
    if (suggestedActivities.length > 0 && onApplyActivities) {
      onApplyActivities(suggestedActivities);
      toast({
        title: t('suggestions.activitiesApplied'),
        description: t('suggestions.activitiesAppliedDesc', { count: suggestedActivities.length }),
      });
      // Clear after applying so they don't get re-applied accidentally
      setSuggestedActivities([]);
    }
  };

  const toggleSuggestedActivity = (key: string) => {
    setSuggestedActivities(prev => prev.filter(a => a !== key));
  };

  const hasTagSets = allTagSets.length > 0;
  const hasSuggestedActivities = suggestedActivities.length > 0 && !!onApplyActivities;

  if ((hasTagSets || hasSuggestedActivities) && showSuggestion) {
    const currentTags = hasTagSets ? allTagSets[currentSetIndex] : [];

    return (
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in duration-200 space-y-3">
        {/* Tags row */}
        {hasTagSets && (
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
              {currentTags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs bg-background">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Suggested activities row */}
        {hasSuggestedActivities && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span>{t('suggestions.suggestedActivities')}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {suggestedActivities.map(key => (
                <Badge
                  key={key}
                  variant="outline"
                  className="text-xs bg-background cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  onClick={() => toggleSuggestedActivity(key)}
                  title={t('suggestions.removeActivity')}
                >
                  {getActivityLabel ? getActivityLabel(key) : key}
                  <span className="ml-1" aria-hidden="true">×</span>
                </Badge>
              ))}
            </div>
            <Button onClick={applyActivities} size="sm" variant="outline" className="h-7">
              <Check className="w-3.5 h-3.5 mr-1" />
              {t('suggestions.applyActivities')}
            </Button>
          </div>
        )}

        {/* Buttons row - stacks properly on mobile */}
        <div className="flex flex-wrap gap-2">
          {hasTagSets && (
            <Button onClick={applyTags} size="sm" variant="default" className="bg-gradient-primary hover:opacity-90">
              <Check className="w-4 h-4 mr-1" />
              {t('suggestions.applyAll')}
            </Button>
          )}
          {hasTagSets && (
            <Button
              onClick={showNextTagSet}
              size="sm"
              variant="outline"
              disabled={showingNext || loading}
              className="whitespace-nowrap"
            >
              {showingNext || loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {t('suggestions.suggesting')}
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 flex-shrink-0" />
                  {t('suggestions.suggestAnother')}
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => {
              setShowSuggestion(false);
              if (currentSetIndex < allTagSets.length - 1) {
                setCurrentSetIndex(currentSetIndex + 1);
              }
            }}
            size="sm"
            variant="ghost"
          >
            {t('suggestions.dismiss')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={() => {
        if (!isPro) return; // Disabled for non-Plus users
        // If we have suggestions in memory, show them
        if (allTagSets.length > 0 || suggestedActivities.length > 0) {
          setShowSuggestion(true);
        } else {
          // Otherwise generate new suggestions
          generateTags(true);
        }
      }}
      disabled={loading || !isPro}
      size="sm"
      variant={isPro ? "outline" : "secondary"}
      className="w-full"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {t('suggestions.generating')}
        </>
      ) : !isPro ? (
        <>
          <Crown className="w-4 h-4 mr-2" />
          {mode === 'local' ? t('suggestions.suggestTagsPrivate') : t('suggestions.suggestTagsEnhanced')}
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 mr-2" />
          {mode === 'local' ? t('suggestions.suggestTagsPrivate') : t('suggestions.suggestTagsEnhanced')}
        </>
      )}
    </Button>
  );
};