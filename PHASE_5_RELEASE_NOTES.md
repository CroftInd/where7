# WHERE7 Phase 5 — Challenge Studio 2.0

## Delivered
- Searchable, filterable country-to-building location tree. Selecting an existing node opens its editor.
- Interactive Voyager coordinate picker: click the map or drag its pin to update latitude and longitude.
- Saved reusable clue templates, with a template picker per geographical stage.
- CSV bulk geography importer, supporting quoted fields, 100 rows/batch, local preview and server-side dry-run. Parent links must reference an existing location and all validation is applied before one atomic database insert.
- Player-style challenge preview of clues and selectable options without granting points or changing saved sessions.
- Publication-quality dashboard showing verified five-choice challenges, complete seven-stage node paths and broken parent links.
- Improved responsive layout and five-option limit in the challenge editor.
- Critical daily challenge rotation repair: the database no longer generates incomplete three-option challenges. Only verified seven-stage, five-choice published challenges can enter the cycle; recently used countries are less likely to recur.
- Phase 5 server routes stay protected by the existing requireAdmin check.

## Database changes
Applied to the WHERE7 Supabase project:
- geography_clue_templates (RLS on, service-role-only).
- where7_assign_daily_challenge(date) updated in an additive/compatible migration. Existing scheduled assignments are returned unchanged.
No existing challenge choices, results, scores or player progress were deleted.

## Operational guide
Sign into /admin with the configured administrator account. The Geography library tab searches all nodes and edits coordinates. The CSV Import tab takes the provided template; perform Validate first, then confirm Import. The Quality audit tab lists anything blocking verified publication. Open Published challenges, select a puzzle, then inspect Player view preview before saving.

## Important constraint
New geography nodes are reusable content assets, not automatically published daily challenges. To release a new seven-stage path, author a full challenge with five real named options per non-country stage and publish it through the reviewed editor. This prevents the former placeholder-marker regression.

## Release checks
npm test, npm run typecheck, npm run build, Vercel preview Ready, quality audit and Supabase security audit. Hands-on content editing with an admin account remains a follow-up quality check.
