import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/stores/settings';

export const useSession = () => {
  const loadSettings = useSettings(state => state.loadSettings);

  const validateSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }, []);

  const verifyProfile = useCallback(async () => {
    const session = await validateSession();
    if (session?.user) {
      await loadSettings(session.user.id);
      return true;
    }
    return false;
  }, [loadSettings, validateSession]);

  return {
    validateSession,
    verifyProfile
  };
};
