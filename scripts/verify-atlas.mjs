import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';

const countriesPath='public/world-countries.geojson';
const microstatesPath='public/microstates.geojson';
for(const file of [countriesPath,microstatesPath]){
  assert(existsSync(file),`Map data missing: ${file}`);
  const data=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(data.type,'FeatureCollection',`${file} must be GeoJSON`);
  assert(data.features.length>0,`${file} must contain selectable places`);
  assert(data.features.every(item=>typeof item.properties?.name==='string' && item.geometry),`${file} needs names and geometry`);
}
const layout=readFileSync('app/globals.css','utf8');
assert(layout.includes('.map-container.maplibregl-map'),'MapLibre zero-height regression: container override missing');
assert(layout.includes('position: absolute !important'),'MapLibre zero-height regression: absolute positioning missing');
const map=readFileSync('components/MapCanvas.tsx','utf8');
assert(map.includes('CARTO_VECTOR_STYLE'),'Detailed vector map was removed');
assert(map.includes('fallbackToRaster'),'Map style fallback was removed');
assert(map.includes('choice-selected-ring'),'Selection preview marker missing');
assert(map.includes('renderStatus'),'Map status/recovery missing');
const game=readFileSync('components/Game.tsx','utf8');
assert(game.includes('map-confirm-card') && game.includes('selected-inline'),'Guesses must be confirmed on desktop and mobile');
console.log('Atlas map data, sizing, fallback, and confirmation safeguards verified.');
