-- Update the handle_new_user function to only store essential data
-- Remove automatic population of display_name from OAuth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Create profile with minimal data - only email (required for auth)
  -- display_name is left null and can be set by user if they choose
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  
  -- Create subscription record
  INSERT INTO public.subscriptions (user_id, plan_name, is_pro)
  VALUES (NEW.id, 'free', FALSE);
  
  RETURN NEW;
END;
$function$;