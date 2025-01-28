-- Drop existing foreign key constraint if it exists
ALTER TABLE IF EXISTS public.user_sessions 
  DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey;

-- Recreate the foreign key constraint to reference auth.users
ALTER TABLE public.user_sessions
  ADD CONSTRAINT user_sessions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Update other tables to use auth.users reference
ALTER TABLE IF EXISTS public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Disable RLS temporarily for migration
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_delete();

-- First, add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add display_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN display_name TEXT;
        -- Set display_name to username for existing records
        UPDATE public.profiles SET display_name = username WHERE display_name IS NULL;
    END IF;

    -- Add auth_user_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'auth_user_id'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN auth_user_id UUID;
        -- Set auth_user_id to id for existing records
        UPDATE public.profiles SET auth_user_id = id WHERE auth_user_id IS NULL;
        -- Make it not null after setting values
        ALTER TABLE public.profiles ALTER COLUMN auth_user_id SET NOT NULL;
    END IF;

    -- Add timestamps if they don't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

-- Now create temp table with all columns
CREATE TEMP TABLE temp_profiles AS
SELECT 
    id,
    auth_user_id,
    username,
    display_name,
    email,
    avatar_url,
    created_at,
    updated_at
FROM public.profiles;

-- Drop existing foreign key constraints if they exist
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_auth_user_id_fkey,
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Drop existing triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Recreate the profiles table with correct structure
CREATE TABLE IF NOT EXISTS public.profiles_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

-- Copy data from temporary table, using id as auth_user_id if it exists
INSERT INTO public.profiles_new (
    id,
    auth_user_id,
    username,
    display_name,
    email,
    avatar_url,
    created_at,
    updated_at
)
SELECT 
    COALESCE(tp.id, gen_random_uuid()),
    COALESCE(tp.auth_user_id, tp.id),
    tp.username,
    tp.display_name, 
    tp.email,
    tp.avatar_url,
    tp.created_at,
    tp.updated_at
FROM temp_profiles tp;

-- Drop the old table and rename the new one
DROP TABLE public.profiles CASCADE;
ALTER TABLE public.profiles_new RENAME TO profiles;

-- Create indexes and constraints
CREATE INDEX IF NOT EXISTS profiles_auth_user_id_idx ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- Explicitly create the foreign key constraint
ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_auth_user_id_fkey,
    ADD CONSTRAINT profiles_auth_user_id_fkey 
    FOREIGN KEY (auth_user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Profiles are viewable by users in the same chats"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_members cm1
            INNER JOIN public.chat_members cm2 ON cm1.chat_id = cm2.chat_id
            WHERE cm1.profile_id = profiles.id
            AND cm2.profile_id IN (
                SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
            )
        )
    );

-- Create function to automatically create profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_username text;
BEGIN
    -- Extract username from email, ensuring uniqueness
    default_username := split_part(NEW.email, '@', 1);
    
    -- Insert new profile
    INSERT INTO public.profiles (
        auth_user_id,
        username,
        display_name,
        email,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        default_username,
        COALESCE(NEW.raw_user_meta_data->>'full_name', default_username),
        NEW.email,
        NOW(),
        NOW()
    )
    ON CONFLICT (username) DO UPDATE
    SET username = default_username || '_' || substring(md5(random()::text) from 1 for 6)
    WHERE profiles.auth_user_id = NEW.id;
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create function to handle user deletion
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Delete user's profile
    DELETE FROM public.profiles WHERE auth_user_id = OLD.id;
    RETURN OLD;
END;
$$;

-- Create trigger for user deletion
CREATE TRIGGER on_auth_user_deleted
    BEFORE DELETE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_delete();

-- Enable RLS on user_sessions table
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- First, list and drop ALL existing policies for user_sessions
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'user_sessions'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_sessions', policy_record.policyname);
    END LOOP;
END $$;

-- Create RLS policies for user_sessions table with standard names
CREATE POLICY "Users can view their own sessions"
    ON public.user_sessions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sessions"
    ON public.user_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
    ON public.user_sessions
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
    ON public.user_sessions
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Verify the changes
DO $$
DECLARE
    policy_count integer;
    expected_policies text[] := ARRAY[
        'Users can view their own sessions',
        'Users can insert their own sessions',
        'Users can update their own sessions',
        'Users can delete their own sessions'
    ];
    missing_policies text[];
    extra_policies text[];
    policy_name text;
BEGIN
    -- Get list of actual policies
    SELECT array_agg(policyname::text)
    INTO extra_policies
    FROM pg_policies
    WHERE tablename = 'user_sessions'
    AND schemaname = 'public';

    -- Find missing policies
    SELECT array_agg(expected)
    INTO missing_policies
    FROM unnest(expected_policies) expected
    WHERE expected NOT IN (
        SELECT policyname::text
        FROM pg_policies
        WHERE tablename = 'user_sessions'
        AND schemaname = 'public'
    );

    -- Find extra policies
    SELECT array_agg(actual)
    INTO extra_policies
    FROM (
        SELECT policyname::text as actual
        FROM pg_policies
        WHERE tablename = 'user_sessions'
        AND schemaname = 'public'
        AND policyname::text NOT IN (SELECT unnest(expected_policies))
    ) subq;

    -- Raise detailed error if policies don't match
    IF missing_policies IS NOT NULL OR extra_policies IS NOT NULL THEN
        RAISE EXCEPTION 'Policy verification failed. Missing policies: %. Extra policies: %', 
            COALESCE(missing_policies::text, '{}'), 
            COALESCE(extra_policies::text, '{}');
    END IF;

    -- Verify RLS is enabled
    IF NOT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE tablename = 'user_sessions'
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'Migration failed: RLS not enabled on user_sessions table';
    END IF;
END $$;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_sessions TO authenticated;

-- Verify the changes
DO $$
DECLARE
    policy_count integer;
    constraint_name text;
BEGIN
    -- First verify the profiles table exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'profiles'
    ) THEN
        RAISE EXCEPTION 'Migration failed: profiles table not found';
    END IF;

    -- Verify auth_user_id column exists and is NOT NULL
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'auth_user_id'
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Migration failed: auth_user_id column not found or is nullable';
    END IF;
    
    -- Verify foreign key constraint using pg_constraint
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE contype = 'f'
        AND conrelid = 'public.profiles'::regclass
        AND n.nspname = 'public'
        AND conname = 'profiles_auth_user_id_fkey'
    ) THEN
        -- Get actual constraint name if it exists with different name
        SELECT c.conname INTO constraint_name
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE contype = 'f'
        AND conrelid = 'public.profiles'::regclass
        AND n.nspname = 'public'
        LIMIT 1;
        
        IF constraint_name IS NOT NULL THEN
            RAISE EXCEPTION 'Migration failed: Foreign key exists but with different name: %', constraint_name;
        ELSE
            RAISE EXCEPTION 'Migration failed: No foreign key constraint found on profiles.auth_user_id';
        END IF;
    END IF;

    -- Verify the constraint references auth.users
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE contype = 'f'
        AND conrelid = 'public.profiles'::regclass
        AND confrelid = 'auth.users'::regclass
    ) THEN
        RAISE EXCEPTION 'Migration failed: Foreign key does not reference auth.users';
    END IF;

    -- Verify user_sessions policies
    SELECT COUNT(*)
    INTO policy_count
    FROM pg_policies
    WHERE tablename = 'user_sessions'
    AND schemaname = 'public';

    IF policy_count != 4 THEN
        RAISE EXCEPTION 'Migration failed: Expected 4 policies for user_sessions table, found %', policy_count;
    END IF;

    -- Verify specific policies exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_sessions' 
        AND policyname = 'Users can view their own sessions'
    ) THEN
        RAISE EXCEPTION 'Migration failed: Select policy not found for user_sessions';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_sessions' 
        AND policyname = 'Users can insert their own sessions'
    ) THEN
        RAISE EXCEPTION 'Migration failed: Insert policy not found for user_sessions';
    END IF;

    -- Verify RLS is enabled
    IF NOT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE tablename = 'user_sessions'
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'Migration failed: RLS not enabled on user_sessions table';
    END IF;
END $$;
