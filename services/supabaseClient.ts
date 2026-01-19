import { createClient } from "@supabase/supabase-js";

// Legacy, untyped client used across the app.
// We intentionally avoid generated DB types here to prevent `relation: never` errors
// when database types are not yet populated.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (import.meta.env as any).VITE_SUPABASE_ANON_KEY) as string | undefined;

if (!supabaseUrl || !supabaseKey) {
  // Throwing makes the root cause visible instead of silently rendering a blank screen.
  throw new Error("Backend env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

