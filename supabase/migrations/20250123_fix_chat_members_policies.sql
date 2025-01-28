-- Ensure column exists before creating policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'chat_members' 
    AND column_name = 'profile_id'
  ) THEN
    RAISE EXCEPTION 'profile_id column must exist before creating policies';
  END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own chat members" ON "public"."chat_members";
DROP POLICY IF EXISTS "Users can insert their own chat members" ON "public"."chat_members";
DROP POLICY IF EXISTS "Users can update their own chat members" ON "public"."chat_members";
DROP POLICY IF EXISTS "Users can delete their own chat members" ON "public"."chat_members";

-- Create new policies using profile_id instead of user_id
CREATE POLICY "Users can view their own chat members"
ON "public"."chat_members"
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
ON "public"."chat_members"
FOR INSERT
TO authenticated
WITH CHECK (
  profile_id = auth.uid()
);

CREATE POLICY "Users can update their own chat members"
ON "public"."chat_members"
FOR UPDATE
TO authenticated
USING (
  profile_id = auth.uid()
)
WITH CHECK (
  profile_id = auth.uid()
);

CREATE POLICY "Users can delete their own chat members"
ON "public"."chat_members"
FOR DELETE
TO authenticated
USING (
  profile_id = auth.uid()
);
