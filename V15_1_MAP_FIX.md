WHERE7 V15.1 map repair

Fixes touch gestures on mobile and initialises interactive layers after a CARTO style fallback.

Replace project files with this archive, preserving your .env.local and Vercel environment variables. Run npm run typecheck and npm run build before pushing.

If the map is still blank, inspect browser console and Network requests for CARTO style/tile errors and confirm NEXT_PUBLIC_CARTO_API_KEY and NEXT_PUBLIC_MAP_TILE_URL values.
