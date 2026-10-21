import {NextResponse} from 'next/server';
import {listChallenges} from '@/lib/store';
import {playerKey} from '@/lib/player';
import {serviceDb} from '@/lib/supabase';
import {continentFor} from '@/lib/continents';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const games=(await listChallenges()).filter(c=>c.status==='published');
  const db=serviceDb();
  let finished=new Set<string>();
  if(db){
   const guest=await playerKey();
   const {data,error}=await db.from('results').select('challenge_id,finished_at').eq('guest_key',guest).eq('mode','practice').not('finished_at','is',null).limit(1000);
   if(error)throw error;
   finished=new Set((data||[]).map(x=>x.challenge_id));
  }
  const challenges=games.map(c=>({id:c.id,title:c.title,countryIso3:c.countryIso3.trim(),continent:continentFor(c.countryIso3),difficulty:c.difficulty,completed:finished.has(c.id)}));
  const continents=[...new Set(challenges.map(c=>c.continent).filter(Boolean))].sort();
  return NextResponse.json({challenges,continents,completed:challenges.filter(c=>c.completed).length,total:challenges.length},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('[WHERE7 explorer]',e);return NextResponse.json({error:'Cannot load Explorer missions.'},{status:503})}
}
