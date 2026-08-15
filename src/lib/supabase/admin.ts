import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

import { supabaseSecretKey, supabaseUrl } from "./env";

// Bypasses RLS. Cron only. Never import from anything the browser can reach.
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
