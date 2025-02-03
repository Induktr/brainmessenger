import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/supabase';
import { useToast } from '@/hooks/use-toast';
import { logOnce } from '@/lib/utils';
import { logger } from '@/lib/logger';
interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
}

export const useProfile = () => {
  const [state, setState] = useState<ProfileState>({
    profile: null,
    loading: false,
    error: null
  });

  const { toast } = useToast();

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      logger.debug(`[${window.performance.now().toFixed(0)}] fetchProfile started for user: ${userId}`);

      if (!userId) {
        throw new Error('User ID is required to fetch profile');
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Profile not found
          console.warn(`Profile not found for user: ${userId}`);
          logger.debug(`[${window.performance.now().toFixed(0)}] fetchProfile - Profile not found for user: ${userId}`);
          return null;
        }
        logger.error(`[${window.performance.now().toFixed(0)}] fetchProfile - Supabase error:`, error);
        throw error;
      }

      if (!profile) {
        console.warn(`No profile data returned for user: ${userId}`);
        logger.warn(`[${window.performance.now().toFixed(0)}] fetchProfile - No profile data returned for user: ${userId}`);
        return null;
      }

      setState(prev => ({
        ...prev,
        profile,
        loading: false,
        error: null
      }));
      logger.debug(`[${window.performance.now().toFixed(0)}] fetchProfile success for user: ${userId}`, { profile });

      return profile;
    } catch (error) {
      logOnce('fetch-profile-error', 'Error fetching profile:', error);
      logger.error(`[${window.performance.now().toFixed(0)}] fetchProfile error:`, error);

      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Failed to fetch profile')
      }));

      toast({
        variant: 'destructive',
        title: 'Profile Error',
        description: error instanceof Error ? error.message : 'Failed to fetch profile',
      });

      return null;
    }
  }, [toast]);

  const updateProfile = useCallback(async (userId: string, updates: Partial<Profile>) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      if (!userId) {
        throw new Error('User ID is required to update profile');
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        profile: profile || prev.profile,
        loading: false,
        error: null
      }));

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully',
      });

      return true;
    } catch (error) {
      logOnce('update-profile-error', 'Error updating profile:', error);
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Failed to update profile')
      }));

      toast({
        variant: 'destructive',
        title: 'Profile Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
      });

      return false;
    }
  }, [toast]);

  const createProfile = useCallback(async (userId: string, initialData: Partial<Profile>) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      if (!userId) {
        throw new Error('User ID is required to create profile');
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .insert([{ id: userId, ...initialData }])
        .single();

      if (error) throw error;

      setState(prev => ({
        ...prev,
        profile: profile || prev.profile,
        loading: false,
        error: null
      }));

      toast({
        title: 'Profile Created',
        description: 'Your profile has been created successfully',
      });

      return profile;
    } catch (error) {
      logOnce('create-profile-error', 'Error creating profile:', error);
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Failed to create profile')
      }));

      toast({
        variant: 'destructive',
        title: 'Profile Error',
        description: error instanceof Error ? error.message : 'Failed to create profile',
      });

      return null;
    }
  }, [toast]);

  return {
    ...state,
    fetchProfile,
    updateProfile,
    createProfile
  };
};
