-- Drop existing backup schema if it exists
DROP SCHEMA IF EXISTS backup_20250123 CASCADE;

-- Create fresh backup schema
CREATE SCHEMA backup_20250123;

-- Start transaction
BEGIN;

-- Save current table structure with error handling
DO $$
BEGIN
    CREATE TABLE backup_20250123.table_structure AS
    SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
    FROM 
        information_schema.columns
    WHERE 
        table_name = 'chat_members';
EXCEPTION 
    WHEN duplicate_table THEN
        NULL; -- Table already exists, continue
END $$;

-- Save current policies with error handling
DO $$
BEGIN
    CREATE TABLE backup_20250123.policies AS
    SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
    FROM 
        pg_policies
    WHERE 
        tablename = 'chat_members';
EXCEPTION 
    WHEN duplicate_table THEN
        NULL; -- Table already exists, continue
END $$;

-- Save current constraints with error handling
DO $$
BEGIN
    CREATE TABLE backup_20250123.constraints AS
    SELECT 
        tc.constraint_name,
        tc.constraint_type,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM 
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
    WHERE 
        tc.table_name = 'chat_members';
EXCEPTION 
    WHEN duplicate_table THEN
        NULL; -- Table already exists, continue
END $$;

-- Backup actual data with error handling
DO $$
BEGIN
    CREATE TABLE backup_20250123.chat_members AS
    SELECT * FROM public.chat_members;
EXCEPTION 
    WHEN duplicate_table THEN
        NULL; -- Table already exists, continue
END $$;

-- Verify backup
DO $$
DECLARE
    original_count INTEGER;
    backup_count INTEGER;
    table_exists BOOLEAN;
BEGIN
    -- Check if backup table exists
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables 
        WHERE table_schema = 'backup_20250123'
        AND table_name = 'chat_members'
    ) INTO table_exists;

    IF NOT table_exists THEN
        RAISE EXCEPTION 'Backup tables were not created successfully';
    END IF;

    -- Compare counts
    SELECT COUNT(*) INTO original_count FROM public.chat_members;
    SELECT COUNT(*) INTO backup_count FROM backup_20250123.chat_members;
    
    IF original_count != backup_count THEN
        RAISE EXCEPTION 'Backup verification failed: Original count % != Backup count %', 
            original_count, backup_count;
    END IF;

    -- Verify other backup tables
    IF NOT EXISTS (SELECT 1 FROM backup_20250123.table_structure) THEN
        RAISE EXCEPTION 'Table structure backup is empty';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM backup_20250123.policies) THEN
        RAISE EXCEPTION 'Policies backup is empty';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM backup_20250123.constraints) THEN
        RAISE EXCEPTION 'Constraints backup is empty';
    END IF;
END $$;

COMMIT;

-- Show backup summary
SELECT 
    (SELECT COUNT(*) FROM backup_20250123.chat_members) as data_rows,
    (SELECT COUNT(*) FROM backup_20250123.table_structure) as structure_columns,
    (SELECT COUNT(*) FROM backup_20250123.policies) as policies_count,
    (SELECT COUNT(*) FROM backup_20250123.constraints) as constraints_count;
