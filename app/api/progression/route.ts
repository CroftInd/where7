import {NextResponse} from 'next/server';
import {currentAccount,playerKey,ensureProfile} from '@/lib/player';
import {serviceDb} from '@/lib/supabase';
import {buildProgression,type Completion,type Claim,type Shield} from '@/lib/progression';
import {levelFromXp} from '@/lib/ranks';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const todayUtc=()=>new Date().toISOString().slice(0,10);
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});

async function readProgression(){
  const account=await currentAccount();
  const key=await playerKey();
  if(account)await ensureProfile(account.id,account.email);
  const db=serviceDb();
  if(!db)throw new Error('The progression service is unavailable.');
  const [resultsReply,claimsReply,shieldsReply,profileReply]=await Promise.all([
    db.from('results').select('challenge_id,mode,score,guesses,stage,perfect,finished_at').eq('guest_key',key).eq('mode','daily').not('finished_at','is',null).order('finished_at',{ascending:false}).limit(1500),
    account?db.from('player_reward_claims').select('reward_key,xp,claimed_at,shield_granted').eq('user_id',account.id).order('claimed_at',{ascending:false}).limit(600):Promise.resolve({data:[],error:null}),
    account?db.from('player_streak_protections').select('protected_date').eq('user_id',account.id).limit(600):Promise.resolve({data:[],error:null}),
    account?db.from('player_profiles').select('xp,display_name').eq('id',account.id).maybeSingle():Promise.resolve({data:null,error:null})
  ]);
  for(const item of [resultsReply,claimsReply,shieldsReply,profileReply])if(item.error)throw new Error('Progression data could not be loaded.');
  const progress=buildProgression((resultsReply.data||[]) as Completion[],(claimsReply.data||[]) as Claim[],(shieldsReply.data||[]) as Shield[],todayUtc(),Number(profileReply.data?.xp||0));
  return {account,db,progress,playerId:key};
}

export async function GET(){
  try{
    const {account,progress}=await readProgression();
    return json({progression:progress,signedIn:!!account});
  }catch(e){console.error('[WHERE7 progression]',e);return json({error:'Unable to load explorer rewards right now.'},503)}
}

export async function POST(req:Request){
  try{
    const origin=req.headers.get('origin');
    if(origin&&new URL(origin).host!==new URL(req.url).host)return json({error:'Request origin not allowed.'},403);
    const body=await req.json() as {action?:unknown;key?:unknown};
    if(!body||typeof body.action!=='string')return json({error:'Choose a valid reward action.'},400);
    const {account,db,progress}=await readProgression();
    if(!account)return json({error:'Sign in to collect XP and use streak shields.'},401);
    if(body.action==='claim'||body.action==='claim_all'){
      const options=[...progress.daily,...progress.weekly].filter(m=>m.earned&&!m.claimed);
      const selection=body.action==='claim'?options.filter(m=>m.key===body.key):options;
      if(!selection.length)return json({error:'There are no eligible rewards to collect.'},409);
      let shields=progress.streak.shields;
      const keys:string[]=[];
      for(const reward of selection){
        const token=reward.shield&&shields<2;
        const {data,error}=await db.from('player_reward_claims').upsert({user_id:account.id,reward_key:reward.key,xp:reward.xp,shield_granted:token},{onConflict:'user_id,reward_key',ignoreDuplicates:true}).select('reward_key');
        if(error)throw new Error('Unable to save reward.');
        if(data?.length){keys.push(reward.key);if(token)shields++;}
      }
      if(!keys.length)return json({error:'Those rewards have already been collected. Refresh to continue.'},409);
      const updated=await readProgression();
      return json({progression:updated.progress,signedIn:true,claimedKeys:keys,gainedXp:selection.filter(x=>keys.includes(x.key)).reduce((n,m)=>n+m.xp,0),levelUp:levelFromXp(updated.progress.profile.xp)>progress.profile.level});
    }
    if(body.action==='protect_yesterday'){
      if(!progress.streak.canProtectYesterday)return json({error:'Yesterday cannot be protected right now. A streak shield is required.'},409);
      const {error}=await db.from('player_streak_protections').insert({user_id:account.id,protected_date:progress.streak.yesterday});
      if(error?.code==='23505')return json({error:'Yesterday has already been protected.'},409);
      if(error)throw new Error('Unable to save your streak shield.');
      const updated=await readProgression();
      return json({progression:updated.progress,signedIn:true,protectedDate:progress.streak.yesterday});
    }
    return json({error:'Unknown reward action.'},400);
  }catch(e){console.error('[WHERE7 progression action]',e);return json({error:'Your reward could not be saved. Try again.'},503)}
}
