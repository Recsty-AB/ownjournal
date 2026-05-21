-- Stripe webhook event deduplication
--
-- Stripe retries non-2xx responses and exposes a "Resend event" button in the
-- dashboard. Without idempotency, replays re-apply subscription updates and
-- can flip is_pro / has_used_trial back to stale values. Mirror the
-- public.iap_processed_events pattern used for the RevenueCat webhook.

CREATE TABLE public.stripe_processed_events (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  event_created BIGINT,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;
-- No policies = service-role-only access (same shape as iap_processed_events).
