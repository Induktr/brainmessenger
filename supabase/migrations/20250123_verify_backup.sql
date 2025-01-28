-- Detailed backup verification script
-- Check table structure
SELECT 
    'Table Structure' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM backup_20250123.table_structure
ORDER BY column_name;

-- Check policies
SELECT 
    'Policies' as check_type,
    policyname,
    cmd,
    roles,
    qual
FROM backup_20250123.policies
ORDER BY policyname;

-- Check constraints
SELECT 
    'Constraints' as check_type,
    constraint_name,
    constraint_type,
    column_name,
    foreign_table_name,
    foreign_column_name
FROM backup_20250123.constraints
ORDER BY constraint_name;

-- Compare sample data (limit to avoid overwhelming output)
SELECT 
    'Data Sample' as check_type,
    *
FROM backup_20250123.chat_members
LIMIT 5;

-- Show table sizes
SELECT 
    'Size Comparison' as check_type,
    (SELECT COUNT(*) FROM public.chat_members) as original_rows,
    (SELECT COUNT(*) FROM backup_20250123.chat_members) as backup_rows,
    (SELECT COUNT(*) FROM backup_20250123.table_structure) as structure_rows,
    (SELECT COUNT(*) FROM backup_20250123.policies) as policy_rows,
    (SELECT COUNT(*) FROM backup_20250123.constraints) as constraint_rows;
