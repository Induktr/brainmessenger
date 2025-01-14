import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvomtwheltcdpnvttape.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52b210d2hlbHRjZHBudnR0YXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk4MjI0MDAsImV4cCI6MjAyNTM5ODQwMH0.qgYqvlbQqpYEgPwZcFb9HNlRl_-QGpKPiHJRhHGUYOo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);