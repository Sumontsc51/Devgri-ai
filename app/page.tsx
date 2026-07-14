import Link from "next/link";
import {
  KeyRound,
  ShieldCheck,
  Workflow,
  Database,
  Zap,
  Lock,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-ink">
      {/* NAV */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <Workflow className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">Devgri AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm text-gray-300 transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Start free trial
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
          <Sparkles className="h-3.5 w-3.5" />
          Early access — limited to 10,000 slots
        </div>
        <h1 className="text-4xl font-bold leading-tight text-white sm:text-6xl">
          Your visual AI workspace.
          <br />
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            Your keys. Your data.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
          Devgri AI is a 2D node-based canvas with an Auto-CMS layer. Bring
          your own API keys — they run in your browser and are never stored on
          our servers. Built-in token and PII masking keeps every prompt clean.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
          >
            Start 3-Day Free Trial (Limited to 10k Slots)
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-line px-8 py-4 text-base font-medium text-gray-300 transition hover:border-gray-600 hover:text-white"
          >
            I already have an account
          </Link>
        </div>
        <p className="mt-4 text-xs text-gray-500">
          No credit card required · Full canvas access · Read-only after trial
          unless upgraded
        </p>
      </section>

      {/* BYOK + MASKING */}
      <section className="border-y border-line bg-panel/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-panel p-8">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15">
              <KeyRound className="h-5 w-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              Bring Your Own Key (BYOK)
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              Connect Anthropic, OpenAI, or Google keys directly on the canvas.
              Keys live in your browser session only — Devgri never transmits,
              stores, or proxies them. You pay your provider directly at cost,
              with zero markup from us. One key or many: the canvas routes work
              to whatever you connect.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-gray-300">
              {[
                "Keys never leave your browser",
                "Zero token markup — pay providers directly",
                "Works with one key or multiple providers",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-8">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">
              The Token Masking advantage
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              Drop a PII Masking node between your data and any model. Emails,
              phone numbers, and secret tokens are detected and replaced
              client-side before a single byte reaches an API. What the model
              never sees, the model can never leak.
            </p>
            <div className="mt-5 rounded-lg border border-line bg-ink p-4 font-mono text-xs">
              <p className="text-gray-500">Input:</p>
              <p className="text-gray-300">
                Contact john@acme.com, key sk-a8f3k2m9x1p7
              </p>
              <p className="mt-2 text-gray-500">Masked output:</p>
              <p className="text-emerald-300">
                Contact [EMAIL], key [TOKEN]
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold text-white">
          Everything on one canvas
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: Workflow,
              title: "2D node workspace",
              body: "Drag, connect, and organize your entire workflow visually. Pure client-side rendering — instant, private, no server round-trips.",
            },
            {
              icon: Database,
              title: "Auto-CMS layer",
              body: "Every canvas saves as structured content. Your workspaces become a queryable content system, synced to your account.",
            },
            {
              icon: Zap,
              title: "Built for speed",
              body: "Canvas state renders entirely in your browser. Save when you choose. No lag, no bandwidth waste, no surprise costs.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-line bg-panel p-6"
            >
              <f.icon className="h-6 w-6 text-indigo-400" />
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="border-t border-line bg-panel/50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-white">
            Simple pricing
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-panel p-8">
              <h3 className="font-semibold text-white">Free Trial</h3>
              <p className="mt-1 text-3xl font-bold text-white">
                $0
                <span className="text-sm font-normal text-gray-500">
                  {" "}
                  / 3 days
                </span>
              </p>
              <ul className="mt-6 space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" /> Full canvas
                  access
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" /> BYOK + masking
                  nodes
                </li>
                <li className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-400" /> Read-only after
                  day 3
                </li>
              </ul>
              <Link
                href="/signup"
                className="mt-8 block rounded-xl border border-indigo-500/50 py-3 text-center text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/10"
              >
                Claim a slot
              </Link>
            </div>
            <div className="relative rounded-2xl border-2 border-indigo-500 bg-panel p-8">
              <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
              <h3 className="font-semibold text-white">Premium</h3>
              <p className="mt-1 text-3xl font-bold text-white">
                $24
                <span className="text-sm font-normal text-gray-500">
                  {" "}
                  / month
                </span>
              </p>
              <ul className="mt-6 space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" /> Unlimited
                  editing, forever
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" /> Unlimited
                  workspaces
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" /> Priority
                  support
                </li>
              </ul>
              <Link
                href="/signup"
                className="mt-8 block rounded-xl bg-indigo-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Start with the free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Devgri AI. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/login" className="hover:text-gray-300">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-gray-300">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
