-- Create backup with validation
BEGIN;

-- Create backup schema with timestamp to avoid conflicts
CREATE SCHEMA IF NOT EXISTS backup_20250123;

-- Save current table structure
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

-- Save current policies
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

-- Save current constraints
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

-- Backup actual data
CREATE TABLE backup_20250123.chat_members AS
SELECT * FROM public.chat_members;

-- Verify backup
DO $$
DECLARE
    original_count INTEGER;
    backup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO original_count FROM public.chat_members;
    SELECT COUNT(*) INTO backup_count FROM backup_20250123.chat_members;
    
    IF original_count != backup_count THEN
        RAISE EXCEPTION 'Backup verification failed: Original count % != Backup count %', 
            original_count, backup_count;
    END IF;
END $$;

COMMIT;
