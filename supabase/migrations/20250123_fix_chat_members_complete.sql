BEGIN;

-- Step 1: Fix the column structure first
DO $$ 
BEGIN
  -- If profile_id exists but is empty/invalid, drop it
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'chat_members' 
    AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE chat_members DROP COLUMN profile_id;
  END IF;

  -- If user_id doesn't exist, recreate it
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'chat_members' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE chat_members ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 2: Update the column name and constraints
ALTER TABLE chat_members 
  DROP CONSTRAINT IF EXISTS chat_members_pkey,
  DROP CONSTRAINT IF EXISTS chat_members_user_id_fkey;

ALTER TABLE chat_members RENAME COLUMN user_id TO profile_id;

ALTER TABLE chat_members
  ADD CONSTRAINT chat_members_pkey PRIMARY KEY (chat_id, profile_id),
  ADD CONSTRAINT chat_members_profile_id_fkey 
    FOREIGN KEY (profile_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Step 3: Drop existing policies
DROP POLICY IF EXISTS "Users can view their own chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can insert their own chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can update their own chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can delete their own chat members" ON public.chat_members;

-- Step 4: Create new policies using the renamed column
CREATE POLICY "Users can view their own chat members"
ON public.chat_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = chat_members.profile_id
    AND profiles.id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own chat members"
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  profile_id = auth.uid()
);

CREATE POLICY "Users can update their own chat members"
ON public.chat_members
FOR UPDATE
TO authenticated
USING (
  profile_id = auth.uid()
)
WITH CHECK (
  profile_id = auth.uid()
);

CREATE POLICY "Users can delete their own chat members"
ON public.chat_members
FOR DELETE
TO authenticated
USING (
  profile_id = auth.uid()
);

COMMIT;
