# WHERE7 — Phase 2: Explorer Passport & Progression

## Features

- `/rewards` Explorer Passport dashboard: current level, rank, cosmetic title unlock, XP meter, quests, six-week expedition calendar, collectible badges, streak protection.
- Three daily missions, three weekly quests; authoritative UTC reset (daily midnight UTC; weekly Monday midnight UTC). Practice and archive mode never earn mission progress.
- Claim mission XP individually or with Collect All; claims are saved exactly once under a unique `(user_id,reward_key)` key. XP stays additive with existing validated daily score XP.
- Weekly five-day quest awards a streak shield, with wallet capacity 2. You may spend a shield to cover yesterday if the preceding day had a real completed daily expedition; no consecutive missed-day protection.
- Level-up celebration, trophy collection, claim confirmations and premium mobile-responsive cards. Motion honors OS reduced-motion.
- End-of-day reward reveal in existing game results modal, and links from gameplay, navigation, and statistics.
- Guest visitors can view mission progress and badges; signing in is required to collect XP, level up and save shields. Guest game sessions remain browser-specific; no automatic migration of old guest results into new accounts.

## Security and integrity

- All reward eligibility is recomputed server-side from finished daily results. No client-provided XP or goal progress is trusted.
- New private ledger tables have RLS enabled and no browser Data API privileges; only the server service key can mutate them. The application verifies Supabase Auth `getUser()` for every claim.
- Claim deduplication is database-enforced; old daily XP formula and existing accounts are preserved via an updated server-side trigger.
- Date validation, unique days, UTC rollover, shield stock, missed-day restrictions and repeated-claim behavior are covered by tests.
- No changes to the map renderer, accounts, difficulty, game rules, or daily anti-restart policy.

## Installation and rollout

1. Apply `supabase/phase2_progression.sql` on the WHERE7 Supabase project (not Daily Guess) before enabling the new feature in production. The script only adds two private tables and extends the XP trigger.
2. Deploy the code through `main` after preview and CI build tests pass.
3. Confirm `/rewards`, `/api/progression`, end-of-game reward card, XP and badge unlocking with a test account. Claims should change XP once, not on refresh. Try a guest session and a practice session.
4. GitHub quality CI: `npm test`, `node scripts/verify-atlas.mjs`, `npm run typecheck`, `npm run build`.

## Notes

- Reward XP is claimable for the current UTC day and week, then that period expires.
- Streak shields are earned only after the weekly five-day quest is claimed; at most two can be stored.
- A protected day maintains an account's streak but does not count as a daily game, quest completion or leaderboard entry.
- Sound, haptic and reduced-motion settings from Phase 1 are unchanged.
