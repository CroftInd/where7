import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {serviceDb} from '@/lib/supabase';
import {currentAccount,playerKey,ensureProfile} from '@/lib/player';
import {listChallenges} from '@/lib/store';
import {ATTACK_QUESTIONS,chooseArcadeQuestions,expiresAt,isExpired,publicQuestion,awardAnswer,type ArcadeQuestion} from '@/lib/arcade';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
type RunRow={id:string;guest_key:string;user_id:string|null;duel_id:string|null;questions:ArcadeQuestion[];question_index:number;score:number;hits:number;status:string;started_at:string;expires_at:string;completed_at:string|null};
const publicRun=(r:RunRow)=>({id:r.id,mode:r.duel_id?'duel':'time',index:r.question_index,total:r.questions.length,score:r.score,hits:r.hits,status:r.status,expiresAt:r.expires_at,startedAt:r.started_at,question:r.status==='active'&&r.question_index<r.questions.length&&!isExpired(r.expires_at)?publicQuestion(r.questions[r.question_index]):null});
async function actor(){
 const db=serviceDb();if(!db)throw Error('Arcade service is unavailable');
 const account=await currentAccount();if(account)await ensureProfile(account.id,account.email);
 const guest=await playerKey();return {db,account,guest};
}
async function getDuels(db:NonNullable<ReturnType<typeof serviceDb>>,actorId:string|null){
 if(!actorId)return [];
 const {data,error}=await db.from('arcade_duel_rooms').select('id,code,owner_id,joiner_id,created_at,expires_at').or('owner_id.eq.'+actorId+',joiner_id.eq.'+actorId).order('created_at',{ascending:false}).limit(20);
 if(error)throw error;
 const rooms=data||[];
 const {data:runs,error:runError}=rooms.length?await db.from('arcade_runs').select('duel_id,user_id,score,hits,status').in('duel_id',rooms.map(r=>r.id)): {data:[],error:null};
 if(runError)throw runError;
 const ids=[...new Set(rooms.flatMap(r=>[r.owner_id,r.joiner_id]).filter(Boolean))];
 const {data:profiles}=ids.length?await db.from('social_profiles').select('user_id,handle').in('user_id',ids):{data:[]};
 const names=new Map((profiles||[]).map(p=>[p.user_id,p.handle]));
 return rooms.map(r=>({id:r.id,code:r.code,owner:r.owner_id===actorId,canJoin:!r.joiner_id,expired:isExpired(r.expires_at),
  players:[r.owner_id,r.joiner_id].filter(Boolean).map(id=>({name:names.get(id)||'Explorer',self:id===actorId,result:(runs||[]).find(q=>q.duel_id===r.id&&q.user_id===id)||null}))}));
}
export async function GET(req:Request){
 try{
  const {db,account,guest}=await actor();
  const runId=new URL(req.url).searchParams.get('run');
  if(runId){
   if(!/^[0-9a-f-]{36}$/.test(runId))return response({error:'Invalid run.'},400);
   const {data,error}=await db.from('arcade_runs').select('*').eq('id',runId).eq('guest_key',guest).maybeSingle();
   if(error)throw error;if(!data)return response({error:'Run not found.'},404);
   return response({run:publicRun(data as RunRow),duels:await getDuels(db,account?.id||null)});
  }
  const [recent,duels]=await Promise.all([db.from('arcade_runs').select('id,score,hits,status,started_at,completed_at').eq('guest_key',guest).is('duel_id',null).order('started_at',{ascending:false}).limit(10),getDuels(db,account?.id||null)]);
  if(recent.error)throw recent.error;
  return response({recent:recent.data||[],duels,signedIn:!!account});
 }catch(error){console.error('[Arcade GET]',error);return response({error:'Arcade is unavailable right now.'},503)}
}
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');
  if(origin&&new URL(origin).host!==new URL(req.url).host)return response({error:'Invalid request origin.'},403);
  if(Number(req.headers.get('content-length')||0)>2500)return response({error:'Request too large.'},413);
  const body=await req.json() as Record<string,unknown>;
  if(!body||typeof body.action!=='string')return response({error:'Invalid action.'},400);
  const {db,account,guest}=await actor();
  if(body.action==='create_duel'){
   if(!account)return response({error:'Sign in to challenge a friend.'},401);
   const challenges=await listChallenges();const qs=chooseArcadeQuestions(challenges);
   if(qs.length<8)return response({error:'Not enough published locations for duels.'},503);
   const code=randomBytes(5).toString('hex').toUpperCase();
   const {data,error}=await db.from('arcade_duel_rooms').insert({owner_id:account.id,code,questions:qs,expires_at:new Date(Date.now()+7*86400000).toISOString()}).select('id,code').single();
   if(error)throw error;return response({duel:data});
  }
  if(body.action==='join_duel'){
   if(!account)return response({error:'Sign in to join a duel.'},401);
   const code=String(body.code||'').trim().toUpperCase();
   if(!/^[A-F0-9]{10}$/.test(code))return response({error:'Invalid invitation code.'},400);
   const {data:room,error}=await db.from('arcade_duel_rooms').select('id,owner_id,joiner_id,expires_at').eq('code',code).maybeSingle();
   if(error)throw error;
   if(!room||isExpired(room.expires_at))return response({error:'Invitation has expired or does not exist.'},404);
   if(room.owner_id===account.id||room.joiner_id===account.id)return response({joined:true,roomId:room.id});
   if(room.joiner_id)return response({error:'This challenge already has two players.'},409);
   const {data:joined,error:joinError}=await db.from('arcade_duel_rooms').update({joiner_id:account.id}).eq('id',room.id).is('joiner_id',null).select('id');
   if(joinError)throw joinError;if(!joined?.length)return response({error:'Another player joined first.'},409);
   return response({joined:true,roomId:room.id});
  }
  if(body.action==='start'||body.action==='start_duel'){
   let duelId:string|null=null,questions:ArcadeQuestion[]=[];
   if(body.action==='start_duel'){
    if(!account)return response({error:'Sign in for duels.'},401);
    duelId=String(body.duelId||'');
    if(!/^[0-9a-f-]{36}$/.test(duelId))return response({error:'Invalid duel ID.'},400);
    const {data:room,error}=await db.from('arcade_duel_rooms').select('id,owner_id,joiner_id,expires_at,questions').eq('id',duelId).maybeSingle();
    if(error)throw error;
    if(!room||isExpired(room.expires_at)||![room.owner_id,room.joiner_id].includes(account.id))return response({error:'Private duel not found.'},404);
    const {data:past,error:pastError}=await db.from('arcade_runs').select('*').eq('duel_id',room.id).eq('user_id',account.id).maybeSingle();
    if(pastError)throw pastError;
    if(past)return response({run:publicRun(past as RunRow)});
    questions=room.questions as ArcadeQuestion[];
   }else{
    const challenges=await listChallenges();questions=chooseArcadeQuestions(challenges);
   }
   if(questions.length<8)return response({error:'Not enough published locations for Time Attack.'},503);
   const started=new Date().toISOString();
   const {data,error}=await db.from('arcade_runs').insert({guest_key:guest,user_id:account?.id||null,duel_id:duelId,questions,expires_at:expiresAt(started),started_at:started}).select('*').single();
   if(error?.code==='23505')return response({error:'This duel was already started. Refresh your arcade.'},409);
   if(error)throw error;
   return response({run:publicRun(data as RunRow)});
  }
  if(body.action==='answer'||body.action==='skip'){
   const id=String(body.runId||'');
   if(!/^[0-9a-f-]{36}$/.test(id))return response({error:'Invalid run.'},400);
   const {data,error}=await db.from('arcade_runs').select('*').eq('id',id).eq('guest_key',guest).maybeSingle();
   if(error)throw error;
   if(!data)return response({error:'Run not found.'},404);
   const run=data as RunRow;
   if(run.status!=='active')return response({run:publicRun(run)});
   const timedOut=isExpired(run.expires_at);
   if(timedOut){
    const {data:updated,error:timeoutError}=await db.from('arcade_runs').update({status:'expired',completed_at:new Date().toISOString()}).eq('id',id).eq('question_index',run.question_index).eq('status','active').select('*');
    if(timeoutError)throw timeoutError;return response({run:publicRun((updated?.[0]||run) as RunRow),correct:false,expired:true});
   }
   const q=run.questions[run.question_index];
   if(!q)return response({error:'Question list exhausted.'},409);
   const answer=String(body.answer||'').slice(0,150);
   if(body.action==='answer'&&!q.choices.some(c=>c.name===answer))return response({error:'Choose one of the displayed locations.'},400);
   const awarded=body.action==='skip'?0:awardAnswer(q,answer),next=run.question_index+1,done=next>=run.questions.length;
   const {data:updated,error:updateError}=await db.from('arcade_runs').update({
      question_index:next,score:run.score+awarded,hits:run.hits+(awarded>0?1:0),
      status:done?'completed':'active',completed_at:done?new Date().toISOString():null
    }).eq('id',id).eq('question_index',run.question_index).eq('status','active').select('*');
   if(updateError)throw updateError;
   if(!updated?.length)return response({error:'This question has already been submitted. Reload to continue.'},409);
   return response({run:publicRun(updated[0] as RunRow),correct:awarded>0,awarded});
  }
  return response({error:'Unknown arcade action.'},400);
 }catch(error){console.error('[Arcade POST]',error);return response({error:'Unable to complete that arcade action.'},503)}
}
