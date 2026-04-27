import { createClient } from "@supabase/supabase-js";

// Pulled from Vite's import.meta.env at build time.
// VITE_-prefixed vars are intentionally public — the publishable key is
// designed to ship in the bundle; RLS in the database is what actually
// protects data.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env.local and fill in " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
  );
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Used in Phase 4 when we add the magic-link redirect flow.
    detectSessionInUrl: true,
  },
});
