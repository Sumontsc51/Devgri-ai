<<<<<<< HEAD
# Devgri AI — MVP

Visual 2D node canvas with BYOK (bring-your-own-key) and client-side PII/token
masking. Next.js 14 App Router + Supabase + Tailwind + React Flow.

## File tree

```
devgri-ai/
├── package.json
├── next.config.js
├── vercel.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── .env.local.example      → copy to .env.local
├── supabase/
│   └── schema.sql          → run in Supabase SQL Editor
├── lib/
│   └── supabase.ts
└── app/
    ├── globals.css
    ├── layout.tsx
    ├── page.tsx            → landing page
    ├── login/page.tsx
    ├── signup/page.tsx
    └── dashboard/page.tsx  → React Flow canvas workspace
```

## Setup (15 minutes)

1. **Supabase**: create a project → SQL Editor → paste and run
   `supabase/schema.sql` (whole file, once).
2. **Auth settings**: Supabase → Authentication → Providers → Email: ON.
   For instant testing, disable "Confirm email" (re-enable before launch).
3. **Env**: `cp .env.local.example .env.local`, fill in your Project URL and
   anon key (Supabase → Settings → API). Use the transaction pooler string
   (port 6543) for `DATABASE_URL`.
4. **Run**: `npm install && npm run dev` → http://localhost:3000
5. **Deploy**: push to GitHub → import in Vercel → add the two
   `NEXT_PUBLIC_*` env vars → deploy.

## Built-in business rules (enforced in Postgres, not just UI)

- **10,000-user cap**: inserting profile #10,001 raises `TRIAL_CAP_REACHED`;
  signup page shows the sold-out message. `trial_counter()` RPC returns
  remaining slots (shown live on /signup).
- **3-day trial → read-only**: RLS policies block workspace INSERT/UPDATE
  once `now() - profiles.created_at > 3 days`, unless `is_premium = true`.
  The dashboard mirrors this with a banner + disabled save.
- **BYOK privacy**: API keys exist only in browser state; `saveWorkspace()`
  strips them before any sync. Masking runs entirely client-side.

To grant premium manually (until Stripe is added):
`update profiles set is_premium = true where email = 'user@example.com';`
=======
# Devgri-ai
>>>>>>> 46916fd2fa4390a545ca26117e3409309c3b1ba0
