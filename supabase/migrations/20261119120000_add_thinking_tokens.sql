-- Gemini reports thinking tokens separately from response tokens
-- (usageMetadata.thoughtsTokenCount) and bills them at the output rate.
-- Record them so the real cost per analysis type can be measured.
--
-- ai_usage_stats has an INSERT policy that lets users write their own rows,
-- so the CHECK constraint keeps the column non-negative.
ALTER TABLE public.ai_usage_stats
  ADD COLUMN thinking_tokens integer
  CONSTRAINT ai_usage_stats_thinking_tokens_nonnegative CHECK (thinking_tokens IS NULL OR thinking_tokens >= 0);
