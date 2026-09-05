# Contributing to Devgri AI

Thanks for looking. This is an early-stage MVP, so almost everything is open
for argument — including the parts that already work.

## Ways to help, from lowest to highest effort

1. **Tell me where it confused you.** Open a [discussion](https://github.com/Sumontsc51/Devgri-ai/discussions). Vague first impressions are genuinely useful at this stage.
2. **File a bug.** [Open an issue](https://github.com/Sumontsc51/Devgri-ai/issues/new) with what you did, what you expected, and what happened. Browser + a screenshot of the console beats a paragraph of description.
3. **Fix something small.** Typos, copy, accessibility, error messages — no need to ask first.
4. **Take a roadmap item.** Comment on the issue (or open one) before you start, so two people don't build the same thing.

## Local setup

```bash
git clone https://github.com/Sumontsc51/Devgri-ai.git
cd Devgri-ai
npm install
cp .env.local.example .env.local
npm run dev
```

You need your own free Supabase project: run `supabase/schema.sql` in the SQL
Editor, then fill in `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. For fast iteration, turn **off** "Confirm
email" under Authentication → Providers → Email, and add
`http://localhost:3000/auth/callback` to the Redirect URLs list.

Before opening a PR:

```bash
npm run build   # this is what CI and Vercel will run
```

## Pull requests

- Branch from `main`: `fix/login-redirect-loop`, `feat/github-oauth`
- One concern per PR. A 40-line PR gets reviewed the same day; a 900-line one does not.
- Say **why** in the description, not just what. Link the issue if there is one.
- Keep the existing style: TypeScript, functional components, Tailwind utility classes, no new dependency unless it earns its weight.
- Don't commit `.env.local`, real keys, or `node_modules` — `.gitignore` already covers them, keep it that way.

## Things that need care

- **`supabase/schema.sql` is the source of truth for permissions.** The 3-day trial and the 10,000-user cap are enforced by RLS policies and triggers, not by the UI. If you change one, change the other and say so in the PR.
- **BYOK is a promise.** API keys must never be written to the database, logged, or sent anywhere except the model provider the user chose. Any PR that moves a key out of browser memory needs a very good reason.
- **Auth changes deserve manual testing** of the whole loop: sign up → confirmation email → callback → builder → sign out → log back in, on a fresh browser profile.

## Code of conduct

Be decent. Critique the code, not the person. Maintainers may close or lock
anything that turns unpleasant.

## License

By contributing you agree that your work is licensed under the [MIT License](LICENSE).
