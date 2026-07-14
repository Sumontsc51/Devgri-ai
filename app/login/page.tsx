"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Workflow, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Wrong email or password. Try again."
          : authError.message
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6">
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
                {error}
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
