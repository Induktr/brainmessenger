-- Pre-migration safety check
DO $$
DECLARE
    null_username_count INTEGER;
    null_fullname_count INTEGER;
    short_username_count INTEGER;
    short_fullname_count INTEGER;
    existing_trigger_count INTEGER;
BEGIN
    -- Check for NULL values
    SELECT COUNT(*) INTO null_username_count 
    FROM public.profiles WHERE username IS NULL;
    
    SELECT COUNT(*) INTO null_fullname_count 
    FROM public.profiles WHERE full_name IS NULL;
    
    -- Check for too-short values
    SELECT COUNT(*) INTO short_username_count 
    FROM public.profiles WHERE char_length(username) < 3;
    
    SELECT COUNT(*) INTO short_fullname_count 
    FROM public.profiles WHERE char_length(full_name) < 1;
    
    -- Check existing trigger
    SELECT COUNT(*) INTO existing_trigger_count
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created';
    
    -- Report findings
    RAISE NOTICE 'Migration Impact Analysis:';
    RAISE NOTICE '-------------------------';
    RAISE NOTICE 'Profiles with NULL username: %', null_username_count;
    RAISE NOTICE 'Profiles with NULL full_name: %', null_fullname_count;
    RAISE NOTICE 'Profiles with short username: %', short_username_count;
    RAISE NOTICE 'Profiles with short full_name: %', short_fullname_count;
    RAISE NOTICE 'Existing auth trigger count: %', existing_trigger_count;
    
    -- Fail if serious issues found
    IF (null_username_count + null_fullname_count + short_username_count + short_fullname_count) > 0 THEN
        RAISE EXCEPTION 'Unsafe to proceed: Found % profiles requiring updates', 
            (null_username_count + null_fullname_count + short_username_count + short_fullname_count);
    END IF;
END $$;
