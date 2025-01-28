import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Enhanced environment variable validation
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is not defined in environment variables')
}

if (!supabaseKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is not defined in environment variables')
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
      'x-client-info': 'brainmessenger-web'
    }
  },
  realtime: {
    timeout: 30000
  },
  db: {
    schema: 'public'
  }
})
