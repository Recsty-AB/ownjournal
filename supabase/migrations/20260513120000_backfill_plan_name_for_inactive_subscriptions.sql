-- Backfill plan_name to 'free' for users whose entitlement has ended.
-- Access control is gated on is_pro (see src/utils/aiPermissions.ts and
-- src/utils/subscriptionCache.ts); plan_name is cosmetic. Webhook handlers
-- previously omitted resetting it on cancellation/expiration, so historical
-- rows show stale 'plus'. This is a one-time data-quality cleanup with no
-- behavioral effect.
UPDATE public.subscriptions
SET plan_name = 'free'
WHERE is_pro = FALSE
  AND plan_name IS DISTINCT FROM 'free';
