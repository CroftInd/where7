WHERE7 V15.2 blank-map repair

Uses a stable CARTO raster basemap as the initial MapLibre style instead of a remotely fetched vector style, preventing an unloaded style from blocking interactive map layers. Keeps WebGL-rendered choice markers, improves console diagnostics, and provides a visible WebGL error. No SQL changes.

Install: replace existing project files, keep .env.local, run npm install, npm run build, git add ., git commit -m "Fix blank map", git push.

If the map remains blank, open F12 > Console and Network and send the first red error and the failed tile request.
