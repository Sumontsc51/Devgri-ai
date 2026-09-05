<div align="center">

# Devgri AI

**Describe an app in plain language. Watch it become an architecture you can see, edit, and preview — in your browser, with your own API key.**

[Live demo](https://devgri-ai-olive.vercel.app) · [Report a bug](https://github.com/Sumontsc51/Devgri-ai/issues/new) · [Share an opinion](https://github.com/Sumontsc51/Devgri-ai/discussions)

[![Next.js 14](https://img.shields.io/badge/Next.js-14-000?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-auth%20%2B%20db-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## What this is

Devgri AI is an **AI app builder you can watch think**. Instead of a chat box that
hands back a wall of code, you get three panes that stay in sync:

| Pane | What it does |
| --- | --- |
| **Chat** | You describe what you want, in plain language |
| **Architecture tree** | The app's structure appears as an editable node graph — drag, rename, reconnect |
| **Live preview** | The generated site renders next to the tree as it changes |

It is **BYOK** (bring your own key): your Anthropic / OpenAI / Google key stays in
browser memory, and PII/token masking runs client-side before anything leaves
the tab. Keys are stripped from every payload before a workspace is saved.

> **Status: early MVP.** It works end to end, it is rough in places, and that is
> exactly why the repo is public — see [Feedback wanted](#feedback-wanted).

## Features

- **Visual architecture tree** — a 2D node canvas (React Flow) built from your prompt
- **Live preview** — see the result beside the structure, not after it
- **Bring your own key** — Anthropic, OpenAI or Google; the key never leaves the browser
- **Client-side masking** — PII and tokens are scrubbed in the tab, before any request
- **Saved projects** — up to 10 recent workspaces per account, in Postgres
- **Rules enforced in the database, not just the UI** — trial window and user cap live in RLS policies, so the API can't be talked around

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · React Flow · Supabase (Auth + Postgres + RLS) · Vercel

## Quick start

```bash
git clone https://github.com/Sumontsc51/Devgri-ai.git
cd Devgri-ai
npm install
cp .env.local.example .env.local   # fill in your Supabase values
npm run dev                        # http://localhost:3000
```

### 1. Create the database

In your Supabase project → **SQL Editor** → paste and run
[`supabase/schema.sql`](supabase/schema.sql) in full, once. It creates
`profiles`, `workspaces`, the RLS policies, and the signup trigger.

### 2. Configure auth (this is the step that bites people)

Supabase → **Authentication**:

| Setting | Where | Value |
| --- | --- | --- |
| Email provider | Providers → Email | **On** |
| Site URL | URL Configuration | your deployed origin, e.g. `https://your-app.vercel.app` |
| Redirect URLs | URL Configuration | `https://your-app.vercel.app/auth/callback` **and** `http://localhost:3000/auth/callback` |
| Confirm email | Providers → Email | On for production; turn **off** for fast local testing |

**Why it matters:** if the redirect URLs are missing, every confirmation and
password-reset email points at whatever the Site URL happens to be — usually
still `localhost:3000` — so accounts never get confirmed and *every* later
log-in fails with `Email not confirmed`. That reads like "sign-in is broken"
even though the credentials are fine. The app now ships an
[`/auth/callback`](app/auth/callback/page.tsx) route that handles all three of
Supabase's link formats (hash tokens, `?code=`, `?token_hash=`), plus
**Resend confirmation** and **Forgot password** actions on the log-in page — but
the redirect URLs still have to be allow-listed above.

### 3. Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Both are browser-safe by design. Use the **transaction pooler** (port `6543`)
for any server-side `DATABASE_URL`; direct connections exhaust Postgres slots on
serverless. See [`.env.local.example`](.env.local.example) for the full list.

### 4. Deploy

Push to GitHub → import the repo in Vercel → add the two `NEXT_PUBLIC_*` vars →
deploy. Then add the deployed origin to Supabase's Site URL and Redirect URLs
(step 2) or auth emails will keep pointing at localhost.

## Project structure

```
app/
├─ page.tsx              landing page
├─ login/                log in, resend confirmation, password reset
├─ signup/               trial signup with live slot counter
├─ auth/callback/        handles every Supabase email link → /builder
├─ dashboard/            legacy route, redirects to /builder
└─ builder/              the workspace: chat + architecture tree + preview
lib/supabase.ts          browser Supabase client (fails loudly if env is unset)
supabase/schema.sql      tables, RLS policies, triggers — run this first
```

## Business rules (enforced in Postgres)

- **10,000-user cap** — inserting profile #10,001 raises `TRIAL_CAP_REACHED`; the signup page shows the sold-out message. The `trial_counter()` RPC returns remaining slots, shown live on `/signup`.
- **3-day trial, then read-only** — RLS blocks workspace `INSERT`/`UPDATE` once `now() - profiles.created_at > 3 days`, unless `is_premium = true`. The builder mirrors this with a banner and a disabled save.
- **BYOK privacy** — API keys live only in browser state; `saveWorkspace()` strips them before any sync. Masking is entirely client-side.
- **Granting premium manually** (until billing exists):
  ```sql
  update profiles set is_premium = true where email = 'user@example.com';
  ```

## Roadmap

- [ ] In-app password change (reset currently signs you back in)
- [ ] Server-side route protection via middleware, not just the client
- [ ] OAuth sign-in (GitHub, Google)
- [ ] Export a generated app as a downloadable repo
- [ ] Billing, to replace the manual `is_premium` flip
- [ ] Tests around the auth and save paths

## Feedback wanted

This repo is public specifically to get honest outside opinions. The most
useful things you can do:

- **Try the [live demo](https://devgri-ai-olive.vercel.app)** and tell me where it confuses you — [open a discussion](https://github.com/Sumontsc51/Devgri-ai/discussions)
- **Break the auth flow** and [file the issue](https://github.com/Sumontsc51/Devgri-ai/issues/new) with what you did
- **Argue with the architecture** — the chat/tree/preview split is a bet, not a settled decision
- **Pick up a roadmap item** — see [CONTRIBUTING.md](CONTRIBUTING.md)

Good first issues are labelled [`good first issue`](https://github.com/Sumontsc51/Devgri-ai/labels/good%20first%20issue).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup,
branch naming, and what a useful PR looks like.

## License

[MIT](LICENSE) © Md. Sumon Islam

## Author

**Md. Sumon Islam** — founder, [ProwdStudio](https://prowdstudio.com)
