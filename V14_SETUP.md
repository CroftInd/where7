# WHERE7 V14 — responsive map and mobile clue sheet

## Changes
- Map choice dots and labels are now native MapLibre WebGL GeoJSON layers, not HTML markers. This removes the independent DOM marker repositioning that caused visible lag while panning and zooming.
- Choice hit targets and labels are clickable directly on the map.
- Mobile opens with a compact clue sheet at the bottom, keeping the map visible and interactive. Tap the sheet header to expand or collapse the clues.
- Expanded sheet uses up to 54% of the mobile viewport, scrolls internally, and never replaces the map.
- Map resize observer accommodates viewport changes; stage transitions are shorter.

## Install
1. Back up your existing project.
2. Copy the V14 project files over your V13 project, retaining your own `.env.local` and Vercel environment variables.
3. Run `npm install`, `npm run typecheck`, `npm run build`.
4. Commit and push to your connected GitHub repository to deploy on Vercel.
5. Test a country and marker-based stage on both mobile and desktop.

No new Supabase SQL migration or API keys are required.
