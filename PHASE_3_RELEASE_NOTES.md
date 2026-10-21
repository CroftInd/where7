# WHERE7 Phase 3 — Social Expeditions

## Delivered
- Explorer handles (3–18 characters, unique), with discoverability and public leaderboard participation independently opt-in and both off by default.
- Find explorers by username, invite them, accept/decline requests, remove friends.
- Private groups (up to five owned per player, max 30 members), join using a private ten-character invite code, see private group score rankings.
- Verified daily/weekly/monthly score leaderboards across friends, groups and opt-in global participants. Monthly divisions: Bronze, Silver, Gold, Platinum, Diamond.
- Zero client-side trust in competitive totals: the server reads only the persisted official daily result rows. Practice mode is excluded. Duplicated daily records are deduplicated.
- Spoiler-free daily result sharing using a seven-cell emoji score grid, including native share or clipboard fallback.
- Social Hub at /social with dedicated responsive layout and game header/mobile links.

## Privacy and controls
Only authenticated accounts may set social handles, add friends, join groups, or query rankings. Connections/groups/profiles are stored in Supabase with RLS enabled; anon and authenticated database roles have no direct table grants. Service-role-only API endpoints verify Supabase auth on each request, check same-origin writes, validate inputs, and never return email addresses or challenge answers. Groups are visible only to members and invite codes only to members. Discovery and global ranking are independent opt-ins.

## Release verification
Run npm test, npm run typecheck, npm run build. Vercel preview must show Ready before promotion to production. Test new-user signup, handle uniqueness, accept/reject a request, group join, and public-board opt-in with two different accounts to confirm privacy boundaries.

## Database migration
Applied to the WHERE7 Supabase project: public.social_profiles, public.social_connections, public.social_groups and public.social_group_members. All four use RLS and are service-role-only. No changes to official scoring, XP, streaks, or challenge content were required.

## Honest limitations
Seasonal divisions are based on monthly accumulated verified points; full automatic promotion/relegation against independent matchmade cohorts is a subsequent enhancement. Head-to-head live matches and payments are not part of Phase 3.
