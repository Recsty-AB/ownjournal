-- Add index on subscriptions table for faster user lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- Create consolidated function to get AI usage summary in a single query
CREATE OR REPLACE FUNCTION public.get_ai_usage_summary(
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
  yearly_trend_count bigint
) 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(s.is_pro, false) as is_pro,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'title' AND aus.created_at >= p_start_of_month), 0) as monthly_title_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'tags' AND aus.created_at >= p_start_of_month), 0) as monthly_tags_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'entryAnalysis' AND aus.created_at >= p_start_of_month), 0) as monthly_entry_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'trendAnalysis' AND aus.created_at >= p_start_of_week), 0) as weekly_trend_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'entryAnalysis' AND aus.created_at >= p_start_of_year), 0) as yearly_entry_count,
    COALESCE(COUNT(*) FILTER (WHERE aus.analysis_type = 'trendAnalysis' AND aus.created_at >= p_start_of_year), 0) as yearly_trend_count
  FROM public.subscriptions s
  LEFT JOIN public.ai_usage_stats aus ON aus.user_id = s.user_id
  WHERE s.user_id = p_user_id
  GROUP BY s.is_pro
$$;