# WHERE7 Supabase-connected features upgrade

New routes:
- `/stats` — persistent guest statistics, streaks, achievements and recent expeditions.
- `/archive` — previously published challenge archive, linking to practice mode.
- `/api/stats` — authenticated-by-guest-cookie stats derived from server-side Supabase results.
- `/api/archive` — safe public metadata for previously published challenges, without revealing answers.

Existing game routes, server-validated guesses, daily leaderboard, admin studio and MapLibre/CARTO vector map are preserved.

## Install

1. Back up your current project or commit your changes.
2. Copy the new files and modified `components/Game.tsx` from this ZIP into your existing WHERE7 project, preserving directory paths. **Do not overwrite `.env.local`.** If your live project contains newer changes, merge them rather than overwriting.
3. Confirm Vercel has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_CARTO_API_KEY`. Keep the service role key server-only.
4. The existing `supabase/schema.sql` already includes the `results` table used for statistics; no new SQL migration is required if that schema is installed.
5. Run `npm install`, `npm run typecheck`, `npm run build` locally, then commit and push.
6. Complete a daily game and visit `/stats`. Published scheduled puzzles will appear under `/archive` after their publish dates.

Notes: Guest stats belong to a browser cookie; they do not follow the user between devices. Streaks currently use UTC completion dates. Achievements are calculated from stored results (no separate achievement table). Only completed results count.

Testing: The 10 existing Node tests passed. A full Next.js build could not be run in the creation environment because dependencies were not installed.
