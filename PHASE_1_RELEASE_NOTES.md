# WHERE7 — Phase 1: Premium gameplay polish

This release builds on V15.6 (CARTO Voyager restoration). It does not change scoring, Supabase schema, account permissions or existing daily session policies.

## Player experience
- Collapsible mobile bottom sheet with a readable two-line clue preview, swipe-up/down gesture, expandable scrollable clue details and phone safe-area spacing.
- Map selection **previews** a country/region/marker first. Only tapping **Confirm guess** sends the server request that spends one Chance. Escape or Change cancels a selection. Country-list selections use the same confirmation flow.
- Animated score counts, short location-confirmation banners, a selected-marker halo and existing success particles (disabled when reduced-motion is selected).
- Saved sound/haptic/reduced-animation preferences. Haptics are opt-in and only run on supported browsers.
- Camera targets avoid the desktop clue panel, and camera flights no longer replay whenever a submission or hint toggles the busy state. Camera animation follows reduced-motion preferences.
- Map loading status, retry UI and the original Voyager vector/raster fallback; the V15.5 MapLibre absolute-position sizing fix is unchanged.
- Friendly Next.js route error boundary with a retry action that doesn't restart official daily sessions.

## Quality gates
- `npm test` — game/XP unit tests and presentation layout tests.
- `node scripts/verify-atlas.mjs` — verifies both GeoJSON files, names, essential CSS sizing override, Voyager basemap and the selection confirmation flow.
- `npm run typecheck` and `npm run build` — must pass in CI.
- `.github/workflows/quality.yml` runs the above on pushes to main and pull requests. It does not require production Supabase credentials.

## Manual acceptance tests before inviting players
1. Mobile (~375×667, 390×844), Safari and Chrome: read the compact clue, open sheet via tap/swipe, scroll clue text, close sheet and still pan/zoom the map. Rotate the phone and repeat.
2. Tap a country or marker: it should highlight, **not spend a Chance**. Tap Change: nothing should be submitted. Tap Confirm: exactly one Chance is used.
3. Trigger one correct and one incorrect practice guess; check banners, score animation, marker updates, haptics if enabled, and persisted sound settings after refresh.
4. Test stages country, region and street/building. Use +/- zoom and recenter; markers should stay anchored. With reduced motion turned on, map camera changes should happen without animation.
5. Temporarily block `basemaps.cartocdn.com` in browser DevTools to check the fallback map remains interactive. Confirm that `/world-countries.geojson` and `/microstates.geojson` load as JSON.
6. Check the Vercel production build and browser Console for errors. Test practice and daily modes separately so official daily games remain protected from restart.

No changes to environment variables or database migrations required.
