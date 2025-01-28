import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { User, AuthError } from '@supabase/gotrue-js';
import type { Profile } from '@/types/supabase';

interface SessionInfo {
  id: string;
  started_at: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  currentSession: SessionInfo | null;
  profile: Profile | null;
}

// Helper function to validate JWT token structure and expiration
const validateToken = (token: string): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Verify each part can be base64 decoded
    const isValidFormat = parts.every(part => {
      try {
        atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        return true;
      } catch {
        return false;
      }
    });

    if (!isValidFormat) return false;

    // Decode and verify expiration
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);
    
    // Check if token is expired or not yet valid
    if (payload.exp && payload.exp < now) return false;
    if (payload.nbf && payload.nbf > now) return false;

    return true;
  } catch {
    return false;
  }
};

// Helper function to check if token needs refresh
const shouldRefreshToken = (token: string): boolean => {
  try {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);
    // Refresh if token expires in less than 5 minutes
    return payload.exp - now < 300;
  } catch {
    return true;
  }
};

// Helper function to validate UUID format
const isValidUUID = (id: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
};

// Type guard for AuthError
const isAuthError = (error: unknown): error is AuthError => {
  return error instanceof Error && 'status' in error && 'name' in error;
};

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    currentSession: null,
    profile: null
  });
  const navigate = useNavigate();

  const setError = (error: unknown): void => {
    setState(prev => ({
      ...prev,
      error: isAuthError(error) ? 
        `Auth error: ${error.message}` : 
        error instanceof Error ? 
          error.message : 
          typeof error === 'string' ? 
            error : 'Unknown error'
    }));
  };

  // Validate profile schema
  const validateProfileSchema = async (): Promise<boolean> => {
    try {
      const { data: columns, error } = await supabase
        .rpc('get_table_info', { p_table_name: 'profiles' });

      if (error) {
        console.error('Failed to verify profile columns:', error);
        return false;
      }

      // Required columns and their types
      const requiredColumns = {
        id: 'uuid',
        email: 'text',
        username: 'text',
        display_name: 'text',
        avatar_url: 'text',
        bio: 'text',
        visibility: 'text',
        updated_at: 'timestamp with time zone'
      };

      // Verify all required columns exist with correct types
      const missingOrInvalidColumns = Object.entries(requiredColumns)
        .filter(([name, expectedType]) => {
          const column = columns?.find((col: any) => col.column_name === name);
          return !column || !column.data_type.toLowerCase().includes(expectedType.toLowerCase());
        });

      if (missingOrInvalidColumns.length > 0) {
        console.error('Invalid profile schema:', 
          missingOrInvalidColumns.map(([col]) => col).join(', '));
        return false;
      }

      return true;
    } catch (error) {
      console.error('Profile schema validation failed:', error);
      return false;
    }
  };

  // Retry configuration
  const RETRY_CONFIG = {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 5000
  } as const;

  // Helper function for exponential backoff
  const calculateBackoffDelay = (attempt: number): number => {
    const delay = Math.min(
      RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt - 1),
      RETRY_CONFIG.MAX_DELAY_MS
    );
    // Add some jitter to prevent thundering herd
    return delay + (Math.random() * 1000);
  };

  // Create or update profile with retry mechanism
  const createProfile = async (user: User, attempt = 1): Promise<boolean> => {
    try {
      // Validate user ID is a valid UUID
      if (!user?.id || !isValidUUID(user.id)) {
        throw new Error('Invalid user ID format');
      }

      // Only validate schema on first attempt
      if (attempt === 1) {
        const isSchemaValid = await validateProfileSchema();
        if (!isSchemaValid) {
          throw new Error('Invalid profile schema');
        }
      }

      // Generate default username and display name
      const emailPrefix = user.email?.split('@')[0] || '';
      const userIdPrefix = user.id.substring(0, 8);
      const defaultUsername = emailPrefix || `user_${userIdPrefix}`;
      const defaultDisplayName = emailPrefix || `User ${userIdPrefix}`;

      // Create profile data matching database schema
      const profileData: Partial<Profile> = {
        id: user.id,
        email: user.email || '',
        username: defaultUsername,
        display_name: defaultDisplayName,
        avatar_url: null,
        bio: '',
        visibility: 'public',
        updated_at: new Date().toISOString()
      };

      // First check if profile exists using RLS-safe query
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, username, display_name, visibility, bio, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (fetchError) {
        // Handle specific error codes
        switch (fetchError.code) {
          case 'PGRST116': // Not found
            break;
          case '42501': // RLS violation
            console.error('Permission denied: RLS policy prevented access');
            throw new Error('Permission denied');
          case '42P01': // Undefined table
            console.error('Table does not exist');
            throw new Error('Profile table not found');
          default:
            console.error('Error fetching profile:', fetchError);
            throw fetchError;
        }
      }

      if (existingProfile) {
        // Update only changed fields using PATCH
        const updates: Partial<Profile> = {
          email: profileData.email, // Always sync email
          updated_at: profileData.updated_at
        };

        // Only update fields if they're not set
        if (!existingProfile.username) updates.username = profileData.username;
        if (!existingProfile.display_name) updates.display_name = profileData.display_name;
        if (!existingProfile.visibility) updates.visibility = profileData.visibility;
        if (!existingProfile.bio) updates.bio = profileData.bio;

        const { error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single();

        if (updateError) {
          // Handle specific update errors
          switch (updateError.code) {
            case '23505': // Unique violation
              console.error('Username already taken');
              throw new Error('Username already exists');
            case '42501': // RLS violation
              console.error('Permission denied: RLS policy prevented update');
              throw new Error('Permission denied');
            default:
              console.error('Profile update error:', updateError);
              throw updateError;
          }
        }
      } else {
        // Insert new profile with RLS check
        const { error: insertError } = await supabase
          .from('profiles')
          .upsert([profileData], {
            onConflict: 'id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (insertError) {
          // Handle specific insert errors
          switch (insertError.code) {
            case '23505': // Unique violation
              console.error('Profile already exists');
              throw new Error('Profile already exists');
            case '42501': // RLS violation
              console.error('Permission denied: RLS policy prevented insert');
              throw new Error('Permission denied');
            case '23503': // Foreign key violation
              console.error('Invalid user ID or user does not exist');
              throw new Error('Invalid user reference');
            default:
              if (attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
                const delayMs = calculateBackoffDelay(attempt);
                console.warn(
                  `Profile creation attempt ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS} failed, retrying in ${delayMs}ms...`,
                  insertError
                );
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return createProfile(user, attempt + 1);
              }
              console.error('Profile creation error:', insertError);
              throw insertError;
          }
        }
      }

      // Verify profile was created/updated with RLS-safe query
      const { data: verifyProfile, error: verifyError } = await supabase
        .from('profiles')
        .select('id, email, username, display_name')
        .eq('id', user.id)
        .single();

      if (verifyError) {
        console.error('Failed to verify profile:', verifyError);
        throw new Error('Failed to verify profile creation');
      }

      if (!verifyProfile) {
        throw new Error('Profile verification failed: Profile not found');
      }

      return true;
    } catch (error) {
      console.error('Profile creation failed:', error);
      if (attempt < RETRY_CONFIG.MAX_ATTEMPTS && 
          error instanceof Error && 
          !error.message.includes('Permission denied')) {
        const delayMs = calculateBackoffDelay(attempt);
        console.warn(
          `Retrying profile creation (attempt ${attempt + 1}/${RETRY_CONFIG.MAX_ATTEMPTS}) in ${delayMs}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return createProfile(user, attempt + 1);
      }
      setError(error);
      return false;
    }
  };

  // Create new session with enhanced error handling
  const createSession = async (user: User) => {
    try {
      // Verify current session and token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      if (!session?.access_token || !validateToken(session.access_token)) {
        throw new Error('Invalid session token');
      }

      // Create or update profile
      const profileCreated = await createProfile(user);
      if (!profileCreated) {
        throw new Error('Failed to create user profile');
      }

      // Get device info for session tracking
      const deviceInfo = {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenSize: {
          width: window.screen.width,
          height: window.screen.height
        },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        deviceMemory: (navigator as any).deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
        connection: (navigator as any).connection?.type
      };

      // Create session record
      const { data: sessionData, error: createSessionError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          ip_address: '',
          user_agent: navigator.userAgent,
          device_info: deviceInfo,
          started_at: new Date().toISOString()
        })
        .select('id, started_at')
        .single();

      if (createSessionError) throw createSessionError;

      setState({
        user,
        loading: false,
        error: null,
        currentSession: sessionData,
        profile: null
      });

      await fetchProfile(user.id);

    } catch (error: unknown) {
      console.error('Session creation failed:', error);
      setState({
        user: null,
        loading: false,
        error: isAuthError(error) ? 
          `Authentication failed: ${error.message}` :
          error instanceof Error ? 
            error.message : 
            'Authentication failed',
        currentSession: null,
        profile: null
      });
      throw error;
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      setState(prev => ({ ...prev, profile: data }));
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'));
    }
  };

  const endSession = async (reason: string = 'user_logout') => {
    if (!state.currentSession?.id) return;
    
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({
          ended_at: new Date().toISOString(),
          logout_reason: reason
        })
        .eq('id', state.currentSession.id);

      if (error) throw error;
    } catch (error: unknown) {
      console.error('Error ending session:', error);
      setError(error);
    }
  };

  useEffect(() => {
    let mounted = true;
    let retryTimeout: NodeJS.Timeout;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (session?.user) {
          // Validate access token
          if (!session.access_token || !validateToken(session.access_token)) {
            console.warn('Invalid session token, attempting refresh...');
            const { data: { session: refreshedSession }, error: refreshError } = 
              await supabase.auth.refreshSession();
            
            if (refreshError) throw refreshError;
            if (!refreshedSession) throw new Error('Session refresh failed');
            
            if (mounted) {
              await createSession(refreshedSession.user);
            }
          } else if (shouldRefreshToken(session.access_token)) {
            // Proactively refresh token if it's close to expiration
            console.log('Token expiring soon, refreshing...');
            const { data: { session: refreshedSession }, error: refreshError } = 
              await supabase.auth.refreshSession();
            
            if (!refreshError && refreshedSession && mounted) {
              await createSession(refreshedSession.user);
            }
          } else if (mounted) {
            await createSession(session.user);
          }
        } else {
          if (mounted) {
            setState(prev => ({ ...prev, loading: false }));
          }
        }
      } catch (error: unknown) {
        console.error('Auth initialization failed:', error);
        if (mounted) {
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.warn(`Retrying auth initialization (${retryCount}/${MAX_RETRIES})...`);
            retryTimeout = setTimeout(initializeAuth, RETRY_DELAY);
          } else {
            setState({
              user: null,
              loading: false,
              error: isAuthError(error) ? 
                `Authentication failed: ${error.message}` :
                error instanceof Error ? 
                  error.message : 
                  'Authentication failed',
              currentSession: null,
              profile: null
            });
          }
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      try {
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          if (!validateToken(session.access_token)) {
            console.error('Invalid refreshed token');
            await supabase.auth.signOut();
            setState({
              user: null,
              loading: false,
              error: 'Invalid session token',
              currentSession: null,
              profile: null
            });
            return;
          }
          setState(prev => ({ ...prev, user: session.user }));
        } else if (event === 'SIGNED_IN' && session?.user) {
          await createSession(session.user);
        } else if (event === 'SIGNED_OUT') {
          await endSession('auth_state_change');
          setState({
            user: null,
            loading: false,
            error: null,
            currentSession: null,
            profile: null
          });
        }
      } catch (error: unknown) {
        console.error('Auth state change error:', error);
        setState({
          user: null,
          loading: false,
          error: isAuthError(error) ? 
            `Auth state change failed: ${error.message}` :
            error instanceof Error ? 
              error.message : 
              'Authentication state change failed',
          currentSession: null,
          profile: null
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      if (state.currentSession?.id) {
        await endSession('user_logout');
      }

      // Remove all realtime subscriptions
      supabase.getChannels().forEach(channel => {
        supabase.removeChannel(channel);
      });

      // Sign out globally
      const { error: signOutError } = await supabase.auth.signOut({
        scope: 'global'
      });

      if (signOutError) throw signOutError;

      // Clear auth state from storage
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('supabase.auth.refreshToken');
      sessionStorage.clear();

      setState({
        user: null,
        loading: false,
        error: null,
        currentSession: null,
        profile: null
      });

      navigate('/login');
      
      return true;
    } catch (error: unknown) {
      console.error('Logout failed:', error);
      setState({
        user: null,
        loading: false,
        error: isAuthError(error) ? 
          `Logout failed: ${error.message}` :
          error instanceof Error ? 
            error.message : 
            'Logout failed',
        currentSession: null,
        profile: null
      });
      throw error;
    }
  }, [navigate, state.currentSession?.id]);

  return {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    error: state.error,
    currentSession: state.currentSession,
    logout,
    isAuthenticated: !!state.user
  };
};
