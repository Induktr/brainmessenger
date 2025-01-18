-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create storage schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS storage;

-- Ensure buckets table exists with proper structure
CREATE TABLE IF NOT EXISTS storage.buckets (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    owner uuid REFERENCES auth.users,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[]
);

-- Temporarily disable RLS to allow bucket creation
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Create the user-content bucket
INSERT INTO storage.buckets (
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types
)
VALUES (
    'user-content',
    'user-content',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    updated_at = now();

-- Re-enable RLS
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Owner Delete Access" ON storage.objects;

-- Create bucket-level policies
CREATE POLICY "Public Bucket Access"
ON storage.buckets FOR SELECT TO PUBLIC
USING (true);

-- Policy for public read access to avatars
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'user-content' 
    AND (SPLIT_PART(name, '/', 1) = 'avatars')
);

-- Policy for authenticated users to upload their own avatars
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'user-content'
    AND auth.role() = 'authenticated'
    AND (SPLIT_PART(name, '/', 1) = 'avatars')
    AND (SPLIT_PART(name, '/', 2) = auth.uid()::text)
);

-- Policy for users to delete their own avatars
CREATE POLICY "Owner Delete Access"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'user-content'
    AND auth.role() = 'authenticated'
    AND (SPLIT_PART(name, '/', 1) = 'avatars')
    AND (SPLIT_PART(name, '/', 2) = auth.uid()::text)
);

-- Enable RLS on objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verify bucket creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets 
        WHERE id = 'user-content'
    ) THEN
        RAISE EXCEPTION 'Bucket creation failed';
    END IF;
END $$;
