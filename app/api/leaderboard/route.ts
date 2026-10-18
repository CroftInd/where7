import {NextResponse} from 'next/server';
import {playerKey,currentAccount,ensureProfile} from '@/lib/player';
import {levelFromXp,rankFromLevel} from '@/lib/ranks';
import {serviceDb} from '@/lib/supabase';
import {readSession,selectChallenge,storedChallengeId} from '@/lib/store';
export const dynamic='force-dynamic';
const noCache={'Cache-Control':'private, no-store'};
export async function GET(){
  const db=serviceDb();if(!db)return NextResponse.json({entries:[],demo:true,message:'Configure Supabase to enable the public leaderboard.'},{headers:noCache});
  try{
    const challenge=await selectChallenge(undefined,'daily');
    const {data,error}=await db.from('results').select('guest_key,display_name,score,stage,guesses,perfect,finished_at')
      .eq('challenge_id',storedChallengeId(challenge.id,'daily')).eq('mode','daily').order('perfect',{ascending:false}).order('score',{ascending:false}).order('stage',{ascending:false}).limit(50);
    if(error)throw new Error(error.message);
    const ids=[...new Set((data||[]).map(e=>e.guest_key))];
    const {data:profiles}=ids.length?await db.from('player_profiles').select('id,display_name,xp').in('id',ids):{data:[]};
    const byId=new Map((profiles||[]).map(p=>[p.id,p]));
    return NextResponse.json({entries:(data||[]).map((e,i)=>{
      const profile=byId.get(e.guest_key);const level=levelFromXp(profile?.xp||0);
      return {rank:i+1,name:profile?.display_name||e.display_name,score:e.score,stages:e.stage,guesses:e.guesses,perfect:e.perfect,level,rankName:rankFromLevel(level)};
    }),demo:false,title:'Today’s mystery'},{headers:noCache});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Error fetching leaderboard'},{status:500})}
}
export async function POST(req:Request){
  const db=serviceDb();if(!db)return NextResponse.json({error:'Supabase required for leaderboards.'},{status:503});
  try{
    const body=await req.json() as {name?:string};const name=(body.name||'').trim().replace(/\s+/g,' ');
    if(name.length<2||name.length>24||!(/^[\p{L}\p{N} _-]+$/u.test(name)))throw new Error('Use a name with 2–24 letters, digits, spaces, underscores or hyphens.');
    const account=await currentAccount();if(!account)throw new Error('Sign in to publish a ranked leaderboard score.');
    const token=await playerKey();await ensureProfile(account.id,account.email);
    const puzzle=await selectChallenge(undefined,'daily');
    const session=await readSession(token,puzzle.id,'daily');
    if(session.status==='playing')throw new Error('Finish the daily challenge before submitting a name.');
    const {data,error}=await db.from('results').update({display_name:name}).eq('guest_key',token).eq('challenge_id',storedChallengeId(puzzle.id,'daily')).eq('mode','daily').select('score');
    if(error||!data?.length)throw new Error(error?.message||'Daily result not found.');
    const {error:profileError}=await db.from('player_profiles').update({display_name:name}).eq('id',account.id);
    if(profileError)throw new Error(profileError.message);
    return NextResponse.json({success:true},{headers:noCache});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Error publishing name'},{status:400})}
}
