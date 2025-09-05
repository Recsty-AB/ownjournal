-- Remove the dangerous UPDATE policy that allows users to modify their own subscription status
-- This policy was used for testing but creates a security vulnerability where users can grant themselves Pro access
DROP POLICY IF EXISTS "Users can update own subscription for testing" ON public.subscriptions;