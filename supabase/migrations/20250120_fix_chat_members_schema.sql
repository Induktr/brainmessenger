-- Fix chat_members table relationships
BEGIN;

-- Drop existing constraints if they exist
ALTER TABLE IF EXISTS chat_members 
  DROP CONSTRAINT IF EXISTS chat_members_pkey,
  DROP CONSTRAINT IF EXISTS chat_members_profile_id_fkey,
  DROP CONSTRAINT IF EXISTS chat_members_chat_id_fkey,
  DROP CONSTRAINT IF EXISTS chat_members_user_id_fkey;

-- Rename user_id column to profile_id if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'chat_members' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE chat_members RENAME COLUMN user_id TO profile_id;
  ELSE
    -- Add profile_id column if neither exists
    ALTER TABLE chat_members ADD COLUMN profile_id UUID NOT NULL;
  END IF;
END $$;

-- Ensure proper primary key
ALTER TABLE chat_members
  ADD CONSTRAINT chat_members_pkey 
  PRIMARY KEY (chat_id, profile_id);

-- Add foreign key for profiles
ALTER TABLE chat_members
  ADD CONSTRAINT chat_members_profile_id_fkey 
  FOREIGN KEY (profile_id) 
  REFERENCES profiles(id)
  ON DELETE CASCADE;

-- Add foreign key for chats
ALTER TABLE chat_members
  ADD CONSTRAINT chat_members_chat_id_fkey 
  FOREIGN KEY (chat_id) 
  REFERENCES chats(id)
  ON DELETE CASCADE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_members_profile_id 
  ON chat_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id 
  ON chat_members(chat_id);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
