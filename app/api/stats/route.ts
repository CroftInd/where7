import {NextResponse} from 'next/server';
import {playerKey,currentAccount,ensureProfile} from '@/lib/player';
import {levelFromXp,rankFromLevel} from '@/lib/ranks';
import {serviceDb} from '@/lib/supabase';
import {computeStreak,dayForCompletion,type Completion} from '@/lib/progression';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};


export async function GET(){
  const account=await currentAccount();
  const guest=await playerKey();
  if(account)await ensureProfile(account.id,account.email);
  const db=serviceDb();
  if(!db)return NextResponse.json({error:'Supabase is not configured.'},{status:503,headers});
  
  try{
    const {data:results,error}=await db.from('results')
      .select('challenge_id,mode,score,guesses,stage,perfect,finished_at')
      .eq('guest_key',guest).order('finished_at',{ascending:false}).limit(1000);
    if(error)throw error;
    const records=results||[];
    const daily=records.filter(r=>r.mode==='daily'&&r.finished_at);
    const practice=records.filter(r=>r.mode==='practice'&&r.finished_at);
    // Official challenge dates (not completion timestamps) are authoritative.
    // A finished expedition submitted just after midnight still belongs to its assigned day.
    const {data:protectionRows,error:protectionError}=account?await db.from('player_streak_protections')
      .select('protected_date').eq('user_id',account.id).limit(600):{data:[],error:null};
    if(protectionError)throw protectionError;
    const dates=new Set(daily.map(r=>dayForCompletion(r as Completion)).filter((d):d is string=>!!d));
    const protections=new Set((protectionRows||[]).map(p=>p.protected_date));
    const today=new Date().toISOString().slice(0,10);
    const streakStats=computeStreak(dates,protections,today);
    const streak=streakStats.current;
    const longest=streakStats.best;
    const total=records.length;
    const perfect=daily.filter(r=>r.perfect).length;
    const best=Math.max(0,...records.map(r=>r.score));
    const stats={completed:total,dailyCompleted:daily.length,practiceCompleted:practice.length,
      perfect,bestScore:best,totalPoints:records.reduce((sum,r)=>sum+r.score,0),
      averageScore:total?Math.round(records.reduce((sum,r)=>sum+r.score,0)/total):0,
      currentStreak:streak,longestStreak:longest,locationsFound:records.reduce((sum,r)=>sum+r.stage,0)};
    const {data:profile}=account?await db.from('player_profiles').select('xp,display_name').eq('id',account.id).maybeSingle():{data:null};
    const xp=profile?.xp||0;const level=levelFromXp(xp);
    const {data:topResult}=account?await db.from('results').select('challenge_id,score,perfect').eq('guest_key',guest).eq('mode','daily').order('perfect',{ascending:false}).order('score',{ascending:false}).limit(1):{data:[]};
    let topLeaderboard=false;
    if(topResult?.length){
      const r=topResult[0];const q=db.from('results').select('guest_key',{count:'exact',head:true}).eq('challenge_id',r.challenge_id).eq('mode','daily');
      const {count}=r.perfect?await q.eq('perfect',true).gt('score',r.score):await q.or(`perfect.eq.true,score.gt.${r.score}`);
      topLeaderboard=count===0;
    }
    const achievements=[
      {id:'top',name:'Top of the Atlas',description:'Earn first place on a daily leaderboard (including ties)',earned:topLeaderboard},
      {id:'level10',name:'Explorer Rank',description:'Reach level 10',earned:level>=10},
      {id:'level100',name:'Globemaster',description:'Reach level 100',earned:level>=100},
      {id:'first',name:'First Expedition',description:'Complete your first challenge',earned:total>=1},
      {id:'perfect',name:'Flawless Navigator',description:'Finish a perfect daily seven',earned:perfect>=1},
      {id:'five',name:'Seasoned Explorer',description:'Complete five expeditions',earned:total>=5},
      {id:'streak3',name:'Three-Day Trail',description:'Play three consecutive days',earned:longest>=3},
      {id:'streak7',name:'Seven-Day Voyager',description:'Play seven consecutive days',earned:longest>=7},
      {id:'twenty',name:'Atlas Veteran',description:'Complete twenty expeditions',earned:total>=20},
    ];
    return NextResponse.json({stats,profile:{signedIn:!!account,name:profile?.display_name||'Explorer',xp,level,rankName:rankFromLevel(level)},achievements,recent:records.slice(0,20).map(r=>({
      challengeId:r.challenge_id,mode:r.mode,score:r.score,stage:r.stage,
      perfect:r.perfect,finishedAt:r.finished_at
    }))},{headers});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Stats unavailable'},{status:500,headers})}
}
function emptyStats(){return {completed:0,dailyCompleted:0,practiceCompleted:0,perfect:0,bestScore:0,totalPoints:0,averageScore:0,currentStreak:0,longestStreak:0,locationsFound:0}}
