import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Both values are public by design (they ship to the browser).

   They are read lazily: `next build` prerenders every page on a machine that
   may not have them (a fork's preview deployment, a fresh clone, CI), and
   throwing at import time turns that into "Export encountered errors on
   following paths: /login, /signup, ...". So the client is created on first
   use instead, and a missing key fails loudly at that point rather than
   taking the whole build down. */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when both public Supabase keys are present. Check this before
    touching `supabase` if you want to show a message instead of throwing. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const MISSING_SUPABASE_ENV_MESSAGE =
  "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (locally) and in your " +
  "Vercel project settings (for every environment you deploy to), then " +
  "redeploy.";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(MISSING_SUPABASE_ENV_MESSAGE);
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

/* Same shape as the old eager export, so every `supabase.auth....` /
   `supabase.from(...)` / `supabase.rpc(...)` call site stays unchanged -- the
   real client is just built on the first property access. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getSupabaseClient() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
  has(_target, prop) {
    return prop in (getSupabaseClient() as unknown as object);
  },
});
