"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Workflow, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [slotsLeft, setSlotsLeft] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .rpc("trial_counter")
      .then(({ data }: { data: number | null }) => {
        if (typeof data === "number") setSlotsLeft(data);
      });
  }, []);

  /* Send the confirmation link back to THIS deployment. Without it Supabase
     falls back to the project's Site URL — usually still localhost:3000 —
     so the link is unclickable for real users and the account is never
     confirmed, which then reads as "sign-in is broken". */
  function callbackUrl() {
    return `${window.location.origin}/auth/callback`;
  }

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const { data, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { emailRedirectTo: callbackUrl() },
    });
    setLoading(false);

    if (authError) {
      const m = authError.message;
      if (m.includes("TRIAL_CAP_REACHED")) {
        setError(
          "All 10,000 early-access slots are taken. Follow the repo for the public launch."
        );
      } else if (m.toLowerCase().includes("already registered")) {
        setError("That email already has an account — log in instead.");
      } else if (m.toLowerCase().includes("database error")) {
        setError(
          "Couldn't create your profile row. If you are self-hosting, re-run supabase/schema.sql."
        );
      } else {
        setError(m);
      }
      return;
    }

    if (data.session) {
      /* Email confirmation is off — straight into the workspace.
         Full page load so the session is read from storage on boot. */
      window.location.assign("/builder");
      return;
    }

    setDone(true);
  }

  async function resend() {
    setResending(true);
    setError(null);
    const { error: e } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: callbackUrl() },
    });
    setResending(false);
    if (e) {
      setError(e.message);
      return;
    }
    setNotice("Sent again. Check your inbox and spam folder.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
            <Workflow className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">Devgri AI</span>
        </Link>

        <div className="rounded-2xl border border-line bg-panel p-8">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <h1 className="mt-4 text-xl font-semibold text-white">
                Check your inbox
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                We sent a confirmation link to{" "}
                <span className="text-gray-200">{email}</span>. Click it and
                you&apos;ll land straight in your workspace.
              </p>

              {notice && (
                <p className="mt-4 text-xs text-emerald-300">{notice}</p>
              )}
              {error && <p className="mt-4 text-xs text-red-300">{error}</p>}

              <button
                type="button"
                onClick={resend}
                disabled={resending}
                className="mt-5 text-xs text-indigo-400 transition hover:text-indigo-300 disabled:opacity-60"
              >
                {resending ? "Sending…" : "Didn't get it? Send it again"}
              </button>

              <Link
                href="/login"
                className="mt-5 block rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Go to log in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white">
                Start your 3-day free trial
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {slotsLeft !== null
                  ? `${slotsLeft.toLocaleString()} of 10,000 slots remaining`
                  : "Limited to 10,000 early-access slots"}
              </p>

              <form onSubmit={handleSignup} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs font-medium text-gray-400"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-line bg-ink px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-xs font-medium text-gray-400"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-lg border border-line bg-ink px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:border-indigo-500"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Creating account…" : "Create account"}
                </button>
                <p className="text-center text-[11px] leading-relaxed text-gray-600">
                  Free for 3 days, then read-only unless you upgrade. No credit
                  card required.
                </p>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
