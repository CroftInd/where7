# WHERE7 — Five geographic choices release (21 October 2026)

## What changed
- Every one of the **75 published challenges** across **46 countries** has **exactly five options** for every stage after Country (State / Region, City, Area, District, Street, Building): **450 stages and 2,250 selectable locations** in total.
- Five visible, keyboard-accessible option buttons on the game screen. Selecting an option previews it; **Confirm guess** is the only action that spends a Chance.
- The MapLibre camera fits the bounds of all five choices, rather than zooming directly towards the hidden correct answer. Existing Voyager basemap and responsive layout remain unchanged.
- Country selection still uses the full interactive world map.
- Publishing through the admin route now rejects challenges unless each non-country stage has exactly five distinct real named options and the correct answer is present. Draft challenges and bundled examples may retain their previous sizes.
- Name normalization now preserves international scripts (Arabic, Japanese, Chinese, etc.) rather than treating every non-Latin name as the same value.

## Geography and QA
- Source locations were assembled from GeoNames, geoBoundaries and OpenStreetMap/Nominatim, with local names and coordinates. Location choices have deterministic order for each challenge.
- Existing correct-answer text, clues, hints, scoring, history and daily game restrictions were preserved.
- **Bogotá**: repaired its Gold Museum challenge's latitude from -4.6018 to **+4.6018** and the six corresponding reusable geography nodes.

### Database verification
After applying the Supabase updates, the audit returned:
- 75 published challenges / 450 non-country stages
- 450 stages with exactly 5 choices
- 450 stages with 5 distinct names
- 450 stages containing exactly 1 match for the original correct answer
- 0 invalid coordinates or generic “Map point” placeholders

## Rollback safety
Before modifying any challenge, original stages from all 75 published challenges were saved to private Supabase table `public.where7_stage_backups` under the tag `five_choices_20261021`. RLS is enabled and browser roles have no table-read privileges. Backups are available to the server role only.

To restore the original stage configuration **only if you deliberately choose to roll back the data**, use the SQL below in the WHERE7 Supabase SQL editor. This would also restore the old 3-choice stages and the original Bogotá challenge latitude; it does not revert the six corrected geography-library nodes.

```sql
UPDATE public.challenges c
SET stages = b.stages, updated_at = now()
FROM public.where7_stage_backups b
WHERE b.backup_tag = 'five_choices_20261021'
  AND c.id = b.challenge_id;
```

The user-facing map code can be rolled back independently through Vercel and GitHub.

## Future content standards
Only publish a new challenge when each of the six non-country stages has one correct choice and four genuine alternatives at the intended geographical scale. The admin API enforces this, and development tests include multilingual names and publication validation.
