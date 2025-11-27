
-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function to handle new user with unique username handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Get base username from metadata or generate from email
  base_username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    SPLIT_PART(NEW.email, '@', 1)
  );
  
  -- Sanitize username (remove special characters, limit length)
  base_username := REGEXP_REPLACE(base_username, '[^a-zA-Z0-9_]', '', 'g');
  base_username := SUBSTRING(base_username FROM 1 FOR 40);
  
  -- If empty, use a default
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'user';
  END IF;
  
  final_username := base_username;
  
  -- Check for uniqueness and append number if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    final_username := base_username || '_' || counter::TEXT;
  END LOOP;
  
  -- Insert the profile
  INSERT INTO public.profiles (id, username, email)
  VALUES (NEW.id, final_username, NEW.email);
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
