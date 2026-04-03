-- Add trial tracking to subscriptions table
ALTER TABLE public.subscriptions
  ADD COLUMN has_used_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: mark existing/past subscribers as having used their trial
UPDATE public.subscriptions
  SET has_used_trial = TRUE
  WHERE stripe_subscription_id IS NOT NULL;
