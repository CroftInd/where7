import seeds from '@/data/challenges.json';
import {serviceDb,cloudReady} from './supabase';
import {type Challenge,type Session} from './types';
import {newSession} from './engine';

const demoGames=new Map<string,Session>();
const seed=seeds as unknown as Challenge[];
const key=(guest:string,challenge:string,mode:string)=>guest+':'+mode+':'+challenge;
function currentDate(){return new Date().toISOString().slice(0,10)}
function hash(x:string){let h=2166136261;for(const ch of x){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
export async function listChallenges(admin=false):Promise<Challenge[]> {
  const db=serviceDb(); if(!db)return seed;
  const query=db.from('challenges').select('id,title,description,country_iso3,status,publish_date,difficulty,stages');
  const {data,error}=await (admin?query:query.eq('status','published'));
  if(error)throw new Error(`Cannot load challenge library: ${error.message}. Run the SQL migration.`);
  const records=(data||[]).map(v=>({id:v.id,title:v.title,description:v.description||'',countryIso3:v.country_iso3,status:v.status,publishDate:v.publish_date,difficulty:v.difficulty,stages:v.stages} as Challenge));
  // Bundled examples remain available for practice, but are not automatically
  // added to the live rotation. Only explicitly published DB entries qualify.
  return [...records,...seed.filter(x=>!records.some(v=>v.id===x.id)).map(x=>({...x,status:"draft" as const}))];
}
export async function selectChallenge(id:string|undefined,mode:'daily'|'practice'){
  const catalog=await listChallenges();
  if(mode==='practice'&&id){const p=catalog.find(v=>v.id===id);if(!p)throw new Error('Challenge not found.');return p;}
  const date=currentDate();
  const db=serviceDb();
  if(db){
    // Atomic PostgreSQL function freezes each day's selection for every visitor.
    // It uses every published puzzle once before permitting repeats.
    const {data,error}=await db.rpc('where7_assign_daily_challenge',{target_day:date});
    if(error)throw new Error('Daily challenge selection failed: '+error.message+'. Apply supabase/random_daily_rotation.sql in Supabase SQL Editor.');
    const chosen=catalog.find(c=>c.id===data);
    if(!chosen)throw new Error('Today’s assigned challenge is not available.');
    return chosen;
  }
  const published=catalog.filter(c=>c.status==='published');
  const candidates=published.length?published:seed;
  return candidates[hash(date)%candidates.length];
}
// The same puzzle can return on another day; keep daily sessions/results distinct.
export function storedChallengeId(challengeId:string,mode:Session['mode']){
  return mode==='daily'?`${currentDate()}:${challengeId}`:challengeId;
}
export async function readSession(guest:string,challengeId:string,mode:Session['mode']):Promise<Session> {
  const db=serviceDb();const scoped=storedChallengeId(challengeId,mode);const id=key(guest,scoped,mode);
  if(!db){if(!demoGames.has(id))demoGames.set(id,newSession(challengeId,mode));return demoGames.get(id)!;}
  const {data,error}=await db.from('game_sessions').select('data').eq('guest_key',guest).eq('challenge_id',scoped).eq('mode',mode).maybeSingle();
  if(error)throw new Error('Cannot read progress: '+error.message);
  if(data)return data.data as Session;
  const fresh=newSession(challengeId,mode);
  const {error:writeError}=await db.from('game_sessions').upsert({guest_key:guest,challenge_id:scoped,mode,data:fresh,version:0},{onConflict:'guest_key,challenge_id,mode',ignoreDuplicates:true});
  if(writeError)throw new Error('Cannot save progress: '+writeError.message);
  const {data:existing}=await db.from('game_sessions').select('data').eq('guest_key',guest).eq('challenge_id',scoped).eq('mode',mode).single();
  return existing?.data as Session || fresh;
}
export async function saveSession(guest:string,previous:Session,next:Session):Promise<void>{
  const db=serviceDb();const scoped=storedChallengeId(next.challengeId,next.mode);const id=key(guest,scoped,next.mode);
  if(!db){if(demoGames.get(id)?.version!==previous.version)throw new Error('Your game changed in another tab. Refresh to continue.');demoGames.set(id,next);return;}
  const {data,error}=await db.from('game_sessions').update({data:next,version:next.version,updated_at:new Date().toISOString()})
    .eq('guest_key',guest).eq('challenge_id',scoped).eq('mode',next.mode).eq('version',previous.version).select('version');
  if(error)throw new Error('Cannot save guess: '+error.message);
  if(!data?.length)throw new Error('Your game changed in another tab. Refresh to continue.');
  if(next.status!=='playing'){
    await db.from('results').upsert({guest_key:guest,challenge_id:scoped,mode:next.mode,score:next.score,guesses:next.guesses,stage:next.stage,perfect:next.status==='won',finished_at:next.endedAt},
      {onConflict:'guest_key,challenge_id,mode'});
  }
}
export async function restartPractice(guest:string,challengeId:string){
  const db=serviceDb();const id=key(guest,challengeId,'practice');
  if(!db){demoGames.delete(id);return;}
  const {error}=await db.from('game_sessions').delete().eq('guest_key',guest).eq('challenge_id',challengeId).eq('mode','practice');
  if(error)throw new Error(error.message);
}
export {cloudReady};
