-- Create ai_usage table to store AI analysis results
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entry_id TEXT NOT NULL,
  analysis_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_id)
);

-- Enable RLS
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can only view their own AI analyses
CREATE POLICY "Users can view their own AI analyses"
ON public.ai_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own AI analyses
CREATE POLICY "Users can insert their own AI analyses"
ON public.ai_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own AI analyses
CREATE POLICY "Users can update their own AI analyses"
ON public.ai_usage
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_ai_usage_user_entry ON public.ai_usage(user_id, entry_id);