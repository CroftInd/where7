# WHERE7 Atlas V10 — first-visit guide, private admin link, archive fix

## What changed
- First visit to the game opens How to Play automatically. Clicking Begin expedition or closing it marks the guide as seen in browser localStorage. The How to Play button always reopens it.
- Removes Studio from public game navigation. `/admin` remains accessible directly and still requires Supabase Auth and ADMIN_EMAILS authorization.
- Archive lists completed daily assignments from `daily_challenge_assignments` (previous UTC days), rather than filtering `publish_date`, which is null for random-rotation challenges.
- Today's challenge is not revealed by the archive.

## Important: why admin says no challenges
The admin Challenge Library shows saved rows from `public.challenges` plus bundled example drafts. It is NOT populated by waiting for the day to end. If your 20 new challenges aren't listed, the seed SQL was likely never imported into the SAME Supabase project used by the deployed website, or the admin API is returning an error.

In Supabase SQL Editor, run:
select status, count(*) from public.challenges group by status;
select challenge_date, challenge_id from public.daily_challenge_assignments order by challenge_date desc limit 10;

If no published rows, run `supabase/seed_20_challenges.sql` (included in this project). The SQL seed adds the 20 challenges as published. If the challenge table is already populated but admin doesn't show them, check `/api/admin/challenges` while signed in and inspect the returned error, and verify Vercel Production variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS` are set.

If the archive is empty today, that's expected until there is a previous day's assignment. It is not tied to the challenge's publish_date. No SQL migration is needed for this archive fix if `supabase/random_daily_rotation.sql` was already run.

## Deploy
Replace `components/Game.tsx`, `app/api/archive/route.ts`, `app/archive/page.tsx` from this ZIP in your project. Run `npm run build`, then git add/commit/push. Keep existing .env.local and database.
