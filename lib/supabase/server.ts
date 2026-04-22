import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "@/lib/supabase/config";

export function getSupabaseServerClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseServerConfig();
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
