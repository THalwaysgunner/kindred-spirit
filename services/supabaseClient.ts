import { createClient } from "@supabase/supabase-js";

// Lovable Cloud injects these at build time
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  (import.meta.env as any).VITE_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta.env as any).VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Backend credentials missing. Please check environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
