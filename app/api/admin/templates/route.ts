import {NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '@/lib/supabase';
export const dynamic='force-dynamic';
const denied=()=>NextResponse.json({error:'Admin required.'},{status:403});
export async function GET(){
 if(!(await requireAdmin()))return denied();
 const db=serviceDb();if(!db)return NextResponse.json({error:'Database unavailable.'},{status:503});
 const {data,error}=await db.from('geography_clue_templates').select('id,level,title,clue,hint').order('level').order('title').limit(500);
 return error?NextResponse.json({error:'Unable to load clue templates.'},{status:503}):NextResponse.json({templates:data||[]},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:Request){
 if(!(await requireAdmin()))return denied();
 const origin=req.headers.get('origin');
 if(origin&&new URL(origin).host!==new URL(req.url).host)return NextResponse.json({error:'Invalid origin.'},{status:403});
 const db=serviceDb();if(!db)return NextResponse.json({error:'Database unavailable.'},{status:503});
 try{
 const x=await req.json() as Record<string,unknown>;
 if(x.action==='delete'){
  const id=String(x.id||'');
  if(!/^[0-9a-f-]{36}$/.test(id))return NextResponse.json({error:'Invalid template.'},{status:400});
  const {error}=await db.from('geography_clue_templates').delete().eq('id',id);
  if(error)throw error;return NextResponse.json({success:true});
 }
 const level=Number(x.level),title=String(x.title||'').trim(),clue=String(x.clue||'').trim(),hint=String(x.hint||'').trim();
 if(!Number.isInteger(level)||level<0||level>6||title.length<3||title.length>60||clue.length<10||clue.length>600||hint.length>400)return NextResponse.json({error:'Use a valid stage, title (3–60), clue (10–600) and short hint.'},{status:400});
 const {data,error}=await db.from('geography_clue_templates').upsert({level,title,clue,hint},{onConflict:'level,title'}).select('id').single();
 if(error)throw error;return NextResponse.json({success:true,id:data.id});
 }catch(e){console.error('[Studio template]',e);return NextResponse.json({error:'Unable to save clue template.'},{status:503})}
}
