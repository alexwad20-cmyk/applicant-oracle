
ALTER TABLE public.allowed_users ADD COLUMN IF NOT EXISTS full_name text;

-- Update handle_new_user to pull full_name from allowed_users if available
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _full_name text;
BEGIN
  -- Try to get full_name from allowed_users
  SELECT full_name INTO _full_name
  FROM public.allowed_users
  WHERE lower(email) = lower(COALESCE(NEW.email, ''))
  LIMIT 1;

  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(_full_name, NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$function$;
