import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {playerKey,currentAccount,ensureProfile} from '@/lib/player';
import {selectChallenge,getGameState,saveSession,cloudReady} from '@/lib/store';
import {guess,useHint,abandon,publicGame,newSession} from '@/lib/engine';
import {assertCurrentRequest,GameConflict,utcDay,nextDailyReset} from '@/lib/game-request';
import {gameEvent,transitionEvents,type GameEvent} from '@/lib/game-events';
import type {Challenge,Session} from '@/lib/types';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
async function guestKey(){
  const account=await currentAccount();
  if(account)await ensureProfile(account.id,account.email);
  return playerKey();
}
function modeAndId(url:URL,body?:Record<string,unknown>){
  const mode=(body?.mode||url.searchParams.get('mode'))==='practice'?'practice':'daily' as Session['mode'];
  const id=String(body?.practiceKey||body?.challengeId||url.searchParams.get('challenge')||'').slice(0,100);
  return {mode,id};
}
function view(session:Session,challenge:Challenge,day:string){
  return {...publicGame(session,challenge,!cloudReady),...(session.mode==='daily'?{dailyDate:day,resetsAt:nextDailyReset(day)}:{})};
}
function record(event:GameEvent,guest:string,session:Session,day:string,reason?:string){
  const sessionKey=createHash('sha256').update(guest+':'+session.startedAt+':'+day+':'+session.mode).digest('hex').slice(0,24);
  console.info(JSON.stringify(gameEvent(event,session,sessionKey,day,reason)));
}
function errorResponse(error:unknown){
  const message=error instanceof Error?error.message:'Unexpected error';
  return NextResponse.json({error:message,...(error instanceof GameConflict?{code:error.code}:{})},
    {status:error instanceof GameConflict?409:400,headers});
}
export async function GET(request:Request){
  // Pin the date once per request, even when a DB call crosses midnight.
  const day=utcDay();
  try{
    const guest=await guestKey();const {mode,id}=modeAndId(new URL(request.url));
    const {challenge,session}=await getGameState(guest,id,mode,day);
    record('game_loaded',guest,session,day);
    return NextResponse.json({game:view(session,challenge,day)}, {headers});
  }catch(e){return errorResponse(e)}
}
export async function POST(request:Request){
  const day=utcDay();
  let context:{guest:string;session:Session}|undefined;
  let isGuess=false;
  try{
    const body=await request.json() as Record<string,unknown>;
    isGuess=body.action==='guess';
    const {mode,id}=modeAndId(new URL(request.url),body);
    // Reject yesterday's screen before selecting/creating today's session.
    if(mode==='daily'&&body.dailyDate!==day)
      throw new GameConflict('DAILY_CHANGED','A new daily expedition is ready. Check your progress to load it.');
    const guest=await guestKey();const {challenge,session}=await getGameState(guest,id,mode,day);
    context={guest,session};
    assertCurrentRequest(body,session,day);
    if(body.action==='share'){
      if(session.status==='playing')throw new Error('Finish your expedition before sharing.');
      record('share_action',guest,session,day);
      return NextResponse.json({game:view(session,challenge,day)},{headers});
    }
    let next:Session;
    if(body.action==='restart'){
      if(mode!=='practice')throw new Error('Official daily challenges cannot be restarted.');
      // Restart also uses compare-and-swap; an old guess cannot hit a fresh run.
      const latest=session.practiceKey?challenge:await selectChallenge(id,mode,day);
      next={...newSession(latest.id,mode),version:session.version+1,...(session.storageId?{storageId:session.storageId,practiceKey:session.practiceKey}:{}),challengeSnapshot:structuredClone(latest)};
    }else if(body.action==='guess')next=guess(session,challenge,String(body.answer||''));
    else if(body.action==='hint')next=useHint(session);
    else if(body.action==='giveup')next=abandon(session);
    else throw new Error('Unknown action.');
    if(next!==session)await saveSession(guest,session,next,day);
    for(const event of transitionEvents(session,next))record(event,guest,next,day);
    return NextResponse.json({game:view(next,challenge,day),correct:body.action==='guess'?next.history.at(-1)?.correct:undefined},{headers});
  }catch(e){
    if(isGuess&&context)record('guess_rejected',context.guest,context.session,day,e instanceof GameConflict?e.code:'INVALID_OR_UNSAVED');
    return errorResponse(e);
  }
}
