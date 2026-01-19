// Legacy client used across the app.
// We route it through the auto-generated Lovable Cloud client (keys/session handling).
// The generated DB types are currently empty, so we cast to `any` to avoid `never` table errors.
import { supabase as typedSupabase } from "../src/integrations/supabase/client";

export const supabase = typedSupabase as any;
