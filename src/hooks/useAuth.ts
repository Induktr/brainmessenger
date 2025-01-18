import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface SessionInfo {
  id: string;
  started_at: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<SessionInfo | null>(null);
  const navigate = useNavigate();

  const createSession = async (user: User) => {
    try {
      // Verify user profile exists first
      const { data: userProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileCheckError || !userProfile) {
        // Create profile if it doesn't exist
        const { error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: user.email?.split('@')[0] || `user_${user.id.substring(0, 8)}`,
            avatar_url: ''
          });

        if (createProfileError) {
          console.error('Error creating user profile:', createProfileError);
          return;
        }
      }

      // Get basic device info
      const deviceInfo = {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenSize: {
          width: window.screen.width,
          height: window.screen.height
        }
      };

      // Create new session record
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: user.id,
          ip_address: '', // This will be captured by Supabase's edge functions
          user_agent: navigator.userAgent,
          device_info: deviceInfo
        })
        .select('id, started_at')
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return;
      }
      
      setCurrentSession(data);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const endSession = async (reason: string = 'user_logout') => {
    if (currentSession?.id) {
      try {
        const { error } = await supabase
          .from('user_sessions')
          .update({
            ended_at: new Date().toISOString(),
            logout_reason: reason
          })
          .eq('id', currentSession.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error ending session:', error);
      }
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        createSession(currentUser);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (event === 'SIGNED_IN' && currentUser) {
        await createSession(currentUser);
      } else if (event === 'SIGNED_OUT') {
        await endSession('auth_state_change');
        setCurrentSession(null);
      }
      
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // End current session in database
      await endSession('user_logout');
      setCurrentSession(null);

      // Remove all realtime subscriptions
      supabase.channel('*').unsubscribe();

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Clear any local storage items (except those needed for the app to function)
      const preserveKeys = ['theme']; // Add any keys that should be preserved
      for (const key in localStorage) {
        if (!preserveKeys.includes(key)) {
          localStorage.removeItem(key);
        }
      }

      // Clear any session storage
      sessionStorage.clear();

      // Reset any app state here
      setUser(null);
      setLoading(false);

      // Redirect to registration page
      navigate('/register');
      
      return true;
    } catch (error) {
      console.error('Error logging out:', error);
      setLoading(false);
      throw error;
    }
  }, [navigate]);

  return {
    user,
    loading,
    logout,
    isAuthenticated: !!user,
    currentSession
  };
};
