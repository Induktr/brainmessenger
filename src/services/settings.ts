import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/supabase';

export async function saveProfile(profile: Partial<Profile>): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(profile)
      .eq('id', profile.id);

    if (error) throw error;
  } catch (error) {
    console.error('Error saving profile:', error);
    throw new Error('Failed to save profile settings');
  }
} 