-- Enable RLS on chats table
ALTER TABLE "public"."chats" ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing chats
CREATE POLICY "Users can view chats they are members of"
ON "public"."chats"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);

-- Create policy for creating chats
CREATE POLICY "Users can create chats"
ON "public"."chats"
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
);

-- Create policy for updating chats
CREATE POLICY "Users can update chats they are members of"
ON "public"."chats"
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_members
    WHERE chat_members.chat_id = chats.id
    AND chat_members.user_id = auth.uid()
  )
);
