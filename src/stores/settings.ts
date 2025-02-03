import { emailToUsername } from '@/utils/username';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { AuthApiError } from '@supabase/supabase-js';

// Add retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Add helper for handling auth errors
async function handleAuthError(error: Error, retryCount = 0): Promise<boolean> {
  if (error instanceof AuthApiError && error.message.includes('Invalid Refresh Token')) {
    if (retryCount >= MAX_RETRIES) {
      return false;
    }

    try {
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;
      if (!session) throw new Error('No session after refresh');
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return true;
    } catch (refreshError) {
      console.error('Session refresh failed:', refreshError);
      return false;
    }
  }
  return false;
}

// Add wrapper for API calls
async function withAuthRetry<T>(apiCall: () => Promise<T>): Promise<T> {
  let retryCount = 0;
  
  while (true) {
    try {
      return await apiCall();
    } catch (error) {
      if (error instanceof Error) {
        const shouldRetry = await handleAuthError(error, retryCount);
        if (shouldRetry && retryCount < MAX_RETRIES) {
          retryCount++;
          continue;
        }
      }
      throw error;
    }
  }
}

type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];

interface UserSettings {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  visibility: 'public' | 'private';
  email: string | null;
  avatarUrl: string | null;
  lastUpdateTime: string;
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
// Helper function to refresh session
async function refreshSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    throw new Error('Failed to get current session');
  }

  if (!session) {
    const { data: { session: refreshedSession }, error: refreshError } = 
      await supabase.auth.refreshSession();
    
    if (refreshError) {
      throw new Error('Failed to refresh session');
    }
    
    return refreshedSession;
  }

  return session;
}

function mapProfileToSettings(profile: Database['public']['Tables']['profiles']['Row']): UserSettings {
  return {
    id: profile.id,
    username: profile.username || '',
    displayName: profile.display_name || '',
    bio: profile.bio || '',
    visibility: profile.visibility || 'public',
    email: profile.email || null,
    avatarUrl: profile.avatar_url,
    lastUpdateTime: profile.updated_at || new Date().toISOString()
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
        lastUpdateTime: new Date().toISOString(),

      // Actions with Supabase integration
        setUsername: async (username: string) => {
        const update = mapSettingsToProfile({ username });
        
        try {
          await withAuthRetry(async () => {
          const { error } = await supabase
            .from('profiles')
            .update(update)
            .eq('id', get().id);
          
          if (error) throw error;
          set({ username });
          });
        } catch (error) {
          if (error instanceof AuthApiError) {
          throw new Error('Your session has expired. Please log in again.');
          }
          throw error;
        }
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
            avatarUrl: null,
            lastUpdateTime: now
        });
      },

        loadSettings: async (userId: string) => {
        try {
          await withAuthRetry(async () => {
          const { data: existingProfile, error: queryError } = await supabase
            .from('profiles')
            .select()
            .eq('id', userId)
            .single();
          
          if (queryError) {
            if (queryError.code === 'PGRST116') {
            // Create default profile for new users
            const defaultProfile: Database['public']['Tables']['profiles']['Insert'] = {
              id: userId,
              username: '',
              email: undefined,
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
              avatarUrl: null,
              lastUpdateTime: new Date().toISOString()
            });
            return;
            }
            throw queryError;
          }
          
          const settings = mapProfileToSettings(existingProfile);
          set(settings);
          });
        } catch (error) {
          console.error('Error loading settings:', error);
          if (error instanceof AuthApiError) {
          throw new Error('Your session has expired. Please log in again.');
          }
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

          // Try to refresh the session if it's close to expiring
          const tokenPayload = JSON.parse(atob(session.access_token.split('.')[1]));
          const expiresIn = tokenPayload.exp - Math.floor(Date.now() / 1000);
          
          if (expiresIn < 300) { // Less than 5 minutes until expiry
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Session refresh failed:', refreshError);
            return false;
          }
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
          // Try to get/refresh session before proceeding
          const session = await refreshSession();
          if (!session) {
            throw new Error('No active session - user must be authenticated');
          }

          const updateWithTimestamp = {
            ...update,
            updated_at: new Date().toISOString()
          };

          const { error: updateError, data } = await supabase
            .from('profiles')
            .update(updateWithTimestamp)
            .eq('id', settings.id)
            .select()
            .single();

          if (updateError) {
            // Check specifically for auth errors
            if (updateError instanceof AuthApiError || 
              updateError.message?.includes('JWT')) {
            // Try to refresh the session one more time
            await refreshSession();
            // Retry the update
            const { error: retryError, data: retryData } = await supabase
              .from('profiles')
              .update(updateWithTimestamp)
              .eq('id', settings.id)
              .select()
              .single();
            
            if (retryError) throw retryError;
            if (!retryData) throw new Error('No data returned after retry');
            
            const mappedSettings = mapProfileToSettings(retryData);
            set(mappedSettings);
            return;
            }
            
            throw updateError;
          }

          if (!data) {
            throw new Error('No data returned after update');
          }

          const mappedSettings = mapProfileToSettings(data);
          set(mappedSettings);

          } catch (error) {
          console.error('Save profile error:', error);
          // If it's an auth error, we should trigger a re-login
          if (error instanceof AuthApiError || 
            (error instanceof Error && 
             (error.message?.includes('JWT') || 
              error.message?.includes('token')))) {
            // Emit an event or callback to handle re-authentication
            window.dispatchEvent(new CustomEvent('auth:required'));
          }
          throw error;
          }
        },

        verifySessionWithRefresh: async () => {
        try {
          const session = await refreshSession();
          return !!session;
        } catch (error) {
          console.error('Session verification failed:', error);
          return false;
        }
        },
      }),
      persistOptions
      )
    );
