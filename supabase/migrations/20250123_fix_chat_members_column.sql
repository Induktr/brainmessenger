-- First check if we need to revert the previous migration attempt
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

-- Now properly rename the column and update constraints
ALTER TABLE chat_members 
  DROP CONSTRAINT IF EXISTS chat_members_pkey,
  DROP CONSTRAINT IF EXISTS chat_members_user_id_fkey;

-- Rename the column
ALTER TABLE chat_members RENAME COLUMN user_id TO profile_id;

-- Recreate the primary key and foreign key constraints
ALTER TABLE chat_members
  ADD CONSTRAINT chat_members_pkey PRIMARY KEY (chat_id, profile_id),
  ADD CONSTRAINT chat_members_profile_id_fkey 
    FOREIGN KEY (profile_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
