# WHERE7 · Atlas V5 (Next.js application)

**Seven clues. Seven hearts. One place.**  A responsive geography game that moves from the world to a specific building.

This folder is a **new multi-file application**, not a drop-in replacement for the old `where7_daily_quiz.html`. The original standalone Atlas file is included separately under `legacy/` as a working reference. The new implementation adds a server-validated game API, MapLibre mapping, a protected Supabase Challenge Studio, and beta leaderboard infrastructure.

## What is implemented

| Area | Status |
| --- | --- |
| Atlas-inspired responsive UI, animated hearts, map control, audio toggle, clues, hints, share card | Implemented in code |
| Seven-guess rule (every answer costs a heart; only seven correct unlock the building) | Implemented; unit tests passing |
| MapLibre world-map interface | Implemented; relies on WebGL and optional online raster map tiles |
| Country map | 177 Natural Earth polygons + 29 small-country markers (not a fully exhaustive territory dataset) |
| Regions/states | `geoBoundaries` ADM1 real boundaries loaded on demand; named fallback pins if unavailable |
| Cities, boroughs/areas, districts, streets, buildings | Map-based selectable location points; not yet complete official polygons, true clickable road geometries, or building footprints |
| Factual statements | Two example packs with source links; further independent editorial review required |
| Server-controlled answers, hearts, points, hints, current clue | Implemented via API routes |
| Supabase persistence | Implemented, activated after configuration |
| Locked-down admin login, challenge creation/edit, seven-stage builder, source links, map coordinate picking, publish scheduling | Implemented, requires Supabase Auth and env variables |
| Public beta leaderboard and name submissions | Implemented, requires Supabase; guest identities are *not strong anti-cheat* |
| Complete user accounts, advanced stats, personal achievements, 30+ reviewed daily puzzles, analytics, tournament modes, payments | **Not yet implemented** |

The frontend and map have **not undergone a complete live end-to-end browser test in this environment** because network access here prevented `npm install`. The domain logic tests and TypeScript/TSX syntax checks have been run. Run `npm install`, `npm run typecheck`, `npm run build`, and test map interactions in Chrome before public deployment.

## A. Run it on your Windows PC (first-time setup)

1. Extract the ZIP to a new folder, for example `C:\Users\YourUser\Desktop\where7-next`. Do not unzip it inside your existing `daily-guess-production` project unless you intend to combine the two applications deliberately.
2. Install Node.js (Node **22.6+** (Node 22 LTS or newer)) and open the folder in Visual Studio Code.
3. In VS Code choose **Terminal → New Terminal**, then paste:

   ```powershell
   npm install
   npm run dev
   ```

   If PowerShell blocks `npm.ps1`, run `npm.cmd install` and `npm.cmd run dev` instead. This avoids changing Windows execution policy.
4. Open **http://localhost:3000**. Without a database it starts in **demo mode** using two sample puzzles; game progress is held in the local development server's memory and will reset if the server restarts.
5. Open **http://localhost:3000/admin**. The page explains how to connect Supabase; publishing is intentionally unavailable without secure configuration.

### Commands

```powershell
npm run dev        # development server
npm test           # seven-guess rules and validation tests
npm run typecheck  # TypeScript verification (after npm install)
npm run build      # production build (after npm install)
npm run start      # run the production build
```

## B. Connect Supabase (required for daily shared progress and admin)

1. Create a **new Supabase project** or use a deliberately separate schema from an existing project; do not run `schema.sql` against an unrelated project without reviewing its table names.
2. Open **SQL Editor**, copy `supabase/schema.sql`, execute it. It creates `challenges`, `game_sessions`, and `results`, enables Row Level Security, and prevents public direct writes.
3. Open Supabase **Project Settings → API** and copy your URL, public/anon key, and **service role key**. Keep the service role key secret.
4. Copy `.env.example` to `.env.local` and enter:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR-SECRET-SERVICE-ROLE-KEY
   ADMIN_EMAILS=you@example.com
   ```

5. In Supabase **Authentication → Users**, create an account for your chosen admin email (or enable a safe sign-up workflow). Use the email and password on `/admin`.
6. Restart the local development server after changing environment variables. The game now uses database persistence; `/admin` can list and publish challenges.

**Security:** Never prefix the service-role key with `NEXT_PUBLIC_`. Never commit `.env.local`. Both the service role key and `ADMIN_EMAILS` must exist only in server environment configuration. Admin routes verify the active Supabase user server-side, then match the allowed email list. The challenge/game/results tables have RLS enabled with no direct public access policies.

### Content scheduling

- Use `/admin`, choose **New from template** or **Blank challenge**, fill all seven stages, and set the desired `YYYY-MM-DD` date.
- Stage 1 uses actual country map shapes (plus small-country markers). Stage 2 loads ADM1 shapes where geoBoundaries coverage is available. Later stages use your configured selectable map coordinates.
- For each stage, include a *specific* factual source and at least three selectable alternatives (country stage excepted).
- Save as **draft** until all clues and geographic selections have been checked. Set status **Publish on date** to make it eligible for the official daily puzzle.
- The API uses UTC dates; a scheduled challenge is selected globally on the matching UTC calendar day.
- If no published challenge is scheduled for the date, the app rotates between the two built-in examples. **Populate a reviewed library before announcing a public launch.**
- The data validation ensures URLs are HTTPS and the stage structure is valid. It **does not automatically verify the factual claim**; that requires human editorial review.

## C. Deploy with GitHub and Vercel

In the project folder, run:

```powershell
git init
git add .
git commit -m "Initial WHERE7 Atlas V5"
git branch -M main
```

Create an **empty new GitHub repository** such as `where7-atlas`, then copy the repository URL and run:

```powershell
git remote add origin https://github.com/YOUR-USER/where7-atlas.git
git push -u origin main
```

In Vercel, choose **Add New → Project**, import that repository, accept the Next.js framework preset, and add the same production environment variables (including `ADMIN_EMAILS`). Click **Deploy**. Deploy with a licensed map tile service appropriate for your usage level.

Later updates:

```powershell
git status
git add .
git commit -m "Improve WHERE7"
git push
```

### Map data and reliability

- Maps use **MapLibre GL JS** and optional CARTO raster tiles. A styled map needs internet connectivity; the bundled world boundaries can still draw if tiles fail, **provided MapLibre itself has been installed and WebGL works**.
- `public/world-countries.geojson` contains simplified Natural Earth world geometry. It is not a complete all-territory/high-resolution dataset, nor a legal boundary authority. `public/microstates.geojson` adds individually selectable points for 29 small sovereign locations that aren't available as large polygons at this scale.
- Stage 2 fetches `geoBoundaries` `gbOpen`/`ADM1` data via an API route, not hand-drawn fake state polygons. The dataset is **CC BY 4.0**; credit geoBoundaries where displayed and retain all applicable attributions.
- City/district/street/building stages are currently correct/decoy **map pins**, not verified street centerline segments or exact building footprints. Before V1.0, convert them to official/local boundary or OpenStreetMap feature geometry where that data is available and legally usable.
- The default sample `NEXT_PUBLIC_MAP_TILE_URL` uses public CARTO dark tiles. For a public/commercial launch, use a **licensed paid/self-hosted map tile provider** and follow its rate limits/terms. Do not bulk-load from the public OSM tile server without checking its policy.
- `public` boundary data isn't secrets. In contrast, future-stage answers are delivered *only when unlocked* by the server API; all correct answers remain stored server-side in challenge records.

## D. Tests and limitations before launch

Run `npm test` plus `npm run build`. Manually test:

1. Correct country → correct region → city → area → district → street → building: exactly seven guesses, victory.
2. Wrong country once, then six correct: only reaches the street; building remains locked.
3. Reload after three guesses: session resumes at the same stage when Supabase is enabled.
4. Same challenge on two tabs: stale writes are rejected with an explanatory error (optimistic locking).
5. Tap and hover all target types, rotate/zoom/pan in Chrome, Edge, Firefox, Android and iOS Safari.
6. Temporary geoBoundaries or map tile outage: markers or underlying map render instead of an invisible answer screen.
7. Wrong source/duplicate target/incomplete clue: admin validation refuses publication.
8. Publish a new challenge date: all players see the same challenge on its UTC day.
9. Confirm `.env.local` and service role key aren't in Git or the client JavaScript.

**Known beta caveats**

- Anonymous guest identity is cookie-based. Clearing cookies enables another attempt, so the beta leaderboard isn't cheat-proof. Competitive prizes or payments should wait for verified accounts, additional rate limits and stronger session controls.
- Development demo sessions are held in server memory. Do not deploy demo mode to production expecting persistent progress or a real public leaderboard.
- Concurrent daily read/create calls and distributed rate limiting need load testing on Vercel (the session write path already uses version comparisons for update conflicts).
- Small polygon areas may be hard to tap. A spatially expanded touch target or structured search/accessibility option should be provided for future stages.
- Full world country coverage, precise road centerlines, building footprints and fully verified content are **ongoing work**. Do not claim they are complete today.
- External maps, authentication email flows and the Next build have not been fully exercised within this delivery environment.

## E. Project structure

```text
app/
  page.tsx                    Main Atlas game
  leaderboard/page.tsx        Beta daily leaderboard
  admin/page.tsx              Secured Challenge Studio
  api/game/route.ts           Server-side game and hints
  api/geo/route.ts            geoBoundaries proxy and caching
  api/leaderboard/route.ts    Ranked scores and player nicknames
  api/admin/challenges/route.ts  Protected CRUD
components/
  Game.tsx                    Seven hearts and responsive UI
  MapCanvas.tsx               MapLibre map and selectable geography
  Studio.tsx                  Challenge authoring UI
lib/
  engine.ts                   Tested guess, score and stage logic
  store.ts                    Demo or Supabase session persistence
  supabase.ts                 Server-only database and admin auth
  types.ts                    Shared types
public/
  world-countries.geojson     Natural Earth country polygons
  microstates.geojson        Small-country point targets
data/challenges.json          London/New York sourced demo puzzles
supabase/schema.sql          Database migration
legacy/where7_daily_quiz.html Original working Atlas prototype
```

## Why this is not another single HTML file

A purely local HTML page can have a *visual* admin interface and store progress in local storage, but cannot securely verify guesses, hide future answers, share a daily challenge database, or protect published content from unauthorised users. This project deliberately separates trusted server logic from the interactive browser map.

## Map licenses/attribution

- **Natural Earth** geographic world boundaries: public-domain geographic data, simplified from the bundled Natural Earth low-resolution dataset; see https://www.naturalearthdata.com/ .
- **geoBoundaries `gbOpen`**: CC BY 4.0, https://www.geoboundaries.org/ (attribution shown when layer is active).
- **OpenStreetMap** contributors and **CARTO** basemap: attribution in map controls; follow provider terms.
- All included demo clues have editable source URLs; these are reference aids, not guarantees of accuracy.
#   w h e r e 7  
 