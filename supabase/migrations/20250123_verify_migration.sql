-- Verify migration success
DO $$
DECLARE
    policy_count INTEGER;
    trigger_exists BOOLEAN;
    constraint_exists BOOLEAN;
BEGIN
    -- Check policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles';

    -- Check trigger
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_profiles_updated_at'
        AND tgrelid = 'public.profiles'::regclass
    ) INTO trigger_exists;

    -- Check unique constraint
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_user_id'
        AND conrelid = 'public.profiles'::regclass
    ) INTO constraint_exists;

    -- Report results
    RAISE NOTICE 'Migration Verification Results:';
    RAISE NOTICE '----------------------------';
    RAISE NOTICE 'Number of RLS policies: % (expected: 4)', policy_count;
    RAISE NOTICE 'Updated_at trigger exists: % (expected: true)', trigger_exists;
    RAISE NOTICE 'Unique constraint exists: % (expected: true)', constraint_exists;

    -- Verify all components
    IF policy_count != 4 OR NOT trigger_exists OR NOT constraint_exists THEN
        RAISE EXCEPTION 'Migration verification failed. Please check the results above.';
    END IF;

    RAISE NOTICE 'Migration successfully verified!';
END $$;
