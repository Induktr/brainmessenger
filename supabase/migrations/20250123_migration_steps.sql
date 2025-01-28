-- Migration Steps with Safety Checks
-- Step 1: Pre-flight Check
\i '20250123_profiles_preflight_check.sql'

-- Step 2: Verify Backup (if table exists)
DO $$
DECLARE
    backup_schema TEXT;
    backup_count INTEGER;
    original_count INTEGER;
BEGIN
    backup_schema := 'backup_' || to_char(NOW(), 'YYYYMMDD');
    
    -- Get counts if profiles table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) THEN
        -- Count records in original table
        EXECUTE format('SELECT COUNT(*) FROM public.profiles') INTO original_count;
        
        -- Count records in backup
        EXECUTE format('SELECT COUNT(*) FROM %I.profiles', backup_schema) INTO backup_count;
        
        -- Verify counts match
        IF original_count != backup_count THEN
            RAISE EXCEPTION 'Backup verification failed: Original count (%) != Backup count (%)', 
                original_count, backup_count;
        END IF;
        
        RAISE NOTICE 'Backup verified successfully: % records', backup_count;
    END IF;
END $$;

-- Step 3: Apply Schema Changes
\i '20250123_create_profiles_table.sql'

-- Step 4: Verify Migration Success
DO $$
DECLARE
    policy_count INTEGER;
    policy_names TEXT[];
    trigger_exists BOOLEAN;
    not_null_constraints RECORD;
    missing_policies TEXT := '';
BEGIN
    -- Check policies
    SELECT COUNT(*), array_agg(policyname::TEXT)
    INTO policy_count, policy_names
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles';

    -- Check which policies are missing
    IF NOT policy_names @> ARRAY['Enable read access for users'] THEN
        missing_policies := missing_policies || E'\n- Missing "Enable read access for users" policy';
    END IF;
    IF NOT policy_names @> ARRAY['Enable update for users based on user_id'] THEN
        missing_policies := missing_policies || E'\n- Missing "Enable update for users based on user_id" policy';
    END IF;
    IF NOT policy_names @> ARRAY['Enable insert for users'] THEN
        missing_policies := missing_policies || E'\n- Missing "Enable insert for users" policy';
    END IF;
    IF NOT policy_names @> ARRAY['Enable delete for users'] THEN
        missing_policies := missing_policies || E'\n- Missing "Enable delete for users" policy';
    END IF;

    -- Verify trigger
    SELECT EXISTS (
        SELECT FROM pg_trigger
        WHERE tgname = 'set_profiles_updated_at'
        AND tgrelid = 'public.profiles'::regclass
    ) INTO trigger_exists;

    -- Check NOT NULL constraints in detail
    SELECT 
        MAX(CASE WHEN column_name = 'username' THEN is_nullable END) as username_nullable,
        MAX(CASE WHEN column_name = 'full_name' THEN is_nullable END) as fullname_nullable
    INTO not_null_constraints
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name IN ('username', 'full_name');

    -- Report detailed results
    RAISE NOTICE E'\nDetailed Migration Verification Results:';
    RAISE NOTICE '-----------------------------------';
    RAISE NOTICE 'RLS Policies found: % (expected: 4)', policy_count;
    RAISE NOTICE 'Existing policies: %', array_to_string(policy_names, ', ');
    IF missing_policies != '' THEN
        RAISE NOTICE 'Missing policies: %', missing_policies;
    END IF;
    RAISE NOTICE 'Updated_at trigger exists: % (expected: true)', trigger_exists;
    RAISE NOTICE 'Column Constraints:';
    RAISE NOTICE '- username nullable: % (expected: NO)', not_null_constraints.username_nullable;
    RAISE NOTICE '- full_name nullable: % (expected: NO)', not_null_constraints.fullname_nullable;

    -- Verify all components with specific error messages
    IF policy_count != 4 THEN
        RAISE EXCEPTION 'Policy count mismatch. Found % policies, expected 4.%', policy_count, missing_policies;
    END IF;
    
    IF NOT trigger_exists THEN
        RAISE EXCEPTION 'Missing required trigger: set_profiles_updated_at';
    END IF;
    
    IF not_null_constraints.username_nullable = 'YES' OR not_null_constraints.fullname_nullable = 'YES' THEN
        RAISE EXCEPTION 'NOT NULL constraints not set correctly. username_nullable: %, fullname_nullable: %',
            not_null_constraints.username_nullable, not_null_constraints.fullname_nullable;
    END IF;

    RAISE NOTICE E'\nMigration completed and verified successfully!';
END $$;

-- In case of failure, rollback command:
-- \i '20250123_rollback_profiles.sql'
