-- Drop existing function first
DROP FUNCTION IF EXISTS public.update_user_avatar(UUID, TEXT, TIMESTAMPTZ);

-- Create function to update user avatar in both auth and profiles
CREATE OR REPLACE FUNCTION public.update_user_avatar(
    user_id UUID,
    new_avatar_url TEXT,
    timestamp_param TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- Update auth.users metadata
    UPDATE auth.users
    SET raw_user_meta_data = 
        COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object('avatar_url', new_avatar_url)
    WHERE id = user_id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows = 0 THEN
        RAISE EXCEPTION 'User not found in auth.users';
    END IF;

    -- Update profiles table
    UPDATE public.profiles
    SET 
        avatar_url = new_avatar_url,
        updated_at = timestamp_param
    WHERE id = user_id;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows = 0 THEN
        RAISE EXCEPTION 'User not found in profiles';
    END IF;

    -- Return the new avatar URL
    RETURN new_avatar_url;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_avatar(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

-- Create policy to allow users to update their own avatar
DROP POLICY IF EXISTS "Users can update their own avatar" ON public.profiles;
CREATE POLICY "Users can update their own avatar"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Ensure avatar_url column exists and is properly indexed
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url text;
    END IF;
END $$;

-- Create index for avatar_url if it doesn't exist
DROP INDEX IF EXISTS idx_profiles_avatar_url;
CREATE INDEX idx_profiles_avatar_url ON public.profiles(avatar_url);
