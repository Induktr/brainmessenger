import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvomtwheltcdpnvttape.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52b210d2hlbHRjZHBudnR0YXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4MjI0NzcsImV4cCI6MjAyNTM5ODQ3N30.Gy-QYbxXYwXb3LWvqAp-_eLbbOz0UEzQwWH_nOVXf8Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});