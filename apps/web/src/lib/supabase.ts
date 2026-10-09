import { createClient } from "@supabase/supabase-js";

/**
 * Browser/client Supabase client. Uses the project's PUBLISHABLE key only — every read and write
 * goes through Row Level Security, so this key is safe to ship to the browser.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(url && publishableKey);

// A placeholder keeps `createClient` from throwing during build/prerender when env is missing.
export const supabase = createClient(url || "https://placeholder.supabase.co", publishableKey || "placeholder", {
  auth: { persistSession: false },
});
