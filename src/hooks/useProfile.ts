import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/supabase';
import { useAuth } from '@/hooks/useAuth';

// Type guard for profile validation
const isValidProfile = (profile: unknown): profile is Profile => {
  if (!profile || typeof profile !== 'object') return false;
  const p = profile as Partial<Profile>;
  return typeof p.id === 'string' &&
    typeof p.email === 'string' &&
    (p.username === null || typeof p.username === 'string') &&
    (p.display_name === null || typeof p.display_name === 'string') &&
    (p.avatar_url === null || typeof p.avatar_url === 'string') &&
    (typeof p.bio === 'string' || p.bio === undefined) &&
    (p.visibility === 'public' || p.visibility === 'private' || p.visibility === undefined);
};

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        // Try to fetch existing profile
        const { data: existingProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user!.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          throw fetchError;
        }

        if (existingProfile && isValidProfile(existingProfile)) {
          setProfile(existingProfile);
          return;
        }

        // Create new profile if none exists
        const emailPrefix = user!.email?.split('@')[0] || '';
        const userIdPrefix = user!.id.substring(0, 8);
        const defaultUsername = emailPrefix || `user_${userIdPrefix}`;
        const defaultDisplayName = emailPrefix || `User ${userIdPrefix}`;

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([
            {
              id: user!.id,
              email: user!.email || '',
              username: defaultUsername,
              display_name: defaultDisplayName,
              avatar_url: null,
              bio: '',
              visibility: 'public' as const
            }
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        
        if (newProfile && isValidProfile(newProfile)) {
          setProfile(newProfile);
        } else {
          throw new Error('Invalid profile data received from server');
        }

      } catch (err) {
        console.error('Profile loading error:', err);
        setError(err instanceof Error ? err : new Error('Failed to load profile'));
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error('No user logged in');
    if (!profile) throw new Error('No profile loaded');
    
    try {
      setError(null);
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      if (data && isValidProfile(data)) {
        setProfile(data);
        return data;
      }
      
      throw new Error('Invalid profile data received from server');
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err instanceof Error ? err : new Error('Failed to update profile'));
      throw err;
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
  };
}
