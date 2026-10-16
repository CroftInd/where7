# WHERE7 automatic daily rotation

1. **Back up your Supabase project and current source code.**
2. Supabase Dashboard → SQL Editor → New query: paste and run `supabase/random_daily_rotation.sql` **once**.
3. Deploy the updated project to Vercel (same environment variables; no new keys).
4. Open `/admin`, sign in with your authorised Supabase account, and create challenges using **Blank challenge** or **New from template**. Fill in all seven stages, valid sources and choices, change status to **Published · Eligible for daily rotation**, and **Save challenge**. The publish-date field is optional and ignored by the rotation.
5. The first visitor each UTC day causes Supabase to choose one random unused published challenge. All visitors get the same challenge for that date. Once every published challenge has been used in the current cycle, a new cycle begins and repeats are permitted. Publishing new challenges makes them eligible immediately on future days.

**Important:** Publish at least one challenge before deploying this update. Seed examples are still available for practice but are not automatically included in the daily pool. Existing historical assignments are not backfilled. The rotation begins when the first daily request arrives after deployment.

Daily sessions and leaderboard results are now scoped to UTC date plus challenge ID, so replaying the same puzzle on a later day starts a fresh official game. Older results remain stored but will not appear in the newly date-scoped daily leaderboard. Practice sessions are unchanged.

**Known limitation:** Results/statistics from the older V6 build use a different daily challenge ID format. The existing statistics page will still read them, but repeated daily challenges appear under their date-scoped IDs. Historical archive listing continues to use manually set publish dates and is not yet a listing of rotation assignments.
