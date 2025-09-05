-- Drop tables that store journal content derivatives
DROP TABLE IF EXISTS public.ai_usage CASCADE;
DROP TABLE IF EXISTS public.ai_trend_analysis CASCADE;

-- Create minimal usage tracking table (counts only, no content)
CREATE TABLE public.ai_usage_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  analysis_type TEXT NOT NULL, -- 'entry', 'title', 'trend', 'image'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_stats ENABLE ROW LEVEL SECURITY;

-- Users can view their own stats
CREATE POLICY "Users can view their own AI usage stats" 
ON public.ai_usage_stats 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own stats
CREATE POLICY "Users can insert their own AI usage stats" 
ON public.ai_usage_stats 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_ai_usage_stats_user_type_date 
ON public.ai_usage_stats(user_id, analysis_type, created_at DESC);