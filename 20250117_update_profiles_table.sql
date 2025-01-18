-- Create the timestamp update function
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update profiles table with new fields and constraints
DO $$ 
BEGIN
    -- Drop existing constraints if they exist
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_visibility' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT valid_visibility;
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_username_key' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_username_key;
    END IF;

    -- Add columns if they don't exist
    BEGIN
        ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS display_name TEXT,
        ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public'::text,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    EXCEPTION
        WHEN duplicate_column THEN
            NULL;
    END;

    -- Update existing rows to ensure non-null values
    UPDATE public.profiles 
    SET 
        display_name = COALESCE(display_name, username, email),
        bio = COALESCE(bio, ''),
        visibility = COALESCE(visibility, 'public');

    -- Set NOT NULL constraints
    ALTER TABLE public.profiles
        ALTER COLUMN id SET NOT NULL,
        ALTER COLUMN username SET NOT NULL,
        ALTER COLUMN display_name SET NOT NULL,
        ALTER COLUMN bio SET NOT NULL,
        ALTER COLUMN visibility SET NOT NULL,
        ALTER COLUMN updated_at SET NOT NULL;

    -- Add visibility constraint
    ALTER TABLE public.profiles
    ADD CONSTRAINT valid_visibility CHECK (visibility IN ('public', 'private'));

    -- Add username uniqueness constraint
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);

    -- Drop existing trigger if it exists
    DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;

    -- Create the updated_at trigger
    CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();
END $$;

-- Function to generate unique username
CREATE OR REPLACE FUNCTION public.generate_unique_username(base_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_username TEXT;
    counter INTEGER := 0;
BEGIN
    -- Try the base username first
    new_username := base_username;
    
    -- Keep trying with incrementing numbers until we find a unique one
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
        counter := counter + 1;
        new_username := base_username || counter::text;
    END LOOP;
    
    RETURN new_username;
END;
$$;

-- Function to update profile settings
CREATE OR REPLACE FUNCTION public.update_profile_settings(
    user_id UUID,
    new_username TEXT,
    new_display_name TEXT,
    new_bio TEXT,
    new_visibility TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Validate visibility
    IF new_visibility NOT IN ('public', 'private') THEN
        RAISE EXCEPTION 'Invalid visibility setting';
    END IF;

    -- Generate unique username if needed
    new_username := public.generate_unique_username(new_username);

    -- Update profile
    UPDATE public.profiles
    SET
        username = new_username,
        display_name = new_display_name,
        bio = new_bio,
        visibility = new_visibility,
        updated_at = NOW()
    WHERE id = user_id
    RETURNING jsonb_build_object(
        'username', username,
        'display_name', display_name,
        'bio', bio,
        'visibility', visibility
    ) INTO result;

    IF result IS NULL THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_profile_settings TO authenticated;

-- Create policy for updating profile settings
DROP POLICY IF EXISTS "Users can update their own profile settings" ON public.profiles;
CREATE POLICY "Users can update their own profile settings"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
