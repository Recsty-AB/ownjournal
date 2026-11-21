-- Dream patterns moves from two reports a month to one a week, like Trend
-- Analysis (owner decision, 2026-11-21). get_ai_usage_summary returns the
-- reports of the current week (p_start_of_week) instead of the month.
-- Deploy before ai-analyze, which reads weekly_dream_patterns_count; until
-- then the deployed function refuses Dream patterns (503) rather than run
-- without a limit.

-- The return type changes, which CREATE OR REPLACE cannot do.
DROP FUNCTION IF EXISTS public.get_ai_usage_summary(uuid, timestamptz, timestamptz, timestamptz);

CREATE FUNCTION public.get_ai_usage_summary(
  p_user_id uuid,
  p_start_of_month timestamptz,
  p_start_of_week timestamptz,
  p_start_of_year timestamptz
)
RETURNS TABLE (
  is_pro boolean,
  monthly_title_count bigint,
  monthly_tags_count bigint,
  monthly_entry_count bigint,
  weekly_trend_count bigint,
  yearly_entry_count bigint,
  yearly_trend_count bigint,
  monthly_transcription_seconds bigint,
  monthly_dream_reflection_count bigint,
  weekly_dream_patterns_count bigint,
  monthly_dream_failed_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (COALESCE(s.is_pro, false)
      AND (s.current_period_end IS NULL OR s.current_period_end > now())) as is_pro,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'title' AND aus.created_at >= p_start_of_month), 0) as monthly_title_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'tags' AND aus.created_at >= p_start_of_month), 0) as monthly_tags_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'entryAnalysis' AND aus.created_at >= p_start_of_month), 0) as monthly_entry_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'trendAnalysis' AND aus.created_at >= p_start_of_week), 0) as weekly_trend_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'entryAnalysis' AND aus.created_at >= p_start_of_year), 0) as yearly_entry_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'trendAnalysis' AND aus.created_at >= p_start_of_year), 0) as yearly_trend_count,
    COALESCE(SUM(aus.audio_seconds) FILTER (WHERE aus.analysis_type = 'transcription' AND aus.created_at >= p_start_of_month), 0)::bigint as monthly_transcription_seconds,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'dreamReflection' AND aus.created_at >= p_start_of_month), 0) as monthly_dream_reflection_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'dreamPatterns' AND aus.created_at >= p_start_of_week), 0) as weekly_dream_patterns_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type IN ('dreamReflectionFailed', 'dreamPatternsFailed') AND aus.created_at >= p_start_of_month), 0) as monthly_dream_failed_count
  FROM public.subscriptions s
  LEFT JOIN public.ai_usage_stats aus ON aus.user_id = s.user_id
  WHERE s.user_id = p_user_id
    AND s.user_id = auth.uid()  -- CRITICAL: Verify caller owns this data
  GROUP BY s.is_pro, s.current_period_end
$$;
