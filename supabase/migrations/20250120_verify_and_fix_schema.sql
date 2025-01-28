-- Comprehensive schema verification and fix
BEGIN;

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create base tables first
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_group BOOLEAN DEFAULT false,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message TEXT,
    last_message_time TIMESTAMPTZ DEFAULT NOW(),
    pinned BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS chat_members (
    chat_id UUID NOT NULL,
    profile_id UUID NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chat_members_pkey PRIMARY KEY (chat_id, profile_id)
);

-- 2. Verify and fix columns
DO $$ 
BEGIN
    -- Add last_message_time if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'chats' 
        AND column_name = 'last_message_time'
    ) THEN
        ALTER TABLE public.chats 
        ADD COLUMN last_message_time TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Ensure last_message_time is timestamptz
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'chats' 
        AND column_name = 'last_message_time' 
        AND data_type != 'timestamp with time zone'
    ) THEN
        ALTER TABLE public.chats 
        ALTER COLUMN last_message_time TYPE TIMESTAMPTZ 
        USING last_message_time::TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Add foreign key constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_members_profile_id_fkey'
        AND table_name = 'chat_members'
    ) THEN
        ALTER TABLE chat_members
        ADD CONSTRAINT chat_members_profile_id_fkey 
        FOREIGN KEY (profile_id) 
        REFERENCES profiles(id)
        ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chat_members_chat_id_fkey'
        AND table_name = 'chat_members'
    ) THEN
        ALTER TABLE chat_members
        ADD CONSTRAINT chat_members_chat_id_fkey 
        FOREIGN KEY (chat_id) 
        REFERENCES chats(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_members_profile_id ON chat_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);

-- 4. Enable RLS on tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies
DO $$ 
BEGIN
    -- Only attempt to drop policies if the table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
        DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chats') THEN
        DROP POLICY IF EXISTS "Users can view their chats" ON chats;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_members') THEN
        DROP POLICY IF EXISTS "Users can view chat members" ON chat_members;
    END IF;
END $$;

-- 6. Create RLS policies
-- RLS for profiles
CREATE POLICY "Users can view all profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- RLS for chats
CREATE POLICY "Users can view their chats"
    ON chats FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_members 
            WHERE chat_members.chat_id = id 
            AND chat_members.profile_id = auth.uid()
        )
    );

-- RLS for chat_members
CREATE POLICY "Users can view chat members"
    ON chat_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_members cm 
            WHERE cm.chat_id = chat_id 
            AND cm.profile_id = auth.uid()
        )
    );

-- 7. Create functions for chat operations
CREATE OR REPLACE FUNCTION get_user_chats(user_uuid UUID)
RETURNS TABLE (
    chat_id UUID,
    chat_name TEXT,
    is_group BOOLEAN,
    last_message TEXT,
    last_message_time TIMESTAMPTZ,
    member_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as chat_id,
        c.name as chat_name,
        c.is_group,
        c.last_message,
        c.last_message_time,
        COUNT(cm.profile_id) as member_count
    FROM public.chats c
    JOIN public.chat_members cm ON c.id = cm.chat_id
    WHERE EXISTS (
        SELECT 1 FROM public.chat_members 
        WHERE chat_id = c.id 
        AND profile_id = user_uuid
    )
    GROUP BY c.id, c.name, c.is_group, c.last_message, c.last_message_time
    ORDER BY c.last_message_time DESC NULLS LAST;
END;
$$;

-- Create function to update chat timestamp
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    UPDATE public.chats
    SET last_message = NEW.content,
        last_message_time = NEW.created_at
    WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$;

-- Create trigger for updating chat timestamp
DROP TRIGGER IF EXISTS update_chat_timestamp_trigger ON messages;
CREATE TRIGGER update_chat_timestamp_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_timestamp();

-- Create updated_at timestamp function
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Create triggers for updated_at timestamps
DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_chats_updated_at ON chats;
CREATE TRIGGER set_chats_updated_at
    BEFORE UPDATE ON public.chats
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_messages_updated_at ON messages;
CREATE TRIGGER set_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Create message handling function
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    chat_exists BOOLEAN;
    is_member BOOLEAN;
BEGIN
    -- Check if chat exists
    SELECT EXISTS (
        SELECT 1 FROM public.chats WHERE id = NEW.chat_id
    ) INTO chat_exists;

    IF NOT chat_exists THEN
        RAISE EXCEPTION 'Chat does not exist';
    END IF;

    -- Check if sender is a member of the chat
    SELECT EXISTS (
        SELECT 1 
        FROM public.chat_members 
        WHERE chat_id = NEW.chat_id 
        AND profile_id = auth.uid()
    ) INTO is_member;

    IF NOT is_member THEN
        RAISE EXCEPTION 'User is not a member of this chat';
    END IF;

    -- Set the sender_id to the current user
    NEW.sender_id = auth.uid();
    
    -- Set timestamps
    NEW.created_at = CURRENT_TIMESTAMP;
    NEW.updated_at = CURRENT_TIMESTAMP;

    -- Update chat's last message and timestamp
    UPDATE public.chats
    SET last_message = NEW.content,
        last_message_time = NEW.created_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.chat_id;

    RETURN NEW;
END;
$$;

-- Create trigger for new messages
DROP TRIGGER IF EXISTS handle_new_message_trigger ON messages;
CREATE TRIGGER handle_new_message_trigger
    BEFORE INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_message();

-- 8. Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- 9. Verify the setup
DO $$ 
DECLARE
    constraint_count INT;
    policy_count INT;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.table_constraints
    WHERE table_name = 'chat_members'
    AND constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY');

    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename IN ('profiles', 'chats', 'chat_members');

    IF constraint_count < 3 THEN
        RAISE EXCEPTION 'Missing required constraints on chat_members table';
    END IF;

    IF policy_count < 4 THEN
        RAISE EXCEPTION 'Missing required RLS policies';
    END IF;
END $$;

COMMIT;
