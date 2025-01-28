-- Rollback script for chat_members changes
BEGIN;

-- Step 1: Verify backup exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.schemata 
    WHERE schema_name = 'backup_20250123'
  ) THEN
    RAISE EXCEPTION 'Backup schema not found. Cannot proceed with rollback.';
  END IF;
END $$;

-- Step 2: Drop current policies
DROP POLICY IF EXISTS "Users can view their own chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can insert their own chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can update their own chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can delete their own chat members" ON public.chat_members;

-- Step 3: Drop current constraints
ALTER TABLE public.chat_members
  DROP CONSTRAINT IF EXISTS chat_members_pkey,
  DROP CONSTRAINT IF EXISTS chat_members_profile_id_fkey;

-- Step 4: Rename profile_id back to user_id
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'chat_members' 
    AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE public.chat_members RENAME COLUMN profile_id TO user_id;
  END IF;
END $$;

-- Step 5: Restore original constraints
ALTER TABLE public.chat_members
  ADD CONSTRAINT chat_members_pkey PRIMARY KEY (chat_id, user_id),
  ADD CONSTRAINT chat_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Step 6: Restore original policies
CREATE POLICY "Users can view their own chat members"
ON public.chat_members
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

CREATE POLICY "Users can insert their own chat members"
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can update their own chat members"
ON public.chat_members
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can delete their own chat members"
ON public.chat_members
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
);

-- Step 7: Verify data integrity
DO $$ 
DECLARE
  original_count INTEGER;
  current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_count FROM backup_20250123.chat_members;
  SELECT COUNT(*) INTO current_count FROM public.chat_members;
  
  IF original_count != current_count THEN
    RAISE WARNING 'Data count mismatch: Original=%, Current=%', original_count, current_count;
  END IF;
END $$;

-- Step 8: Restore data if needed (uncomment if necessary)
-- DELETE FROM public.chat_members;
-- INSERT INTO public.chat_members 
-- SELECT * FROM backup_20250123.chat_members;

COMMIT;

-- Optional: Clean up backup (uncomment if you want to remove backup)
-- DROP SCHEMA backup_20250123 CASCADE;
