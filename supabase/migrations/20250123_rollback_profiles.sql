-- Rollback script for profiles table migration
BEGIN;

-- Enable detailed logging
SET client_min_messages TO NOTICE;

-- Check if table exists before trying to drop policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) THEN
        -- Drop policies if table exists
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

        -- Drop trigger if exists
        DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
        RAISE NOTICE 'Dropped trigger if it existed';
    END IF;
END $$;

-- Drop function if exists (can be dropped even if table doesn't exist)
DO $$
BEGIN
    DROP FUNCTION IF EXISTS public.handle_updated_at();
    RAISE NOTICE 'Dropped function if it existed';
END $$;

-- Drop table and all dependent objects if exists
DO $$
BEGIN
    DROP TABLE IF EXISTS public.profiles CASCADE;
    RAISE NOTICE 'Dropped profiles table if it existed';
END $$;

-- Final status notification
DO $$
BEGIN
    RAISE NOTICE 'Successfully rolled back profiles table migration';
END $$;

COMMIT;
