import { createClient } from "@supabase/supabase-js";

/* Both values are public by design (they ship to the browser).
   Fail loudly at import time instead of throwing a cryptic
   "supabaseUrl is required" deep inside a click handler. */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (locally) and in your " +
      "Vercel project settings (production), then redeploy."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
