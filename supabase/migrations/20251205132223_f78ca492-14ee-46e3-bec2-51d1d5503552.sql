-- Add DELETE policy for profiles table to enable GDPR-compliant data deletion
CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);