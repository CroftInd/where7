# Phase 2 — Puzzle quality and editorial operations

Implemented on top of Phase 1. Production and its database are unchanged by this branch.

## Result

- A revision-aware Studio workbench supports drafts, review submission, explicit stage-by-stage approval, source and relationship evidence, stable place IDs, coordinates, aliases, choice exceptions and actual player playtesting.
- Publication checks reject generic clues, equivalent answers disguised as alternatives, missing evidence, broken parent chains, invalid coordinates and geometry, and duplicate approved destinations. The United Kingdom's four constituent countries are an explicit sourced exception to the five-choice rule.
- Optional licensed geometry works alongside marker fallbacks. The London practice puzzle includes five real borough polygons with recorded provenance; its street clue now points specifically to Downing Street. This is an initial geometry rollout, not worldwide boundary coverage.
- Daily assignments and started daily/practice/archive sessions retain immutable content snapshots. Editing or replacing content cannot silently change a player's existing clues. Archived practice and current practice have separate saved sessions.
- Studio provides a diverse review queue, approved 30-day schedule proposal, manual scheduling, a protected activation gate, an approved reserve and audited emergency replacement. A replacement changes the challenge for new players while existing players keep their original run and separate results.
- Players can report a reached clue without spending a chance. Reports reference the exact revision and stage, are idempotent and rate limited, and can be inspected and resolved by an authenticated administrator.
- Editorial metrics include recorded review time, starts, stage outcomes and reports. Review time is explicitly entered, not inferred as proof of work.

## Editorial baseline and remaining release gate

Read-only audit of the 75 hosted published puzzles on 22 October 2026 found 46 countries across six continents, three duplicate destination pairs, 53 puzzles with generic clue patterns, three puzzles with equivalent-choice aliases, and 525 stages without the new structured relationship evidence. These are screening results, not a complete factual review. All non-country stages already had five choices.

The Studio proposes 30 distinct destinations across 27 countries and all six continents for review. This queue is **not** 30 approved puzzles. Existing content is never automatically marked reviewed. An editor must verify sources, facts, uniqueness, alternatives, relationships, coordinates, aliases and mobile play, fix flagged content, and approve 30 distinct scheduled puzzles plus a separate reserve. Human factual review and real-device mobile sign-off remain outstanding. No automated test can substitute for these steps.

## Rollout

1. Apply `supabase/migrations/20261022010833_puzzle_quality.sql` before deploying the application. It backfills immutable revisions and current session/assignment snapshots. Take the usual database backup first.
2. Deploy this branch using the existing Supabase environment and administrator identity configuration. Private editorial tables and RPCs are restricted to the service role; administrator routes independently verify the signed-in account.
3. During review warmup, existing structurally eligible published content continues to serve. The migration does not remove the entire legacy pool or invent approvals.
4. Use Studio to repair and review the proposed batch. Schedule the next 30 UTC dates and approve a separate reserve.
5. Activate reviewed-only rotation in Studio. The database refuses activation without complete coverage and a reserve. Once active, unscheduled fallback selection also requires approval.
6. For a broken current daily, use the replacement action with the expected current assignment, an approved reserve and a recorded reason. Existing players remain pinned to their original version.

Never delete immutable revisions to correct a clue; save a new revision. A code rollback does not undo the database migration; retain the additive schema and snapshots. Hosted authentication and the final production migration must be verified at release time.

## Verification

- 58 unit tests, TypeScript and production compilation.
- Isolated PostgreSQL tests execute the real migration twice and exercise revision conflicts, immutable history, atomic schedules, activation, replacements, report limits and database permissions.
- A production Next server uses the actual Supabase client against an isolated PostgreSQL REST test adapter to exercise daily/practice/archive freezing, restart behavior, replacement and reached-clue reports. This does not test hosted Supabase Auth or its PostgREST transport.
- Browser checks cover malformed JSON, draft saving, review gating, local playtesting, historical report inspection, mobile reporting and borough geometry. Editorial HTTP responses are mocked in that UI harness; database behavior is checked separately.
- CI repeats the unit, atlas, type, build, demo-flow, content database and content API checks.

Commands: `npm test`, `npm run test:content-db`, `npm run typecheck`, `npm run build`, `npm run test:flow`, `npm run test:content-flow`. Run `npm run content:audit -- /path/to/private-catalog.json` for a read-only screening report; do not commit unreleased daily clues or service credentials.
