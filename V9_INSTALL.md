# WHERE7 V9 — editable published challenges + proper clues

## Why this update
The 20 previously seeded challenges contained answer-revealing wording such as "Select that region" and even named the answer. The replacement clues describe history, architecture and geography without directly instructing players to click the answer.

## Update the live Supabase content (essential)
1. Back up the `public.challenges` table.
2. Open Supabase > SQL Editor > New query.
3. Run `supabase/fix_20_challenge_clues.sql` once. This updates only the `clue` and `hint` fields of the seven stages for the 20 seed challenge IDs; it preserves all answers, map positions, publication status and daily assignments. **It overwrites previous custom edits to those clues and hints**, so review before running.
4. Refresh `/admin`, select any published challenge in the left sidebar, edit its seven stages, and click **Save challenge**.
5. To deploy the improved editor, copy `components/Studio.tsx` into the existing project, then build and push to Vercel.

## Important
- Already-open game sessions may receive updated clues on their next request. Avoid editing an active daily puzzle.
- The imported data still contains approximate map points for some lower stages; the clues are improved, but real administrative polygon and street/building footprint gameplay needs additional data.
- This patch does not change the rotation SQL, schema, API keys, or admin permissions.
- The challenge title is hidden until completion by the existing game API, but admins can see all answers.
