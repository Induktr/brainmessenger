-- Migration script for profiles table
BEGIN;  -- Start the main transaction

-- Enable detailed logging
SET client_min_messages TO NOTICE;

-- Clean up existing objects if they exist
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop existing policies
    FOR policy_record IN (
        SELECT policyname::text as name
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles'
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_record.name);
        RAISE NOTICE 'Dropped policy: %', policy_record.name;
    END LOOP;

    -- Drop existing trigger BEFORE function
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_profiles_updated_at' AND tgrelid = 'profiles'::regclass) THEN
        DROP TRIGGER set_profiles_updated_at ON public.profiles CASCADE;
        RAISE NOTICE 'Dropped existing trigger set_profiles_updated_at';
    END IF;
END $$;

-- Drop function with notice
DO $$
BEGIN
    DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
    RAISE NOTICE 'Dropped existing function handle_updated_at';
END $$;

-- Drop existing table
DO $$
BEGIN
    DROP TABLE IF EXISTS public.profiles CASCADE;
    RAISE NOTICE 'Dropped existing profiles table';
END $$;

-- Verify auth.users table and permissions
DO $$
DECLARE
    user_count INTEGER;
    has_permission BOOLEAN;
BEGIN
    -- Check auth schema access
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.schemata 
        WHERE schema_name = 'auth'
    ) INTO has_permission;
    
    IF NOT has_permission THEN
        RAISE EXCEPTION 'No access to auth schema. Please check permissions.';
    END IF;

    -- Check auth.users table
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'auth' 
        AND table_name = 'users'
    ) INTO has_permission;
    
    IF NOT has_permission THEN
        RAISE EXCEPTION 'auth.users table not found. Please check Supabase setup.';
    END IF;

    -- Check if we can actually query auth.users
    BEGIN
        SELECT COUNT(*) INTO user_count FROM auth.users;
        RAISE NOTICE 'Found % users in auth.users table', user_count;
    EXCEPTION WHEN insufficient_privilege THEN
        RAISE EXCEPTION 'Insufficient privileges to query auth.users';
    END;
END $$;

-- Create trigger function first (no dependencies)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql 
   SECURITY DEFINER
   SET search_path TO public;

-- Create profiles table with updated schema
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    username TEXT UNIQUE,
    display_name TEXT,
    bio TEXT DEFAULT '',
    avatar_url TEXT,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT profiles_id_fkey 
        FOREIGN KEY (id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE 
        DEFERRABLE INITIALLY DEFERRED
);
-- Create trigger, check if trigger exists before creating
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_profiles_updated_at' AND tgrelid = 'profiles'::regclass) THEN
        CREATE TRIGGER set_profiles_updated_at
            BEFORE UPDATE ON public.profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
        RAISE NOTICE 'Trigger set_profiles_updated_at created';
    ELSE
        RAISE NOTICE 'Trigger set_profiles_updated_at already exists, skipping creation';
    END IF;
END$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Create read policy
    CREATE POLICY "Enable read access for users" 
        ON public.profiles FOR SELECT 
        USING (true);

    -- Create update policy
    CREATE POLICY "Enable update for users based on user_id"
        ON public.profiles FOR UPDATE
        USING (auth.uid() = id);

    -- Create insert policy
    CREATE POLICY "Enable insert for users" 
        ON public.profiles FOR INSERT 
        WITH CHECK (auth.uid() = id);

    -- Create delete policy
    CREATE POLICY "Enable delete for users" 
        ON public.profiles FOR DELETE 
        USING (auth.uid() = id);

    RAISE NOTICE 'Created all RLS policies successfully';
END $$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_table_info(text);

-- Create the function with fixed search path
CREATE OR REPLACE FUNCTION public.get_table_info(p_table_name text)
RETURNS TABLE (
    column_name text,
    data_type text,
    is_nullable boolean,
    column_default text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog  -- Fixed search path
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.column_name::text,
        c.data_type::text,
        (c.is_nullable = 'YES') as is_nullable,
        c.column_default::text
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    AND c.table_name = p_table_name;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_table_info(text) TO authenticated;

-- Verify function exists and is accessible
DO $$
BEGIN
    -- Test function exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'get_table_info' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE EXCEPTION 'Function get_table_info was not created properly';
    END IF;

    -- Test function permissions
    IF NOT has_function_privilege('authenticated', 'public.get_table_info(text)', 'EXECUTE') THEN
        RAISE EXCEPTION 'Function permissions not set correctly for authenticated role';
    END IF;

    RAISE NOTICE 'Function get_table_info created and verified successfully';
END $$;

-- Final verification
DO $$
DECLARE
    policy_count INTEGER;
    fk_exists BOOLEAN;
    table_exists BOOLEAN;
    trigger_exists BOOLEAN;
    policy_record RECORD;
BEGIN
    -- First verify the table exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) INTO table_exists;

    IF NOT table_exists THEN
        RAISE EXCEPTION 'Table public.profiles does not exist';
    END IF;

    -- Verify trigger with improved query
    SELECT EXISTS (
        SELECT 1 
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE t.tgname = 'set_profiles_updated_at'
        AND n.nspname = 'public'
        AND c.relname = 'profiles'
    ) INTO trigger_exists;

    IF NOT trigger_exists THEN
        RAISE EXCEPTION 'Trigger set_profiles_updated_at does not exist on public.profiles';
    END IF;

    -- Verify policies with better error handling
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' 
    AND tablename = 'profiles';

    IF policy_count = 0 THEN
        RAISE EXCEPTION 'No policies found for profiles table';
    ELSIF policy_count != 4 THEN
        RAISE EXCEPTION 'Expected 4 policies, found %. Some policies may not have been created correctly', policy_count;
    END IF;

    -- List all policies for debugging
    RAISE NOTICE 'Existing policies:';
    FOR policy_record IN (
        SELECT 
            policyname::text as policyname,
            CASE cmd
                WHEN 'r'::"char" THEN 'SELECT'
                WHEN 'a'::"char" THEN 'INSERT'
                WHEN 'w'::"char" THEN 'UPDATE'
                WHEN 'd'::"char" THEN 'DELETE'
                ELSE 'UNKNOWN'
            END as operation,
            qual::text as qual_condition,
            with_check::text as check_condition
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles'
    ) LOOP
        RAISE NOTICE 'Policy: %, Operation: %, USING: %, WITH CHECK: %', 
            policy_record.policyname,
            policy_record.operation,
            policy_record.qual_condition,
            policy_record.check_condition;
    END LOOP;

    RAISE NOTICE 'Migration completed successfully';
END $$;

END;  -- End the main transaction
