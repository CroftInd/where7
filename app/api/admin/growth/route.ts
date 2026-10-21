import {NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '@/lib/supabase';
import {dayForCompletion,type Completion} from '@/lib/progression';
export const dynamic='force-dynamic';
export async function GET(){
 if(!(await requireAdmin()))return NextResponse.json({error:'Admin access required.'},{status:403});
 const db=serviceDb();if(!db)return NextResponse.json({error:'Database unavailable.'},{status:503});
 const since=new Date();since.setUTCDate(since.getUTCDate()-30);
 const [r,p,claims]=await Promise.all([
  db.from('results').select('guest_key,challenge_id,mode,score,stage,guesses,perfect,finished_at').eq('mode','daily').gte('finished_at',since.toISOString()).limit(12000),
  db.from('player_profiles').select('id',{count:'exact',head:true}),
  db.from('player_reward_claims').select('user_id',{count:'exact',head:true})
 ]);
 if(r.error||p.error||claims.error)return NextResponse.json({error:'Unable to compute analytics.'},{status:503});
 const completed=(r.data||[]) as (Completion & {guest_key:string})[];
 const dates=new Map<string,Set<string>>(),players=new Set<string>();
 for(const row of completed){
  const day=dayForCompletion(row);if(!day)continue;
  if(!dates.has(day))dates.set(day,new Set());
  dates.get(day)!.add(row.guest_key);players.add(row.guest_key);
 }
 const days=[...dates].map(([date,ids])=>({date,players:ids.size})).sort((a,b)=>a.date.localeCompare(b.date));
 return NextResponse.json({last30Days:{uniquePlayers:players.size,completedDailyResults:completed.length,averageScore:completed.length?Math.round(completed.reduce((sum,row)=>sum+row.score,0)/completed.length):0,perfectResults:completed.filter(x=>x.perfect).length,chart:days},registeredAccounts:p.count||0,rewardClaims:claims.count||0,notice:'Aggregate operational statistics only. Counts exclude unfinished games and can differ from unique visitors.'},{headers:{'Cache-Control':'private, no-store'}});
}
