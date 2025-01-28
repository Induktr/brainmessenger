import { emailToUsername } from '@/utils/username';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

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
  saveProfile: () => Promise<void>;
  verifySession: () => Promise<boolean>;
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
    email: settings.email as string | undefined, // Type cast here
    display_name: settings.displayName,
    bio: settings.bio,
    visibility: settings.visibility,
    avatar_url: settings.avatarUrl,
  };
}

// Convert from database format to store format
function mapProfileToSettings(profile: Database['public']['Tables']['profiles']['Row']): UserSettings {
  return {
    id: profile.id,
    username: profile.username || '',
    displayName: profile.display_name || '',
    bio: profile.bio || '',
    visibility: profile.visibility || 'public',
    email: profile.email || null,
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
                email: undefined, // Set email to undefined
                display_name: '',
                bio: '',
                visibility: 'public',
                avatar_url: null,
                updated_at: new Date().toISOString()
              };
              
              const { error: insertError } = await supabase
                .from('profiles')
                .insert(defaultProfile);
              
              if (insertError) throw insertError;
              
              set({
                id: userId,
                username: '',
                email: null,
                displayName: '',
                bio: '',
                visibility: 'public',
                avatarUrl: null
              });
              return;
            }
            throw queryError;
          }
          
          // Convert existing profile to settings
          const settings = mapProfileToSettings(existingProfile);
          set(settings);
        } catch (error) {
          console.error('Error loading settings:', error);
          throw error;
        }
      },
      
      verifySession: async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Session verification error:', error);
            return false;
          }

          if (!session?.access_token) {
            console.warn('No active session found');
            return false;
          }

          // Verify token is valid and not expired
          const tokenParts = session.access_token.split('.');
          if (tokenParts.length !== 3) return false;

          const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')));
          const now = Math.floor(Date.now() / 1000);
          
          if (payload.exp && payload.exp < now) {
            console.warn('Session token has expired');
            return false;
          }

          return true;
        } catch (error) {
          console.error('Session verification failed:', error);
          return false;
        }
      },

      saveProfile: async () => {
        const settings = get();
        const update = mapSettingsToProfile(settings);
        
        try {
          // Verify session before proceeding
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('No active session - user must be authenticated');
          }

          // Add updated_at timestamp
          const updateWithTimestamp = {
            ...update,
            updated_at: new Date().toISOString()
          };

          // Perform the update
          const { error: updateError, data } = await supabase
            .from('profiles')
            .update(updateWithTimestamp)
            .eq('id', settings.id)
            .select()
            .single();

          if (updateError) {
            console.error('Profile update error:', {
              code: updateError.code,
              message: updateError.message,
              details: updateError.details,
              hint: updateError.hint
            });
            
            if (updateError.code === 'PGRST116') {
              throw new Error('Profile not found. Please try logging out and back in.');
            }
            
            if (updateError.code === '42501') {
              throw new Error('You do not have permission to update this profile.');
            }
            
            throw new Error(updateError.message || 'Failed to update profile');
          }

          if (!data) {
            throw new Error('No data returned after update');
          }

          // Update local state with the returned data
          const mappedSettings = mapProfileToSettings(data);
          set(mappedSettings);

          console.log('Profile updated successfully:', mappedSettings);
        } catch (error) {
          console.error('Save profile error:', error);
          throw error;
        }
      },
    }),
    persistOptions
  )
);
