import {nextDailyReset,utcDay} from './game-request.ts';
/** GMT is UTC year-round, including when British local time observes BST. */
export function nextGmtMidnight(now:number){return nextDailyReset(utcDay(new Date(now)));}
export function dailyCountdown(resetsAt:string,now:number){
 const remaining=Math.max(0,Math.ceil((Date.parse(resetsAt)-now)/1000));
 if(!Number.isFinite(remaining))return '00:00:00';
 return [Math.floor(remaining/3600),Math.floor(remaining/60)%60,remaining%60].map(n=>String(n).padStart(2,'0')).join(':');
}
