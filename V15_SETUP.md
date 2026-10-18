# WHERE7 Atlas V15 — Visual polish and daily rewards

This is the full project based on V14.1, not a SQL migration.

## Changes
- Animated stage-discovery starburst, polished transitions, improved buttons/cards and reduced-motion support.
- Responsive mobile layout: map remains behind a compact bottom sheet, with progress and score visible when collapsed. Tap the sheet header to expand clues and controls.
- In-game XP preview calculated from the current verified score using the existing `xpFromScore` rule.
- Results screen shows XP earned for daily play and links to stats/ranks. Practice displays an **estimate**, not a promise of credited XP.
- Stats page now displays a rank/level passport, progress to the next level, streak reminder and achievement unlock count. Data still comes from `/api/stats`.

## Install
1. Back up your current WHERE7 project and database.
2. Extract this ZIP into your project, keeping `.env.local` and all existing Vercel environment variables.
3. Run `npm install`, `npm run typecheck`, `npm test`, `npm run build` in VS Code terminal.
4. If successful, run `git add .`, `git commit -m "Polish mobile game and rewards"`, `git push`.
5. Check https://where7.world on mobile and desktop, especially the bottom sheet and end-of-game screen.

## Notes
- No new SQL or external service is required.
- This update does not create new backend reward types, XP bonuses, daily missions, or notification schedules; it enhances the presentation of existing XP, ranks, streaks and achievements.
- Test results: source edits made, but dependencies were not available in this environment and an offline `npm install` could not download them. Run local typecheck/build before deploying.
