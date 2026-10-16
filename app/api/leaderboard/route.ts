import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {serviceDb} from '@/lib/supabase';
import {readSession,selectChallenge,storedChallengeId} from '@/lib/store';
export const dynamic='force-dynamic';
const noCache={'Cache-Control':'private, no-store'};
export async function GET(){
  const db=serviceDb();if(!db)return NextResponse.json({entries:[],demo:true,message:'Configure Supabase to enable the public leaderboard.'},{headers:noCache});
  try{
    const challenge=await selectChallenge(undefined,'daily');
    const {data,error}=await db.from('results').select('display_name,score,stage,guesses,perfect,finished_at')
      .eq('challenge_id',storedChallengeId(challenge.id,'daily')).eq('mode','daily').order('perfect',{ascending:false}).order('score',{ascending:false}).order('stage',{ascending:false}).limit(50);
    if(error)throw new Error(error.message);
    return NextResponse.json({entries:(data||[]).map((e,i)=>({rank:i+1,name:e.display_name,score:e.score,stages:e.stage,guesses:e.guesses,perfect:e.perfect})),demo:false,title:'Today’s mystery'},{headers:noCache});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Error fetching leaderboard'},{status:500})}
}
export async function POST(req:Request){
  const db=serviceDb();if(!db)return NextResponse.json({error:'Supabase required for leaderboards.'},{status:503});
  try{
    const body=await req.json() as {name?:string};const name=(body.name||'').trim().replace(/\s+/g,' ');
    if(name.length<2||name.length>24||!(/^[\p{L}\p{N} _-]+$/u.test(name)))throw new Error('Use a name with 2–24 letters, digits, spaces, underscores or hyphens.');
    const token=(await cookies()).get('where7_guest')?.value;
    if(!token)throw new Error('Play the daily game before joining the leaderboard.');
    const puzzle=await selectChallenge(undefined,'daily');
    const session=await readSession(token,puzzle.id,'daily');
    if(session.status==='playing')throw new Error('Finish the daily challenge before submitting a name.');
    const {data,error}=await db.from('results').update({display_name:name}).eq('guest_key',token).eq('challenge_id',storedChallengeId(puzzle.id,'daily')).eq('mode','daily').select('score');
    if(error||!data?.length)throw new Error(error?.message||'Daily result not found.');
    return NextResponse.json({success:true},{headers:noCache});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Error publishing name'},{status:400})}
}
