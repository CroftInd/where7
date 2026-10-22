import type {Session} from './types.ts';

export type GameEvent='game_loaded'|'game_started'|'guess_accepted'|'guess_rejected'|'stage_reached'|'game_completed'|'game_abandoned'|'share_action';
/** Explicit allowlist: never log submitted answers, place IDs, clues or identity. */
export function gameEvent(event:GameEvent,session:Session,sessionKey:string,day:string,reason?:string){
  return {source:'where7_game',event,session:sessionKey,day,mode:session.mode,
    stage:session.stage,guesses:session.guesses,version:session.version,status:session.status,
    ...(reason?{reason}:{})};
}
export function transitionEvents(before:Session,after:Session):GameEvent[]{
  const events:GameEvent[]=[];
  if(after.guesses>before.guesses){
    if(before.guesses===0)events.push('game_started');
    events.push('guess_accepted');
    if(after.stage>before.stage)events.push('stage_reached');
  }
  if(before.status==='playing'&&after.status!=='playing')
    events.push(after.status==='abandoned'?'game_abandoned':'game_completed');
  return events;
}
