# WHERE7 — 20 additional daily challenges

## Install (no code changes needed if V7 is deployed)
1. Open your existing Supabase project → SQL Editor → New query.
2. Paste `supabase/seed_20_challenges.sql` and Run.
3. In WHERE7 `/admin`, refresh the Challenge Studio. The 20 published puzzles appear in the library.
4. The existing random daily rotation selects from these and your other published challenges, without repeats until the pool is exhausted. Existing dates stay fixed.

## What's included
- 20 seven-stage puzzles with 3 clickable choices per stage after Country.
- Each challenge has a source URL for its landmark.
- Original V7 files are unchanged; this bundle adds only data, SQL and documentation.

## Important map/content limitations
- At stages 4–7, incorrect choices are deliberately labelled 'Map point north' and 'Map point south' rather than falsely named places. They are approximate map positions, NOT official districts, street geometries or building footprints.
- Some local area/precinct/street relationships are editorial approximations. Review coordinates, wording and source links in Admin before public release.
- The source URLs identify the landmark; they are not independent verification of every sublocation.
- The existing game uses clickable markers for stages 2–7; true polygon/road/building selection is a separate future feature.
- Publishing does not modify already-assigned dates.
- SQL requires the existing `public.challenges` schema; no API keys are needed in the SQL.
