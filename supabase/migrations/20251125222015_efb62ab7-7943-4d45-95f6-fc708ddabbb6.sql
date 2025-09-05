-- Add entry_id column to ai_usage_stats for tracking per-entry analysis
ALTER TABLE public.ai_usage_stats
ADD COLUMN IF NOT EXISTS entry_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_user_type_entry 
ON public.ai_usage_stats(user_id, analysis_type, entry_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_user_type_date 
ON public.ai_usage_stats(user_id, analysis_type, created_at);