import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { logOnce } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface SessionState {
  isLoading: boolean;
  error: Error | null;
  session: Session | null;
}

const REFRESH_MARGIN = 5 * 60 * 1000; // 5 minutes in milliseconds

export const useSession = () => {
  const [state, setState] = useState<SessionState>({
    isLoading: true,
    error: null,
    session: null
  });

  // Helper function to check if session needs refresh
  const shouldRefreshSession = (session: Session): boolean => {
    if (!session.expires_at) return true;
    const expiresAt = new Date(session.expires_at).getTime();
    return Date.now() + REFRESH_MARGIN > expiresAt;
  };

  // Helper function to validate session token
  const validateSessionToken = async (token: string): Promise<boolean> => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      return !error && !!user;
    } catch {
      return false;
    }
  };

  const validateSession = useCallback(async () => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      logger.debug(`[${window.performance.now().toFixed(0)}] validateSession started`); // Timestamped log

      let retries = 0;
      let warningLogged = false; // Track if warning has been logged
      while (retries < MAX_RETRIES) {
        // Get current session
        logger.debug(`[${window.performance.now().toFixed(0)}] validateSession - Attempt ${retries + 1}: Getting session from Supabase`); // Timestamped log
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('session', session);
        if (sessionError) {
          if (!warningLogged) {
            console.warn(`Session validation failed repeatedly:`, sessionError);
            warningLogged = true; // Log warning only once
          }
          logger.warn(`[${window.performance.now().toFixed(0)}] validateSession - Attempt ${retries + 1}: getSession error:`, sessionError); // Timestamped log
          if (retries === MAX_RETRIES - 1) throw sessionError;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          retries++;
          continue;
        }

        // No session exists
        if (!session) {
          logger.debug(`[${window.performance.now().toFixed(0)}] validateSession - Attempt ${retries + 1}: No session found`); // Timestamped log
          if (retries === MAX_RETRIES - 1) {
            setState(prev => ({ ...prev, isLoading: false, session: null }));
            logger.warn(`[${window.performance.now().toFixed(0)}] validateSession - Max retries reached, session is null`); // Added log
            return null;
          }
          logger.debug(`[${window.performance.now().toFixed(0)}] validateSession - Attempt ${retries + 1}: Waiting and retrying...`); // Added log
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          retries++;
          continue;
        }

        // Add a small delay before token validation to ensure token is properly stored
        await new Promise(resolve => setTimeout(resolve, 500));

        // Validate access token with retries
        logger.debug(`[${window.performance.now().toFixed(0)}] validateSession - Attempt ${retries + 1}: Validating session token`); // Timestamped log
        const isValidToken = await validateSessionToken(session.access_token);
        if (!isValidToken) {
          logger.warn(`[${window.performance.now().toFixed(0)}] validateSession - Attempt ${retries + 1}: Invalid session token`); // Timestamped log
          if (retries === MAX_RETRIES - 1) {
            await supabase.auth.signOut();
            setState(prev => ({
              ...prev,
              isLoading: false,
              session: null,
              error: new Error('Invalid session token')
            }));
            return null;
          }
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          retries++;
          continue;
        }

        // Check if session needs refresh
        if (shouldRefreshSession(session)) {
          logger.debug(`[${window.performance.now().toFixed(0)}] validateSession - Attempt ${retries + 1}: Session needs refresh, refreshing session`); // Timestamped log
          const { data: { session: refreshedSession }, error: refreshError } =
            await supabase.auth.refreshSession();

          if (refreshError || !refreshedSession) {
            logger.warn(`[${window.performance.now().toFixed(0)}] validateSession - Attempt ${retries + 1}: Session refresh failed:`, refreshError); // Timestamped log
            if (retries === MAX_RETRIES - 1) {
              await supabase.auth.signOut();
              setState(prev => ({
                ...prev,
                isLoading: false,
                session: null,
                error: refreshError || new Error('Session refresh failed')
              }));
              return null;
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            retries++;
            continue;
          }
          logger.debug(`[${window.performance.now().toFixed(0)}] validateSession - Attempt ${retries + 1}: Session refreshed successfully`); // Timestamped log
          setState(prev => ({ ...prev, isLoading: false, session: refreshedSession }));
          return refreshedSession;
        }

        // Successfully validated session
        logger.debug(`[${window.performance.now().toFixed(0)}] validateSession - Attempt ${retries + 1}: Session validated successfully`); // Timestamped log
        setState(prev => ({ ...prev, isLoading: false, session }));
        return session;
      }

      // All retries failed
      logger.error(`[${window.performance.now().toFixed(0)}] validateSession - All retries failed`); // Timestamped log
      throw new Error('Failed to validate session after maximum retries');
    } catch (error) {
      logOnce('session-validation-error', 'Session validation error:', error);
      logger.error(`[${window.performance.now().toFixed(0)}] validateSession error:`, error); // Timestamped log

      // Clear invalid session
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        logOnce('session-signout-error', 'Error clearing invalid session:', signOutError);
        logger.error(`[${window.performance.now().toFixed(0)}] validateSession - signOut error:`, signOutError); // Timestamped log
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        session: null,
        error: error instanceof Error ? error : new Error('Session validation failed')
      }));

      return null;
    }
  }, [state.isLoading]);

  const refreshSession = useCallback(async () => {
    if (state.isLoading) return state.session;
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        await supabase.auth.signOut();
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          session: null,
          error
        }));
        return null;
      }

      if (!session) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          session: null,
          error: new Error('Session refresh failed')
        }));
        return null;
      }

      setState(prev => ({ ...prev, isLoading: false, session }));
      return session;
    } catch (error) {
      logOnce('session-refresh-error', 'Session refresh error:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        session: null,
        error: error instanceof Error ? error : new Error('Session refresh failed') 
      }));
      return null;
    }
  }, [state.isLoading]);

  // Initialize session
  useEffect(() => {
    validateSession();
  }, [validateSession]);

  // Set up periodic session refresh
  useEffect(() => {
    if (!state.session) return;

    const refreshInterval = setInterval(async () => {
      if (shouldRefreshSession(state.session!)) {
        await refreshSession();
      }
    }, REFRESH_MARGIN);

    return () => clearInterval(refreshInterval);
  }, [state.session, refreshSession]);

  return {
    ...state,
    validateSession,
    refreshSession
  };
};
