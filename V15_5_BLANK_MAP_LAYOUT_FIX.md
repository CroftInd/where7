# WHERE7 V15.5 — zero-height MapLibre map repair

## Root cause
The MapLibre CSS defines `.maplibregl-map { position: relative }`. The WHERE7
`.map-container { position: absolute; inset: 0 }` selector has equal specificity.
When MapLibre CSS follows the app CSS (as it did in `app/layout.tsx`), its
rule overrides the desired absolute positioning. The map holder then has 0px
height because the MapLibre canvas is absolutely positioned, producing a blank
map with no browser console error.

## Fix
1. Import MapLibre CSS before `globals.css` in `app/layout.tsx`.
2. Add an explicit high-specificity dimensioning rule in `app/globals.css`
   targeting `.map-container.maplibregl-map` to survive CSS chunk order.
3. Add `app/favicon.ico` to remove the unrelated harmless favicon 404.

## Verify
After deployment open the site, perform Ctrl+Shift+R, then in Chrome Console:

```js
const el = document.querySelector('.map-container.maplibregl-map');
console.log('Map size:', el?.getBoundingClientRect().width, el?.getBoundingClientRect().height);
console.log('Position:', el && getComputedStyle(el).position);
```

The dimensions should be greater than zero and position should be `absolute`.
The map should show country shapes even if the optional CARTO raster tiles fail.

No Supabase changes or API keys are required. Keep your existing `.env.local`.
Run `npm run build` and `git add . && git commit -m "Fix zero-height map container" && git push`.
