# WHERE7 V11 — Country-first clue correction

The first clue of each of the 20 imported challenges now describes the COUNTRY rather than a landmark or city. Stage 2 remains state/region, stage 3 city, followed by area, district, street and building.

## Apply to your LIVE database
1. Back up `public.challenges` (especially if you manually edited any country clues).
2. In Supabase > SQL Editor > New query, paste `supabase/fix_country_first_clues.sql` and click Run.
3. Refresh the `/admin` challenge editor to view the revised stage-one clues.
4. No Vercel redeploy is needed for existing Supabase challenge records.

This script changes ONLY stage 1 clue and hint for the 20 seed IDs. It does not reset daily assignments or scores. If you have custom edits to these specific stage-one clues/hints, they will be overwritten.

The remaining six clues retain their progressive region > city > area > district > street > building design. Review local-level clues and approximate map markers before production.
