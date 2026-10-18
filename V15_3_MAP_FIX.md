# WHERE7 V15.3 — map startup repair

## What was actually wrong in V15.2

The previous MapCanvas initialised the entire interactive layer tree behind `map.isStyleLoaded()`. With a style that includes remote raster tiles, `isStyleLoaded()` may remain false while tiles are downloading or failing. The `style.load` event can fire before this condition becomes true. This could leave an ocean-coloured blank canvas with no country polygons, clickable regions, or place markers.

There was also a `gl.supported()` call absent from the installed MapLibre v5 TypeScript API. That has been removed.

## What's different

- The first style has a **locally defined ocean background** and no external raster dependency.
- Adds country borders, country clickable fills, regions and native circle markers as soon as the local style is ready, *without* an `isStyleLoaded()` gate.
- Country land fill is visible when optional map tiles fail.
- External CARTO raster basemap tiles are an optional overlay underneath the interactive map, never a prerequisite for play.
- Attaches resize handling even before the first layer is ready. Handles background tab restoration.
- Adds more visible warning text when tiles fail.

## Install

1. Back up your current project. Extract and copy the new project files over it, preserving `.env.local`.
2. Run `npm install`, `npm run typecheck`, then `npm run build`.
3. After a clean build: `git add .`, `git commit -m "Decouple interactive map from basemap tiles"`, `git push`.
4. In Vercel check deployment is **Ready**, then open https://www.where7.world in an incognito window and hard-refresh.
5. Test desktop AND mobile, and select a country. If blank remains, press F12 > Console and send the red error text and the Network requests for `world-countries.geojson` and `dark_all/...png`.

No SQL migration is required. The API/environment variable values remain unchanged. If third-party map tiles fail, the interactive land outlines should still load. A browser with WebGL unavailable still cannot display a MapLibre WebGL map.

I could retrieve the production HTML from https://www.where7.world but did not obtain a live browser console or complete production build; this fix is based on inspection of the actual V15.2 code and documented MapLibre loading behaviour.
