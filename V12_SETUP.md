# WHERE7 Atlas V12 — installation and important limitations

## Install order (do not skip SQL)
1. Back up your current working project and Supabase database.
2. Replace project files with V12, but preserve your own `.env.local`, Vercel environment variables, and any custom code.
3. In your **existing** Supabase project's SQL Editor, run:
   - `supabase/schema.sql` only if you haven't already installed the base schema.
   - `supabase/random_daily_rotation.sql` only if you haven't installed the V7 rotation.
   - **`supabase/v12_accounts.sql`** (new account profiles, XP trigger).
   - **`supabase/v12_geography.sql`** (new reusable geography library and daily composition function).
4. In Supabase → Authentication → Providers, enable **Email**; configure confirmation email templates and your website URL in Authentication → URL Configuration. Add the production domain to allowed Redirect URLs (e.g. `https://your-domain.example/**`). Set up SMTP for production email delivery.
5. Confirm Vercel Production variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, and `NEXT_PUBLIC_CARTO_API_KEY` are present. Keep the service-role key server-only.
6. Run `npm install`, `npm test`, `npm run typecheck`, and `npm run build` locally; fix any issues before deployment. Push changes to GitHub, then redeploy on Vercel.

## What players get
- Seven **Chances** with question-mark icons, replacing hearts. Every guess consumes a chance, including correct guesses.
- `/account`: Supabase Auth email/password registration, email confirmation (if enabled), sign-in, sign-out.
- Authenticated game progress uses the Supabase auth UUID. Guest progress remains available, but is **not automatically merged** into a newly created account. Sign in *before* playing the daily challenge to receive account XP.
- On finishing a daily challenge, XP is **floor(score / 10)**. Practice does not award XP. XP is calculated by a Postgres trigger from saved daily results and cannot be submitted directly by the browser.
- Level = min(100, 1 + floor(sqrt(XP / 10))). Rank names progress from Newcomer to Globemaster.
- Leaderboard shows player level and rank; `/stats` shows XP, level, rank, streaks, milestones and a top-score achievement.
- Public leaderboard name submission requires login. Guests may still play and appear as unranked anonymous results if a result exists, but cannot set a public name.

## Simplified admin `/admin`
- Geography library: add country, then child region, then city, area, district, street, building. Each has a correct name, clue, optional hint, evidence link, latitude/longitude and published flag. The correct answer must **not** appear in its clue.
- Only **complete, published, seven-level chains** are eligible for the new daily generator. A country or state alone does not produce a daily puzzle. Add multiple branches to grow the possible destinations.
- The daily generator chooses an eligible building path, builds all seven clues, saves a frozen challenge, and assigns it once per UTC day. It avoids repeating an eligible building until all have appeared, then repeats. Existing V7 fully-authored challenges remain eligible when there are no complete geography paths.
- Existing authored challenges, including published ones, are listed in the Published Challenges tab and can be edited. For changes to the correct answer, also update the selectable map choices. Changes to a currently active puzzle may affect players; edit between daily resets.
- Admin access still requires a signed-in Supabase Auth user whose email is in `ADMIN_EMAILS`. Removing the public Studio link does not grant access to others.

## Known limitations / operational cautions
- **Do not rerun** `random_daily_rotation.sql` *after* `v12_geography.sql`: it would overwrite the new generator with the older function.
- Existing 20 published challenges must already be in `public.challenges` to appear. If they're absent, run the earlier `supabase/seed_20_challenges.sql` in the same Supabase project and refresh `/admin`.
- New geography nodes are not preloaded. Create a complete 7-level path in `/admin` before the new generator can use them.
- The generator selects existing named map markers and uses anonymous nearby map points when fewer than three choices exist. It does not provide true administrative polygons, street geometry, or building footprints. Coordinates and clues must be verified by an editor.
- A generated challenge is frozen under its building ID; editing source nodes affects new generated paths only if the path hasn't previously been generated. To revise an existing generated challenge, use the Published Challenges editor.
- No automatic migration of guest results to account IDs. Password-reset email and password-update UI are included, but require Supabase email delivery and redirect URLs to be configured.
- Rank and leaderboard anti-cheat protections depend on the existing server-side game validation. These are not sufficient by themselves for a prize-based competition.
- The full Next.js production build was **not** verified in this environment because npm dependencies could not be installed. Existing Node engine tests and new rank tests passed.
