import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Check, RefreshCw, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithRetry } from "@/utils/edgeFunctionRetry";
import { useToast } from "@/hooks/use-toast";
import { aiCacheService } from "@/services/aiCacheService";
import { aiUsageLimits } from "@/services/aiUsageLimits";
import { useTranslation } from "react-i18next";
import { useAIMode } from "@/hooks/useAIMode";
import { localAIGenerative } from "@/services/localAIGenerative";

interface TitleSuggestionProps {
  content: string;
  tags?: string[];
  mood?: string;
  onApply: (title: string) => void;
  isPro: boolean;
}

// Maximum titles generated per API call
const MAX_TITLES = 20;

// Simple hash function for content
const hashContent = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

export const TitleSuggestion = ({ content, tags = [], mood, onApply, isPro }: TitleSuggestionProps) => {
  const [loading, setLoading] = useState(false);
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([]);
  const [currentTitleIndex, setCurrentTitleIndex] = useState(0);
  const [showingNext, setShowingNext] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false); // Track if UI should be visible
  const { toast } = useToast();
  const lastCallTimeRef = useRef<number>(0);
  const { i18n, t } = useTranslation();
  const aiMode = useAIMode('titleSuggestion', { isPro });

  // Clear suggestions when content changes
  useEffect(() => {
    setSuggestedTitles([]);
    setCurrentTitleIndex(0);
    setShowSuggestion(false);
  }, [content]);

  const generateTitles = async (resetIndex = true, skipCache = false) => {
    // Check word limit
    const wordCheck = aiUsageLimits.checkWordLimit(content);
    if (!wordCheck.allowed) {
      toast({
        title: t('suggestions.contentTooLong'),
        description: t('suggestions.contentTooLongDescTitle', { wordCount: wordCheck.wordCount, limit: wordCheck.limit }),
        variant: "destructive",
      });
      return;
    }

    // Check usage limit
    const limitCheck = aiUsageLimits.canUseFeature('title');
    if (!limitCheck.allowed) {
      toast({
        title: t('suggestions.limitReached'),
        description: limitCheck.reason,
        variant: "destructive",
      });
      return;
    }

    // Rate limiting: enforce 500ms minimum between calls (only for initial generation)
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

    if (content.trim().length < 20) {
      toast({
        title: t('suggestions.contentTooShort'),
        description: t('suggestions.contentTooShortDescTitle'),
        variant: "destructive",
      });
      return;
    }

    // Check cache first (unless skipCache is true)
    if (!skipCache) {
      const cacheKey = `cloud_${content.substring(0, 500)}`;
      const cached = await aiCacheService.getCached(cacheKey, 'title');
      if (cached?.suggestedTitles && Array.isArray(cached.suggestedTitles)) {
        setSuggestedTitles(cached.suggestedTitles);
        // Only reset if explicitly requested or if we're at the end of the batch
        if (resetIndex || currentTitleIndex >= cached.suggestedTitles.length) {
          setCurrentTitleIndex(0);
        }
        setShowSuggestion(true);
        return;
      }
    }

    setLoading(true);
    try {
      if (!isPro) {
        toast({
          title: t('suggestions.proFeature'),
          description: t('suggestions.proFeatureDescCloud'),
          variant: "destructive",
        });
        return;
      }

      // Local AI mode — run on-device inference
      if (aiMode === 'local') {
        const currentLanguage = i18n.language.split('-')[0];
        const titles = await localAIGenerative.generateTitle(content, currentLanguage);
        if (titles.length === 0) {
          toast({
            title: t('suggestions.generationFailed'),
            description: t('suggestions.generationFailedDescInvalid'),
            variant: "destructive",
          });
          return;
        }
        setSuggestedTitles(titles);
        if (resetIndex) setCurrentTitleIndex(0);
        setShowSuggestion(true);
        const cacheKey = `local_${content.substring(0, 500)}`;
        await aiCacheService.setCached(cacheKey, 'title', { suggestedTitles: titles });
        aiUsageLimits.recordUsage('title');
        return;
      }

      // Strict local-only mode and local is unavailable — refuse
      if (aiMode === 'unavailable') {
        toast({
          title: t('settings.aiTab.localUnavailable'),
          description: t('settings.aiTab.localUnavailableDesc'),
          variant: "destructive",
        });
        return;
      }

      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: t('suggestions.authRequired'),
          description: t('suggestions.authRequiredDesc'),
          variant: "destructive",
        });
        return;
      }

      const currentLanguage = i18n.language.split('-')[0]; // 'en', 'es', or 'ja'
      const { data, error } = await invokeWithRetry(supabase, 'ai-analyze', {
        body: {
          type: 'title',
          language: currentLanguage,
          content,
          tags: tags || [],
          mood: mood || null
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

      // Handle response
      if (data.suggestedTitles && Array.isArray(data.suggestedTitles)) {
        setSuggestedTitles(data.suggestedTitles);
        // Only reset index if requested or we're generating fresh
        if (resetIndex) {
          setCurrentTitleIndex(0);
        }
        setShowSuggestion(true);
        const cacheKey = `cloud_${content.substring(0, 500)}`;
        await aiCacheService.setCached(cacheKey, 'title', data);
        aiUsageLimits.recordUsage('title');
      } else {
        toast({
          title: t('suggestions.generationFailed'),
          description: t('suggestions.generationFailedDescInvalid'),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Title generation error:', error);
      
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
        aiUsageLimits.markLimitReached('title');
        toast({
          title: t('suggestions.monthlyLimitReached'),
          description: t('suggestions.monthlyLimitReachedDescTitle'),
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

  const showNextTitle = async () => {
    if (currentTitleIndex < suggestedTitles.length - 1) {
      setShowingNext(true);
      // Brief artificial delay to make it feel like we're generating
      await new Promise(resolve => setTimeout(resolve, 400));
      setCurrentTitleIndex(currentTitleIndex + 1);
      setShowingNext(false);
    } else {
      // Reached the end, generate a NEW batch (skip cache to force fresh generation)
      await generateTitles(true, true);
    }
  };

  const applyTitle = () => {
    if (suggestedTitles.length > 0) {
      onApply(suggestedTitles[currentTitleIndex]);
      toast({
        title: t('suggestions.titleApplied'),
        description: t('suggestions.titleAppliedDesc'),
      });
      // Hide suggestion but keep batch and move to next
      setShowSuggestion(false);
      if (currentTitleIndex < suggestedTitles.length - 1) {
        setCurrentTitleIndex(currentTitleIndex + 1);
      } else {
        // If we've used all titles, reset for next batch
        setSuggestedTitles([]);
        setCurrentTitleIndex(0);
      }
    }
  };

  if (suggestedTitles.length > 0 && showSuggestion) {
    const currentTitle = suggestedTitles[currentTitleIndex];
    
    return (
      <div className="p-3 sm:p-4 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in duration-200 space-y-3">
        {/* Title text - full width, proper wrapping */}
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <span className="text-sm font-medium leading-relaxed break-words">{currentTitle}</span>
        </div>
        
        {/* Buttons - wrap on mobile */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={applyTitle} size="sm" variant="default" className="flex-1 sm:flex-none bg-gradient-primary hover:opacity-90">
            <Check className="w-4 h-4 mr-1" />
            {t('suggestions.apply')}
          </Button>
          <Button 
            onClick={showNextTitle}
            size="sm" 
            variant="outline"
            disabled={showingNext || loading}
            className="flex-1 sm:flex-none whitespace-nowrap"
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
          <Button 
            onClick={() => {
              setShowSuggestion(false);
              if (currentTitleIndex < suggestedTitles.length - 1) {
                setCurrentTitleIndex(currentTitleIndex + 1);
              }
            }} 
            size="sm" 
            variant="ghost"
            className="sm:ml-auto"
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
        // If we have titles in memory, show the next one
        if (suggestedTitles.length > 0) {
          setShowSuggestion(true);
        } else {
          // Otherwise generate new titles
          generateTitles(true);
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
          {t('suggestions.suggestTitleEnhanced')}
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 mr-2" />
          {t('suggestions.suggestTitleEnhanced')}
        </>
      )}
    </Button>
  );
};
