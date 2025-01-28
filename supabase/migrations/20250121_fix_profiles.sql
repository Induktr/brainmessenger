-- Fix profiles table constraints and add automatic timestamp updates

-- First drop all policies that might reference the profiles table
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Drop any triggers that might depend on the table
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Drop the profiles table with CASCADE to handle dependencies
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create the profiles table with correct foreign key reference
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    username TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create the function for updating timestamps with fixed search path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$;

-- Ensure the function owner has proper permissions
ALTER FUNCTION public.handle_updated_at() OWNER TO postgres;

-- Create the trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create the RLS policies with correct column reference
CREATE POLICY "Users can view all profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = auth_user_id);

-- Recreate any foreign key constraints that might have been dropped
ALTER TABLE public.chats
    DROP CONSTRAINT IF EXISTS chats_created_by_fkey,
    ADD CONSTRAINT chats_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- First add the new column to chat_members if it doesn't exist
DO $$ 
BEGIN
    -- Add auth_user_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'chat_members' 
        AND column_name = 'auth_user_id'
    ) THEN
        ALTER TABLE public.chat_members 
        ADD COLUMN auth_user_id UUID;

        -- If user_id exists, copy data from user_id to auth_user_id
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'chat_members' 
            AND column_name = 'user_id'
        ) THEN
            UPDATE public.chat_members 
            SET auth_user_id = user_id;
        END IF;
    END IF;
END $$;

-- Now we can safely add the constraint
ALTER TABLE public.chat_members
    DROP CONSTRAINT IF EXISTS chat_members_user_id_fkey,
    DROP CONSTRAINT IF EXISTS chat_members_auth_user_id_fkey,
    ADD CONSTRAINT chat_members_auth_user_id_fkey 
    FOREIGN KEY (auth_user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;

-- Finally, drop the old user_id column if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'chat_members' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.chat_members 
        DROP COLUMN user_id;
    END IF;
END $$;
