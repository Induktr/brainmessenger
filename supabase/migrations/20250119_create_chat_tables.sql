-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their chats" ON public.chats;
DROP POLICY IF EXISTS "Users can create chats" ON public.chats;
DROP POLICY IF EXISTS "Users can view chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can join chats" ON public.chat_members;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON public.messages;
DROP TRIGGER IF EXISTS trigger_update_chat_last_message ON public.messages;
DROP FUNCTION IF EXISTS public.update_conversation_last_message();
DROP FUNCTION IF EXISTS public.update_chat_last_message();

-- Drop tables with CASCADE to handle dependencies
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.chat_members CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.chats CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create chats table for group chats
CREATE TABLE public.chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_group BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_message JSONB,
    pinned BOOLEAN DEFAULT false
);

-- Create chat members table
CREATE TABLE public.chat_members (
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (chat_id, user_id)
);

-- Create conversations table for direct messages
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    last_message JSONB,
    CONSTRAINT unique_conversation UNIQUE (user1_id, user2_id)
);

-- Create messages table that works with both chats and conversations
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_read BOOLEAN DEFAULT false,
    type TEXT DEFAULT 'text',
    reactions JSONB DEFAULT '{}',
    CONSTRAINT message_parent_check CHECK (
        (conversation_id IS NOT NULL AND chat_id IS NULL) OR
        (conversation_id IS NULL AND chat_id IS NOT NULL)
    )
);

-- Create indexes for performance
CREATE INDEX idx_conversations_users ON public.conversations(user1_id, user2_id);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_chat ON public.messages(chat_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_chat_members ON public.chat_members(chat_id, user_id);

-- Create function for updating conversation last_message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.conversation_id IS NOT NULL THEN
        UPDATE public.conversations
        SET last_message = jsonb_build_object(
            'id', NEW.id,
            'content', NEW.content,
            'created_at', NEW.created_at,
            'sender_id', NEW.sender_id,
            'is_read', NEW.is_read,
            'type', NEW.type,
            'reactions', NEW.reactions
        ),
        updated_at = clock_timestamp()
        WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function for updating chat last_message
CREATE OR REPLACE FUNCTION public.update_chat_last_message()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.chat_id IS NOT NULL THEN
        UPDATE public.chats
        SET last_message = jsonb_build_object(
            'id', NEW.id,
            'content', NEW.content,
            'created_at', NEW.created_at,
            'sender_id', NEW.sender_id,
            'type', NEW.type,
            'reactions', NEW.reactions
        ),
        updated_at = clock_timestamp()
        WHERE id = NEW.chat_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Secure the functions
REVOKE ALL ON FUNCTION public.update_conversation_last_message() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_chat_last_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_conversation_last_message() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_chat_last_message() TO authenticated;

-- Create triggers
CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_conversation_last_message();

CREATE TRIGGER trigger_update_chat_last_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_chat_last_message();

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations"
    ON public.conversations 
    FOR SELECT
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create conversations"
    ON public.conversations 
    FOR INSERT
    WITH CHECK (auth.uid() IN (user1_id, user2_id));

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations"
    ON public.messages 
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM public.chat_members cm
            WHERE cm.chat_id = chat_id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages"
    ON public.messages 
    FOR INSERT
    WITH CHECK (
        (
            conversation_id IS NOT NULL AND
            EXISTS (
                SELECT 1 FROM public.conversations c
                WHERE c.id = conversation_id
                AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
            )
        ) OR (
            chat_id IS NOT NULL AND
            EXISTS (
                SELECT 1 FROM public.chat_members cm
                WHERE cm.chat_id = chat_id
                AND cm.user_id = auth.uid()
            )
        )
        AND sender_id = auth.uid()
    );

-- RLS Policies for chats
CREATE POLICY "Users can view their chats"
    ON public.chats
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_members cm
            WHERE cm.chat_id = id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create chats"
    ON public.chats
    FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- RLS Policies for chat members
CREATE POLICY "Users can view chat members"
    ON public.chat_members
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_members cm
            WHERE cm.chat_id = chat_id
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join chats"
    ON public.chat_members
    FOR INSERT
    WITH CHECK (user_id = auth.uid());
