-- Add analysis_data column to ai_usage table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_usage' 
    AND column_name = 'analysis_data'
  ) THEN
    ALTER TABLE public.ai_usage ADD COLUMN analysis_data jsonb;
  END IF;
END $$;

-- Create table to track trend analysis with rate limiting
CREATE TABLE IF NOT EXISTS public.ai_trend_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  analysis_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_trend_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own trend analysis"
ON public.ai_trend_analysis
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trend analysis"
ON public.ai_trend_analysis
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_trend_analysis_user_created 
ON public.ai_trend_analysis(user_id, created_at DESC);