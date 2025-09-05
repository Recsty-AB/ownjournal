-- Add token usage tracking columns to ai_usage_stats
ALTER TABLE public.ai_usage_stats 
ADD COLUMN input_tokens integer,
ADD COLUMN output_tokens integer,
ADD COLUMN model_used text;