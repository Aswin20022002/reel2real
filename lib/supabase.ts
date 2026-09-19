import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Returns a Supabase client if env vars are set, otherwise null (app runs in local demo mode). */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { realtime: { params: { eventsPerSecond: 5 } } }) : null;
  return client;
}
