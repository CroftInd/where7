import {NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '@/lib/supabase';
import {auditStudio} from '@/lib/studio';
import type {Challenge} from '@/lib/types';
export const dynamic='force-dynamic';
export async function GET(){
 if(!(await requireAdmin()))return NextResponse.json({error:'Admin required.'},{status:403});
 const db=serviceDb();if(!db)return NextResponse.json({error:'Supabase unavailable.'},{status:503});
 try{
 const [challengeRes,locationRes]=await Promise.all([
  db.from('challenges').select('id,title,status,difficulty,stages').limit(2000),
  db.from('geography_nodes').select('id,parent_id,level,published').limit(15000)
 ]);
 if(challengeRes.error||locationRes.error)throw Error('Quality data unavailable.');
 const challenges=(challengeRes.data||[]).map(x=>({id:x.id,title:x.title,status:x.status,difficulty:x.difficulty,stages:x.stages})) as Challenge[];
 return NextResponse.json({audit:auditStudio(challenges,locationRes.data||[])},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('[Studio quality]',e);return NextResponse.json({error:'Quality audit could not run.'},{status:503})}
}
