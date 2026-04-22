import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }
  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserConfig();
  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
