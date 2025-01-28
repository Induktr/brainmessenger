-- Create backup schema
CREATE SCHEMA IF NOT EXISTS backup_20250123;

-- Backup the table structure and data
CREATE TABLE backup_20250123.chat_members AS 
SELECT * FROM public.chat_members;

-- Backup the policies
CREATE TABLE backup_20250123.policies AS
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'chat_members';

-- Backup the constraints
CREATE TABLE backup_20250123.constraints AS
SELECT conname, contype, conkey, confkey, confrelid
FROM pg_constraint
WHERE conrelid = 'public.chat_members'::regclass;
