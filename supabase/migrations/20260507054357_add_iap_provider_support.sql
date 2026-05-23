-- Native In-App Purchase support: track Apple/Google subscriptions alongside Stripe
-- in the existing public.subscriptions table. is_pro remains the single source of
-- truth for entitlement; provider columns record where the entitlement came from
-- so webhooks from any source can converge on the same row.

-- 1. Provider enum -----------------------------------------------------------
CREATE TYPE public.subscription_provider AS ENUM ('stripe', 'apple', 'google');

-- 2. Provider tracking on subscriptions --------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN provider                       public.subscription_provider,
  ADD COLUMN apple_original_transaction_id  TEXT,
  ADD COLUMN apple_product_id               TEXT,
  ADD COLUMN google_purchase_token          TEXT,
  ADD COLUMN google_product_id              TEXT,
  ADD COLUMN google_base_plan_id            TEXT,
  ADD COLUMN revenuecat_app_user_id         TEXT,
  ADD COLUMN last_provider_event_at         TIMESTAMPTZ,
  ADD COLUMN last_provider_event_id         TEXT;

-- 3. Backfill existing rows --------------------------------------------------
UPDATE public.subscriptions
   SET provider = 'stripe'
 WHERE stripe_subscription_id IS NOT NULL;

-- 4. Idempotency: same Apple/Google notification must never apply twice ------
CREATE TABLE public.iap_processed_events (
  event_id     TEXT PRIMARY KEY,
  provider     public.subscription_provider NOT NULL,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload      JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_iap_processed_events_user
  ON public.iap_processed_events (user_id);

-- Service-role-only access — only edge functions write here. RLS enabled with
-- no policies = client cannot read or write.
ALTER TABLE public.iap_processed_events ENABLE ROW LEVEL SECURITY;

-- 5. Lookup indexes for webhook handlers -------------------------------------
CREATE INDEX idx_subscriptions_apple_otid
  ON public.subscriptions (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;

CREATE INDEX idx_subscriptions_google_token
  ON public.subscriptions (google_purchase_token)
  WHERE google_purchase_token IS NOT NULL;

CREATE INDEX idx_subscriptions_revenuecat
  ON public.subscriptions (revenuecat_app_user_id)
  WHERE revenuecat_app_user_id IS NOT NULL;
