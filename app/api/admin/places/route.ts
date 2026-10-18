import {NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '@/lib/supabase';
export const dynamic='force-dynamic';
const denied=()=>NextResponse.json({error:'Admin login required'},{status:403});
export async function GET(){
 if(!(await requireAdmin()))return denied();const db=serviceDb();if(!db)return NextResponse.json({error:'Supabase unavailable'},{status:503});
 const {data,error}=await db.from('geography_nodes').select('*').order('level').order('name');
 return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({places:data},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:Request){
 if(!(await requireAdmin()))return denied();const db=serviceDb();if(!db)return NextResponse.json({error:'Supabase unavailable'},{status:503});
 const x=await req.json() as Record<string,unknown>;
 const level=Number(x.level),lat=Number(x.lat),lng=Number(x.lng);
 if(!Number.isInteger(level)||level<0||level>6||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng)||Math.abs(lng)>180)
  return NextResponse.json({error:'Invalid stage or coordinates'},{status:400});
 const name=String(x.name||'').trim(),clue=String(x.clue||'').trim(),hint=String(x.hint||'').trim(),source=String(x.source||'').trim();
 if(name.length<2||name.length>120||clue.length<10||clue.length>600||!/^https:\/\//.test(source))return NextResponse.json({error:'Name, clue (10+ characters) and HTTPS source are required'},{status:400});
 let parent_id:string|null=null;
 if(level>0){parent_id=String(x.parent_id||'');const {data:parent}=await db.from('geography_nodes').select('id,level').eq('id',parent_id).maybeSingle();if(!parent||parent.level!==level-1)return NextResponse.json({error:'Select a valid parent at the previous stage'},{status:400});}
 const iso3=level===0?String(x.iso3||'').trim().toUpperCase():null;
 if(level===0&&!/^[A-Z]{3}$/.test(iso3||''))return NextResponse.json({error:'Country requires a three-letter ISO code'},{status:400});
 const row={name,level,parent_id,clue,hint:hint||'Look for geographical and historical connections.',source,lat,lng,iso3,published:x.published!==false};
 const id=typeof x.id==='string'&&/^[0-9a-f-]{36}$/.test(x.id)?x.id:undefined;
 const {data,error}=id?await db.from('geography_nodes').update(row).eq('id',id).select('id').single():await db.from('geography_nodes').insert(row).select('id').single();
 return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({id:data.id,success:true});
}
