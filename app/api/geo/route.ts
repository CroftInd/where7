import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
// Controlled geoBoundaries proxy. Does not allow arbitrary URL fetches or unapproved boundary layers.
export async function GET(req:Request){
  const url=new URL(req.url);const iso=url.searchParams.get('iso')||'';const level=url.searchParams.get('level')||'ADM1';
  if(!/^[A-Z]{3}$/.test(iso)||!['ADM1','ADM2'].includes(level))return NextResponse.json({error:'Invalid country or boundary level.'},{status:400});
  try{
    const endpoint=`https://www.geoboundaries.org/api/current/gbOpen/${iso}/${level}/`;
    const metadata=await fetch(endpoint,{next:{revalidate:86400},signal:AbortSignal.timeout(9500)});
    if(!metadata.ok)throw new Error('No administrative boundaries available.');
    const detail=await metadata.json();
    const geoUrl=detail.simplifiedGeometryGeoJSON || detail.gjDownloadURL;
    if(typeof geoUrl!=='string'||!/^https:\/\//i.test(geoUrl)||!['geoboundaries.org','githubusercontent.com','github.com'].some(host=>new URL(geoUrl).hostname===host||new URL(geoUrl).hostname.endsWith('.'+host)))
      throw new Error('Untrusted boundary data URL.');
    const response=await fetch(geoUrl,{next:{revalidate:86400},signal:AbortSignal.timeout(12500)});
    if(!response.ok)throw new Error('Boundary download unavailable.');
    const raw=await response.text();if(raw.length>14000000)throw new Error('Boundary file too large.');
    const geo=JSON.parse(raw);
    if(geo.type!=='FeatureCollection'||!Array.isArray(geo.features))throw new Error('Boundary data invalid.');
    const fc={type:'FeatureCollection',features:geo.features.map((f:{properties?:Record<string,unknown>;geometry:unknown},i:number)=>({
      type:'Feature',id:i,properties:{name:String(f.properties?.shapeName||f.properties?.name||`Region ${i+1}`)},geometry:f.geometry}))};
    return NextResponse.json({geojson:fc,attribution:'geoBoundaries · gbOpen (CC BY 4.0)',source:detail.boundaryID||''},{headers:{'Cache-Control':'public, max-age=3600, stale-while-revalidate=86400'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Boundary data unavailable',fallback:true},{status:503})}
}
