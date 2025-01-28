-- Start transaction
BEGIN;

-- Update the profiles table schema
ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL,
  ALTER COLUMN "full_name" SET NOT NULL,
  ADD CONSTRAINT profiles_username_check CHECK (char_length(username) >= 3),
  ADD CONSTRAINT profiles_fullname_check CHECK (char_length("full_name") >= 1);

-- Update or create the profile trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, "full_name", avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', NULL)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Verify existing profiles data
DO $$
BEGIN
  -- Update any null usernames or full_names
  UPDATE public.profiles 
  SET username = 'user_' || substr(id::text, 1, 8)
  WHERE username IS NULL;
  
  UPDATE public.profiles 
  SET "full_name" = 'New User'
  WHERE "full_name" IS NULL;
END $$;

COMMIT;
