import type {Session} from './types.ts';

export const utcDay=(now=new Date())=>now.toISOString().slice(0,10);
export const nextDailyReset=(day:string)=>new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString();

export class GameConflict extends Error {
  code:'STALE_SESSION'|'DAILY_CHANGED';
  constructor(code:'STALE_SESSION'|'DAILY_CHANGED',message:string){super(message);this.code=code;}
}

/** Check the state the player actually saw, including wrong guesses and hints. */
export function assertCurrentRequest(body:Record<string,unknown>,session:Session,day:string){
  if(session.mode==='daily'&&body.dailyDate!==day)
    throw new GameConflict('DAILY_CHANGED','A new daily expedition is ready. Check your progress to load it.');
  if(body.challengeId!==session.challengeId||!Number.isSafeInteger(body.version)||
    body.version!==session.version||body.stage!==session.stage)
    throw new GameConflict('STALE_SESSION','Your progress changed. Check your progress before another guess.');
}
