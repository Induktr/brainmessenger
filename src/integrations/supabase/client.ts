// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://nvomtwheltcdpnvttape.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52b210d2hlbHRjZHBudnR0YXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4MDA1NjMsImV4cCI6MjA1MjM3NjU2M30.gZdr1fujS-T7j-gISfK4SEpzPNuj2nQS4G6UbGmSKS0";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);