-- Add policy to allow users to update their own subscription status (FOR TESTING ONLY)
-- This should be removed in production and only Stripe webhooks should update subscriptions

CREATE POLICY "Users can update own subscription for testing"
ON public.subscriptions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);