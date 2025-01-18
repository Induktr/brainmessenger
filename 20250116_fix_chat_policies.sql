-- Drop existing policies to clean up
DROP POLICY IF EXISTS "Users can view their own chat members" ON "public"."chat_members";
DROP POLICY IF EXISTS "Users can insert their own chat members" ON "public"."chat_members";
DROP POLICY IF EXISTS "Users can update their own chat members" ON "public"."chat_members";
DROP POLICY IF EXISTS "Users can delete their own chat members" ON "public"."chat_members";

-- Enable RLS on chat_members table
ALTER TABLE "public"."chat_members" ENABLE ROW LEVEL SECURITY;

-- Create new policies without circular references
CREATE POLICY "Users can view their own chat members"
ON "public"."chat_members"
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

CREATE POLICY "Users can insert their own chat members"
ON "public"."chat_members"
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can update their own chat members"
ON "public"."chat_members"
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can delete their own chat members"
ON "public"."chat_members"
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
);
