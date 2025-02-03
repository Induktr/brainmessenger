import { createClient, AuthApiError, Session } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { logger } from '@/lib/logger'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Enhanced environment variable validation
if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
}

// Validate URL format
try {
    new URL(supabaseUrl)
} catch (error) {
    throw new Error('VITE_SUPABASE_URL is not a valid URL')
}

// Configure Supabase client with enhanced options

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: window.localStorage,
        storageKey: 'brainmessenger-auth-token',
        debug: import.meta.env.DEV
    },


    global: {
        headers: {
            'x-client-info': 'brainmessenger-web',
            'Content-Type': 'application/json'
        }
    },
    db: {
        schema: 'public'
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
})

// Enhanced session validation with rate limiting and reduced logging
export const validateSession = async (): Promise<Session | null> => {
    const SESSION_CACHE_KEY = 'last-session-check';
    const MIN_CHECK_INTERVAL = 5000; // 5 seconds between checks

    // Check if we've validated recently
    const lastCheck = localStorage.getItem(SESSION_CACHE_KEY);
    if (lastCheck) {
        const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
        if (timeSinceLastCheck < MIN_CHECK_INTERVAL) {
            return supabase.auth.getSession().then(({ data }) => data.session);
        }
    }

    let attempts = 0;
    const maxAttempts = 3;
    const retryDelay = 2000;
    let lastError: Error | null = null;
    let sessionResult: Session | null = null; // Store session result outside the loop

    while (attempts < maxAttempts) {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                if (error instanceof AuthApiError && error.status === 401) {
                    await supabase.auth.signOut();
                    sessionResult = null; // Indicate no session due to 401
                    break; // Exit loop on 401 - session is definitely invalid
                }
                lastError = error;
                attempts++;
                if (attempts === 1) { // Log only on first attempt
                    logger.warn('Session validation failed (attempt 1):', error.message); // Use logger
                }
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
                throw error; // Re-throw last error after max attempts
            }

            // Update last check timestamp
            localStorage.setItem(SESSION_CACHE_KEY, Date.now().toString());
            sessionResult = session; // Store successful session
            break; // Exit loop on success

        } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error during session validation');
            attempts++;
            if (attempts < maxAttempts) {
                logger.warn(`Session validation attempt ${attempts} failed:`, lastError.message); // Use logger
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }
            logger.error('Session validation failed after max attempts:', lastError.message); // Use logger with context
            sessionResult = null; // Indicate session validation failure
            break; // Exit loop after max attempts
        }
    }

    return sessionResult; // Return the session result (session or null)
};
