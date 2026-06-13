-- Add the missing foreign key from ai_usage_stats.user_id to auth.users.
--
-- Every other user-scoped table references auth.users(id) ON DELETE CASCADE
-- (profiles, subscriptions, user_credentials, iap_processed_events), but
-- ai_usage_stats.user_id was declared as a bare `UUID NOT NULL` with no FK.
-- As a result, deleting a user (delete-account edge function / GDPR erasure)
-- leaves that user's ai_usage_stats rows orphaned forever — they are no longer
-- reachable by anyone (the SELECT policy is auth.uid() = user_id), but they
-- still hold per-user usage history the account-deletion flow intended to remove.
--
-- The INSERT policy on ai_usage_stats already enforces WITH CHECK
-- (auth.uid() = user_id), so user_id always pointed at a real auth user at
-- write time; the only rows that can violate the new FK are ones whose owner
-- was already deleted. Remove those first, then add the constraint so future
-- deletions cascade like every sibling table.

-- 1. Clear rows orphaned by past account deletions so the constraint validates.
DELETE FROM public.ai_usage_stats s
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = s.user_id
);

-- 2. Add the FK with the same cascade semantics as the other user tables.
ALTER TABLE public.ai_usage_stats
  ADD CONSTRAINT ai_usage_stats_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
