-- Pre-flight safety check with connection handling
DO $$
DECLARE
    existing_table BOOLEAN;
    existing_policies INTEGER;
    existing_triggers INTEGER;
    existing_columns TEXT[];
    auth_users_exists BOOLEAN;
    different_columns TEXT[];
    retry_count INTEGER := 0;
    max_retries INTEGER := 3;
    retry_interval INTEGER := 1; -- seconds
BEGIN
    -- Retry loop for connection issues
    WHILE retry_count < max_retries LOOP
    BEGIN
        -- Check auth.users dependency
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'auth' 
            AND table_name = 'users'
        ) INTO auth_users_exists;
        
        IF NOT auth_users_exists THEN
            RAISE EXCEPTION 'auth.users table does not exist - required for foreign key constraint';
        END IF;

        -- Check if profiles table exists
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'profiles'
        ) INTO existing_table;

        IF existing_table THEN
            -- Count existing policies with error handling
            BEGIN
                SELECT COUNT(*) INTO existing_policies
                FROM pg_policies
                WHERE schemaname = 'public' AND tablename = 'profiles';
            EXCEPTION WHEN OTHERS THEN
                existing_policies := 0;
                RAISE NOTICE 'Could not check existing policies: %', SQLERRM;
            END;

            -- Count existing triggers with error handling
            BEGIN
                SELECT COUNT(*) INTO existing_triggers
                FROM pg_trigger
                WHERE tgrelid = 'public.profiles'::regclass;
            EXCEPTION WHEN OTHERS THEN
                existing_triggers := 0;
                RAISE NOTICE 'Could not check existing triggers: %', SQLERRM;
            END;

            -- Get existing columns
            SELECT array_agg(column_name::TEXT) INTO existing_columns
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'profiles';

            -- Compare with expected columns
            SELECT array_agg(col) INTO different_columns
            FROM (
                SELECT unnest(existing_columns) AS col
                EXCEPT
                SELECT unnest(ARRAY['id', 'username', 'full_name', 'avatar_url', 'created_at', 'updated_at'])
            ) diff;

            -- Report findings
            RAISE NOTICE E'\nPre-flight Check Results:';
            RAISE NOTICE '-------------------------';
            RAISE NOTICE 'Existing policies to be dropped: %', existing_policies;
            RAISE NOTICE 'Existing triggers to be dropped: %', existing_triggers;
            IF different_columns IS NOT NULL AND array_length(different_columns, 1) > 0 THEN
                RAISE NOTICE 'Additional columns that will be preserved: %', array_to_string(different_columns, ', ');
            END IF;

            -- Warn if significant changes
            IF existing_policies > 0 OR existing_triggers > 0 OR 
               (different_columns IS NOT NULL AND array_length(different_columns, 1) > 0) THEN
                RAISE WARNING 'This migration will modify existing database objects!';
            END IF;

            -- Create backup if table exists
            RAISE NOTICE E'\nCreating backup...';
            BEGIN
                EXECUTE 'CREATE SCHEMA IF NOT EXISTS backup_' || to_char(NOW(), 'YYYYMMDD');
                EXECUTE 'CREATE TABLE IF NOT EXISTS backup_' || to_char(NOW(), 'YYYYMMDD') || '.profiles AS SELECT * FROM public.profiles';
                RAISE NOTICE 'Backup created successfully in schema backup_%', to_char(NOW(), 'YYYYMMDD');
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Failed to create backup: %', SQLERRM;
                RAISE EXCEPTION 'Backup creation failed - aborting for safety';
            END;
        END IF;

        -- If we get here, everything worked
        EXIT;

    EXCEPTION WHEN OTHERS THEN
        retry_count := retry_count + 1;
        IF retry_count < max_retries THEN
            RAISE NOTICE 'Connection attempt % of % failed: %', retry_count, max_retries, SQLERRM;
            PERFORM pg_sleep(retry_interval);
        ELSE
            RAISE EXCEPTION 'Failed to complete preflight check after % attempts: %', max_retries, SQLERRM;
        END IF;
    END;
    END LOOP;

    RAISE NOTICE E'\nPre-flight check completed successfully!';
END $$;
