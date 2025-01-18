-- Drop existing constraint if it exists
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_members_user_id_fkey'
    ) THEN
        ALTER TABLE "public"."chat_members" DROP CONSTRAINT "chat_members_user_id_fkey";
    END IF;
END $$;

-- Add the foreign key constraint with explicit naming
ALTER TABLE "public"."chat_members"
ADD CONSTRAINT "chat_members_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "public"."profiles"("id")
ON DELETE CASCADE;

-- Create index for better query performance if it doesn't exist
DROP INDEX IF EXISTS "chat_members_user_id_idx";
CREATE INDEX "chat_members_user_id_idx"
ON "public"."chat_members" ("user_id");
