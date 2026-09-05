"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Workflow, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

/* Turn Supabase's raw auth errors into something a human can act on, and
   tell the page which recovery action to offer. */
function readAuthError(message: string): {
  text: string;
  needsConfirmation?: boolean;
} {
  const m = message.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return {
      text: "Wrong email or password. If you just signed up, confirm your email first.",
      needsConfirmation: true,
    };
  }
  if (m.includes("email not confirmed") || m.includes("not confirmed")) {
    return {
      text: "Your email isn't confirmed yet. Check your inbox — or send yourself a new link below.",
      needsConfirmation: true,
    };
  }
  if (m.includes("email logins are disabled")) {
    return {
      text: "Email log-in is switched off for this project. Enable it in Supabase → Authentication → Providers → Email.",
    };
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return { text: "Too many attempts. Wait a minute and try again." };
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return {
      text: "Can't reach the auth server. Check your connection and that the Supabase env vars are set on this deployment.",
    };
  }
  return { text: message };
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"resend" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      setLoading(false);
      const parsed = readAuthError(authError.message);
      setError(parsed.text);
      setShowRecovery(Boolean(parsed.needsConfirmation));
      return;
    }

    if (!data.session) {
      setLoading(false);
      setError("Signed in, but no session came back. Try again.");
      return;
    }

    /* Full page load rather than router.push(): it guarantees the workspace
       boots with the session already read from storage, instead of racing
       the client-side router and bouncing straight back to /login. */
    window.location.assign("/builder");
  }

  async function resendConfirmation() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy("resend");
    setError(null);
    const { error: e } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    setBusy(null);
    if (e) {
      setError(readAuthError(e.message).text);
      return;
    }
    setNotice("New confirmation link sent. Check your inbox and spam folder.");
  }

  async function sendPasswordReset() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy("reset");
    setError(null);
    const { error: e } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      redirectTo ? { redirectTo: `${redirectTo}?next=/builder` } : undefined
    );
    setBusy(null);
    if (e) {
      setError(readAuthError(e.message).text);
      return;
    }
    setNotice("Password reset link sent. Check your inbox.");
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
          <h1 className="text-xl font-semibold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">
            Log in to open your workspace.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-line bg-ink px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:border-indigo-500"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>

          <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-xs">
            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={busy !== null}
              className="text-left text-gray-500 transition hover:text-gray-300 disabled:opacity-60"
            >
              {busy === "reset" ? "Sending…" : "Forgot your password?"}
            </button>
            {showRecovery && (
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={busy !== null}
                className="text-left text-indigo-400 transition hover:text-indigo-300 disabled:opacity-60"
              >
                {busy === "resend"
                  ? "Sending…"
                  : "Resend the confirmation email"}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          No account yet?{" "}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300">
            Start your free trial
          </Link>
        </p>
      </div>
    </main>
  );
}
