import { emailToUsername } from '@/utils/username';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

interface UserSettings {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  visibility: 'public' | 'private';
  email: string | null;
  avatarUrl: string | null;
}

interface SettingsActions {
  setUsername: (username: string) => Promise<void>;
  setDisplayName: (displayName: string) => Promise<void>;
  setBio: (bio: string) => Promise<void>;
  setVisibility: (visibility: 'public' | 'private') => Promise<void>;
  setEmail: (email: string | null) => Promise<void>;
  setAvatarUrl: (url: string | null) => Promise<void>;
  initializeFromEmail: (email: string, userId: string) => Promise<void>;
  loadSettings: (userId: string) => Promise<void>;
}

type SettingsStore = UserSettings & SettingsActions;

const persistOptions = {
  name: 'snaploginchat-user-settings',
  storage: {
    getItem: (name: string) => {
      const str = localStorage.getItem(name);
      return str ? JSON.parse(str) : null;
    },
    setItem: (name: string, value: unknown) => {
      localStorage.setItem(name, JSON.stringify(value));
    },
    removeItem: (name: string) => localStorage.removeItem(name),
  },
};

// Convert from store format to database format
function mapSettingsToProfile(settings: Partial<UserSettings>): Database['public']['Tables']['profiles']['Update'] {
  return {
    username: settings.username,
    email: settings.email,
    display_name: settings.displayName,
    bio: settings.bio,
    visibility: settings.visibility,
    avatar_url: settings.avatarUrl,
    updated_at: new Date().toISOString()
  };
}

// Convert from database format to store format
function mapProfileToSettings(profile: Database['public']['Tables']['profiles']['Row']): UserSettings {
  return {
    id: profile.id,
    username: profile.username,
    email: profile.email,
    displayName: profile.display_name,
    bio: profile.bio,
    visibility: profile.visibility,
    avatarUrl: profile.avatar_url
  };
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state with required fields
      id: '',
      username: '',
      displayName: '',
      bio: '',
      visibility: 'public',
      email: null,
      avatarUrl: null,

      // Actions with Supabase integration
      setUsername: async (username: string) => {
        const update = mapSettingsToProfile({ username });
        const { error } = await supabase
          .from('profiles')
          .update(update)
          .eq('id', get().id);
        
        if (error) throw error;
        set({ username });
      },

      setDisplayName: async (displayName: string) => {
        const update = mapSettingsToProfile({ displayName });
        const { error } = await supabase
          .from('profiles')
          .update(update)
          .eq('id', get().id);
        
        if (error) throw error;
        set({ displayName });
      },

      setBio: async (bio: string) => {
        const update = mapSettingsToProfile({ bio });
        const { error } = await supabase
          .from('profiles')
          .update(update)
          .eq('id', get().id);
        
        if (error) throw error;
        set({ bio });
      },

      setVisibility: async (visibility: 'public' | 'private') => {
        const update = mapSettingsToProfile({ visibility });
        const { error } = await supabase
          .from('profiles')
          .update(update)
          .eq('id', get().id);
        
        if (error) throw error;
        set({ visibility });
      },

      setEmail: async (email: string | null) => {
        if (!email) return;
        const update = mapSettingsToProfile({ email });
        const { error } = await supabase
          .from('profiles')
          .update(update)
          .eq('id', get().id);
        
        if (error) throw error;
        set({ email });
      },

      setAvatarUrl: async (url: string | null) => {
        const update = mapSettingsToProfile({ avatarUrl: url });
        const { error } = await supabase
          .from('profiles')
          .update(update)
          .eq('id', get().id);
        
        if (error) throw error;
        set({ avatarUrl: url });
      },

      initializeFromEmail: async (email: string, userId: string) => {
        const username = emailToUsername(email);
        const now = new Date().toISOString();
        
        const profile: ProfileInsert = {
          id: userId,
          email,
          username,
          display_name: username,
          bio: '',
          visibility: 'public',
          avatar_url: null,
          updated_at: now
        };
        
        const { error } = await supabase
          .from('profiles')
          .upsert(profile);
        
        if (error) throw error;
        set({ 
          id: userId, 
          email, 
          username, 
          displayName: username,
          bio: '',
          visibility: 'public',
          avatarUrl: null
        });
      },

      loadSettings: async (userId: string) => {
        try {
          const { data: existingProfile, error: queryError } = await supabase
            .from('profiles')
            .select()
            .eq('id', userId)
            .single();
          
          if (queryError) {
            // Check if it's a "not found" error
            if (queryError.code === 'PGRST116') {
              // Create default profile for new users
              const defaultProfile: Database['public']['Tables']['profiles']['Insert'] = {
                id: userId,
                username: '',
                email: null,
                display_name: '',
                bio: '',
                visibility: 'private',
                avatar_url: null,
                updated_at: new Date().toISOString()
              };

              const { error: insertError } = await supabase
                .from('profiles')
                .insert([defaultProfile]);

              if (insertError) {
                console.error('Failed to create default profile:', insertError);
                return;
              }

              set(mapProfileToSettings(defaultProfile as Database['public']['Tables']['profiles']['Row']));
              return;
            }

            console.error('Error loading settings:', queryError);
            return;
          }

          if (!existingProfile) {
            console.error('No profile data returned');
            return;
          }

          set(mapProfileToSettings(existingProfile));
        } catch (err) {
          console.error('Failed to load settings:', err);
        }
      },
    }),
    persistOptions 
  )
);
