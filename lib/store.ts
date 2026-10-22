import seeds from '@/data/challenges.json';
import {serviceDb,cloudReady} from './supabase';
import {type Challenge,type Session} from './types';
import {newSession} from './engine';
import {utcDay,GameConflict} from './game-request';

const demoGames=new Map<string,Session>();
const seed=seeds as unknown as Challenge[];
const key=(guest:string,challenge:string,mode:string)=>guest+':'+mode+':'+challenge;
const currentDate=utcDay;
function hash(x:string){let h=2166136261;for(const ch of x){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
const COLUMNS='id,title,description,country_iso3,status,publish_date,difficulty,stages,revision,review_status,review_checklist,reviewed_at,is_reserve';
export function challengeFromRow(v:Record<string,any>):Challenge{
  return {id:v.id,title:v.title,description:v.description||'',countryIso3:String(v.country_iso3).trim(),status:v.status,publishDate:v.publish_date,
    difficulty:v.difficulty,stages:v.stages,revision:v.revision||1,reviewStatus:v.review_status||'draft',checklist:v.review_checklist,reviewedAt:v.reviewed_at,reserve:v.is_reserve};
}
export async function listChallenges(admin=false):Promise<Challenge[]> {
  const db=serviceDb();if(!db)return seed.map(c=>({...c,revision:1}));
  const query=db.from('challenges').select(COLUMNS);
  const {data,error}=await (admin?query:query.eq('status','published'));
  if(error)throw new Error('Cannot load challenge library. Apply the Phase 2 content migration.');
  const records=(data||[]).map(challengeFromRow);
  return [...records,...seed.filter(x=>!records.some(v=>v.id===x.id)).map(x=>({...x,status:'draft' as const,revision:1}))];
}
export async function selectChallenge(id:string|undefined,mode:'daily'|'practice',day=currentDate()):Promise<Challenge>{
  const db=serviceDb();
  if(mode==='practice'&&id?.startsWith('archive:')){
    const archiveDay=id.slice(8);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(archiveDay)||archiveDay>=day)throw new Error('This archive date is not available.');
    if(!db)throw new Error('Archive requires Supabase.');
    const {data,error}=await db.from('daily_challenge_assignments').select('challenge_snapshot').eq('challenge_date',archiveDay).maybeSingle();
    if(error||!data?.challenge_snapshot)throw new Error('No frozen expedition for this date.');
    return data.challenge_snapshot as Challenge;
  }
  if(mode==='practice'&&id){
    if(db){const {data,error}=await db.from('challenges').select(COLUMNS).eq('id',id).eq('status','published').maybeSingle();
      if(error)throw new Error('Practice library unavailable.');if(data)return challengeFromRow(data);}
    const example=seed.find(c=>c.id===id);if(example)return {...example,revision:1};
    throw new Error('Challenge not found.');
  }
  if(db){
    const {data:id,error}=await db.rpc('where7_assign_daily_challenge',{target_day:day});
    if(error)throw new Error('Daily challenge selection failed. Check the reviewed content schedule.');
    const {data,error:readError}=await db.from('daily_challenge_assignments').select('challenge_snapshot').eq('challenge_date',day).eq('challenge_id',id).single();
    if(readError||!data?.challenge_snapshot)throw new Error('Today’s frozen challenge is unavailable. Apply the Phase 2 content migration.');
    return data.challenge_snapshot as Challenge;
  }
  return {...seed[hash(day)%seed.length],revision:1};
}
/** Prefer a player's already-started daily run after an emergency replacement. */
export async function getGameState(guest:string,id:string|undefined,mode:Session['mode'],day=currentDate()){
  if(mode==='daily'){
    const db=serviceDb();let existing:Session|undefined;
    if(db){
      const {data,error}=await db.from('game_sessions').select('data').eq('guest_key',guest).eq('mode','daily').like('challenge_id',day+':%').limit(10);
      if(error)throw new Error('Cannot restore the saved daily run.');
      existing=(data||[]).map(x=>x.data as Session).sort((a,b)=>a.startedAt.localeCompare(b.startedAt))[0];
    }else existing=[...demoGames.entries()].find(([key])=>key.startsWith(guest+':daily:'+day+':'))?.[1];
    if(existing?.challengeSnapshot)return {session:existing,challenge:existing.challengeSnapshot};
  }
  if(mode==='practice'&&id&&!id.startsWith('archive:')){
    const db=serviceDb();let existing:Session|undefined;
    if(db){const {data,error}=await db.from('game_sessions').select('data').eq('guest_key',guest).eq('mode','practice').eq('challenge_id',id).maybeSingle();
      if(error)throw new Error('Cannot restore saved practice.');existing=data?.data as Session|undefined;
    }else existing=demoGames.get(key(guest,id,'practice'));
    if(existing?.challengeSnapshot)return {session:existing,challenge:existing.challengeSnapshot};
  }
  const selected=await selectChallenge(id,mode,day);
  const context=mode==='practice'&&id?.startsWith('archive:')?{practiceKey:id,storageId:id+':r'+(selected.revision||1)+':'+selected.id}:undefined;
  const session=await readSession(guest,selected.id,mode,day,selected,context);
  return {session,challenge:session.challengeSnapshot||selected};
}
// The same puzzle can return on another day; keep daily sessions/results distinct.
export function storedChallengeId(challengeId:string,mode:Session['mode'],day=currentDate()){
  return mode==='daily'?`${day}:${challengeId}`:challengeId;
}
export async function readSession(guest:string,challengeId:string,mode:Session['mode'],day=currentDate(),snapshot?:Challenge,context?:{storageId:string;practiceKey:string}):Promise<Session> {
  const db=serviceDb();const scoped=context?.storageId||storedChallengeId(challengeId,mode,day);const id=key(guest,scoped,mode);
  if(!db){if(!demoGames.has(id))demoGames.set(id,{...newSession(challengeId,mode),...context,...(snapshot?{challengeSnapshot:structuredClone(snapshot)}:{})});return demoGames.get(id)!;}
  const {data,error}=await db.from('game_sessions').select('data').eq('guest_key',guest).eq('challenge_id',scoped).eq('mode',mode).maybeSingle();
  if(error)throw new Error('Cannot read progress: '+error.message);
  if(data){
    const session=data.data as Session;
    if(!session.challengeSnapshot&&snapshot){
      const pinned={...session,challengeSnapshot:snapshot};
      const {data:written,error:pinError}=await db.from('game_sessions').update({data:pinned}).eq('guest_key',guest).eq('challenge_id',scoped).eq('mode',mode).eq('version',session.version).select('data');
      if(pinError)throw new Error('Cannot freeze the saved challenge revision.');
      if(written?.length)return written[0].data as Session;
      return readSession(guest,challengeId,mode,day,snapshot,context);
    }
    return session;
  }
  const fresh={...newSession(challengeId,mode),...context,...(snapshot?{challengeSnapshot:structuredClone(snapshot)}:{})};
  const {error:writeError}=await db.from('game_sessions').upsert({guest_key:guest,challenge_id:scoped,mode,data:fresh,version:0},{onConflict:'guest_key,challenge_id,mode',ignoreDuplicates:true});
  if(writeError)throw new Error('Cannot save progress: '+writeError.message);
  const {data:existing}=await db.from('game_sessions').select('data').eq('guest_key',guest).eq('challenge_id',scoped).eq('mode',mode).single();
  return existing?.data as Session || fresh;
}
export async function saveSession(guest:string,previous:Session,next:Session,day=currentDate()):Promise<void>{
  const db=serviceDb();const scoped=next.storageId||storedChallengeId(next.challengeId,next.mode,day);const id=key(guest,scoped,next.mode);
  if(!db){if(demoGames.get(id)?.version!==previous.version)throw new GameConflict('STALE_SESSION','Your game changed in another tab. Check your progress to continue.');demoGames.set(id,next);return;}
  const {data,error}=await db.from('game_sessions').update({data:next,version:next.version,updated_at:new Date().toISOString()})
    .eq('guest_key',guest).eq('challenge_id',scoped).eq('mode',next.mode).eq('version',previous.version).select('version');
  if(error)throw new Error('Cannot save guess: '+error.message);
  if(!data?.length)throw new GameConflict('STALE_SESSION','Your game changed in another tab. Check your progress to continue.');
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
