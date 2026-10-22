# First-expedition roadmap — Phase 1 implementation

This implements Phase 1 of the improvement roadmap dated 22 October 2026. It is separate from the older numbered roadmap release notes in this repository.

## Player-facing changes
- A shorter header with secondary destinations in an expandable menu on every screen size.
- Optional first-expedition guidance and a concrete correct/incorrect example of the seven-chance rule.
- A searchable, keyboard-operable list of all bundled country selections and the same authored regional/local candidates used on the map. Country results are not truncated to 25.
- A selection preview and explicit confirmation; both correct and incorrect guesses still use one chance.
- Readable scrollable clue content, a labelled mobile grip, and a scroll reset when opening a new clue.
- Focus containment, Escape dismissal and focus return for instructions/results; a skip link to the clue/list; visible focus and reduced-motion support.
- Retry controls for country names, map initialisation and regional boundaries. Map retries do not reload the game or spend a chance.
- A local-time daily-reset explanation, an expired-day action, and a result clock that stops when the run ends.

## Progress integrity
Every mutation includes the version, stage and challenge ID the player saw. Daily mutations also include the UTC date returned by the server. A wrong guess or hint changes the version even if the stage stays the same. A replay of an accepted request is rejected with HTTP 409 instead of spending another chance.

The API pins the day once per request and passes it to challenge selection and session reads/writes. Requests from yesterday cannot mutate today's session, including when a puzzle is repeated. Practice restart advances the version through the existing compare-and-swap save rather than deleting the row and returning to version zero.

Client requests have a 20-second timeout and no automatic POST retry. An interrupted response pauses play and offers **Check saved progress**. A GET reconciles the authoritative state before another action. Returning to a visible tab also checks the saved state. All newly introduced timers/listeners/fetches have cleanup.

No schema migration or new public database access is required. Existing server-only identity and optimistic-locking queries remain in use. Supabase metadata was checked read-only to confirm the deployed session version column; production player records were not inspected or modified for testing.

## Baseline measurement
The game API emits structured JSON logs with source `where7_game`:

| Event | Meaning |
| --- | --- |
| game_loaded | An authoritative state was successfully read; includes resumed runs |
| game_started | First accepted guess of a run |
| guess_accepted | A guess was saved; includes incorrect guesses |
| guess_rejected | A request with session context failed validation/save |
| stage_reached | A saved correct guess unlocked the next stage |
| game_completed | A run transitioned to won/lost |
| game_abandoned | A player explicitly gave up |
| share_action | A completed result was successfully passed to native share/clipboard, then acknowledged by the API |

Fields are restricted to an opaque session hash, UTC day, mode, stage, guess count, version, status and a fixed rejection category. No submitted answer, place/challenge identifier, clue, email, auth UUID or raw guest cookie is logged. These are operational logs, not a new analytics dashboard. Retention depends on hosting/log-retention settings; configure durable export before relying on long-term cohorts.

Deduplicate loads by session/day for first-guess conversion. Infer silent abandonment from started sessions without a completed event inside a chosen observation window; `game_abandoned` only means explicit give-up. Native share acknowledgement does not establish that another person read a share. Loading/network failures also require HTTP error monitoring; unsuccessful initial loads have no successful `game_loaded` event.

## Verification
- `npm test`: 47 tests, including seven new request/event regressions.
- `node scripts/verify-atlas.mjs`: bundled map assets, sizing and fallback safeguards.
- `npm run typecheck` and `npm run build`: pass. The build retains an existing unrelated CSS autoprefixer warning in the rewards styles.
- `npm run test:flow` (after build): isolated local demo API integration covering concurrent duplicate wrong guesses, stale replay, hint conflicts, restart conflicts, all seven correct stages, reload, share logging, invalid/missing versions and daily-date/restart guards. Its child server explicitly disables cloud credentials, so CI does not play against production.
- Chromium browser checks: desktop and iPhone-sized touch viewports; location preview/confirmation/reload; menu and guide dismissal; no horizontal document overflow; progress through a boundary-service failure; and a successful POST whose reply is deliberately dropped, followed by GET recovery with exactly one chance spent. No page JavaScript errors were observed.
- Visual inspection found and corrected compressed clue content and map notices overlapping the mobile sheet. External map tiles/styles failed in this test environment, so outage behaviour was exercised; this is not a claim that production tile delivery was verified.

## Remaining release gates
These are explicitly pending, not claimed as completed:
- Real iPhone Safari and Android Chrome device checks with the production map provider.
- Signed-in end-to-end persistence against a designated test account/isolated environment. Local integration uses guest demo storage; Supabase schema compatibility was checked separately.
- The roadmap's ten-person usability trial: at least eight should understand the chance rule and submit a first guess without coaching.
- A preview smoke check using deployed configuration before promotion to production.

## Rollout and rollback
Deploy frontend and API together. Existing open tabs should reload after rollout to obtain the version-aware client. The API rejects stale clients safely. No database migration needs rolling back; revert this change set to restore the previous code. Do not run both API versions behind a mixed rollout while expecting old clients to send the new fields.
