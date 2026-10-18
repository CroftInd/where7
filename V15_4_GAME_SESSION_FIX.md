# WHERE7 V15.4 — Fix incorrect daily restart request

## What the network error means

`POST /api/game` returning `{"error":"Official daily challenges cannot be restarted."}` is the server *correctly* refusing an attempt to reset the scored daily session. It is **not** the map tile service returning an error.

## What changed

- Use the loaded server game (`game.mode`) rather than UI mode to decide whether to show the **Restart practice** button.
- Prevent the client from submitting a restart for daily mode even if the UI becomes inconsistent.
- Abort superseded game-loading requests; an older daily response can no longer overwrite a later practice response.
- Clear stale game data while the next mode loads, so a finished daily session does not remain visible as a practice session.
- Keep the server restriction that prevents official daily retries.

## Install

Replace your project files with this archive, preserving `.env.local` and production secrets. Alternatively, replace only `components/Game.tsx` (the only changed source file).

```powershell
npm run typecheck
npm run build
git add .
git commit -m "Fix daily practice session mismatch"
git push
```

## Important: the blank map is a separate issue

The 400 restart error cannot explain why the map tiles or country outlines are blank. Open DevTools -> Console and look for `[WHERE7 map]`, `[WHERE7 map initialization]`, maplibre, WebGL, or GeoJSON errors. In Network also check `/world-countries.geojson`, `/microstates.geojson`, and any `cartocdn.com` requests. A GET `/api/game` 200 does *not* prove the map rendered.

No database migration required.
