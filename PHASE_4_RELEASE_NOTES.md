# WHERE7 Phase 4 — The Explorer Arcade

## Delivered
- /explore Practice Explorer: filter the published library by continent, difficulty or completed status and launch unlimited unranked challenges on the existing interactive map.
- Six continental expeditions assemble five-stop itineraries from real published destinations.
- /arcade Time Attack: 15 server-selected questions with a three-minute server-enforced timer; 100 points per correct answer.
- Private asynchronous duels: account-holders exchange ten-character invitation codes, answer the same questions and compare server-scored results.
- Arcade run history with resume links, with no arcade XP or daily-streak impact.
- Explore and Arcade links in desktop and mobile menus.

## Security
Arcade questions and answers are stored only in private Supabase arcade_runs and arcade_duel_rooms tables, with RLS and service-role-only permissions. Public API payloads omit correct answers. Submissions verify the current server-stored question, account identity, run ownership, optimistic question index, and expiry time. Practice and arcade modes never award official daily XP. Duel codes are cryptographically random.

## Scope boundaries
The continent itinerary is a five-stop selection, not a stored cross-session quest. Arcade rounds use quick text selections derived from official map challenges, rather than rendering a separate interactive map for every rapid question. League matchmaking and duel prize rewards remain future options.

## Verification
Run npm test, npm run typecheck and npm run build. Confirm the preview deployment is Ready, review the Supabase access-control scan, and run signed-in browser checks before describing duel UX as fully verified.
