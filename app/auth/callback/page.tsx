"use client";

/* Landing spot for every email link Supabase sends (confirm signup,
   magic link, password recovery, email change).

   Supabase has shipped three link shapes and, depending on the project's
   email templates, any of them can arrive here:

     1. implicit flow  -> tokens in the URL hash  (#access_token=...)
     2. PKCE flow      -> ?code=...
     3. newer templates -> ?token_hash=...&type=signup

   Handling all three means a confirmation link works whichever template the
   Supabase project uses. Without this route, links fall back to the
   project's Site URL (often still http://localhost:3000), the account never
   gets confirmed, and every later log-in fails with "Email not confirmed" —
   which is exactly what a broken sign-in looks like from the outside.

   Note: this reads the query string from window.location rather than
   useSearchParams(), so the page does not need a Suspense boundary and
   `next build` stays happy. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { parseAuthCallback } from "@/lib/auth-callback";
import type { EmailOtpType } from "@supabase/supabase-js";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const { errorDescription, next, code, tokenHash, type } =
        parseAuthCallback(window.location.search, window.location.hash);

      if (errorDescription) {
        setError(errorDescription);
        return;
      }

      const otpType = type as EmailOtpType | null;

      if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (e) {
          setError(e.message);
          return;
        }
      } else if (tokenHash && otpType) {
        const { error: e } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });
        if (cancelled) return;
        if (e) {
          setError(e.message);
          return;
        }
      }

      /* Implicit flow: detectSessionInUrl has already parsed the hash. */
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!data.session) {
        setError(
          "This link has expired or was already used. Request a new one from the log-in page."
        );
        return;
      }

      /* Full page load so the destination boots with the session already in
         storage, instead of racing the client-side router. */
      window.location.replace(next);
    }

    finish().catch((e) =>
      setError(e instanceof Error ? e.message : "Could not complete sign-in.")
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
      {error ? (
        <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8 text-center">
          <h1 className="text-lg font-semibold text-white">
            We couldn&apos;t finish signing you in
          </h1>
          <p className="mt-2 text-sm text-gray-400">{error}</p>
          <Link
            href="/login"
            className="mt-6 block rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Back to log in
          </Link>
        </div>
      ) : (
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      )}
    </main>
  );
}
