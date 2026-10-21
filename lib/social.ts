import {dayForCompletion,type Completion,weekMonday} from './progression.ts';

export type SocialWindow='daily'|'weekly'|'monthly';
export type SocialResult=Completion & {guest_key:string};
export type SocialPlayer={user_id:string;handle:string;discoverable:boolean;show_on_public_boards:boolean};
export type Ranking={userId:string;handle:string;score:number;days:number;perfect:number;stages:number;rank:number;tier:string};
export const isValidHandle=(s:string)=>/^[a-z0-9_]{3,18}$/.test(s);
export const sanitizeHandle=(s:unknown)=>String(s||'').trim().toLowerCase();
export const validInvite=(s:string)=>/^[A-F0-9]{10}$/.test(s);
export const sortPair=(one:string,two:string):[string,string]=>one<two?[one,two]:[two,one];
export const utcDay=()=>new Date().toISOString().slice(0,10);
export const tierFor=(points:number)=>points>=35000?'Diamond':points>=20000?'Platinum':points>=10000?'Gold':points>=3500?'Silver':'Bronze';
export const periodStart=(day:string,period:SocialWindow)=>period==='daily'?day:period==='weekly'?weekMonday(day):day.slice(0,7)+'-01';
export function rankings(rows:SocialResult[],players:SocialPlayer[],period:SocialWindow,today:string):Ranking[]{
  const start=periodStart(today,period);
  const tracked=new Map(players.map(x=>[x.user_id,{userId:x.user_id,handle:x.handle,score:0,days:0,perfect:0,stages:0,rank:0,tier:'Bronze'}]));
  const bestByDay=new Map<string,SocialResult>();
  for(const row of rows){
    if(row.mode!=='daily'||!row.finished_at)continue;
    const date=dayForCompletion(row),key=row.guest_key+':'+date;
    if(!date||date<start||date>today||!tracked.has(row.guest_key))continue;
    const prev=bestByDay.get(key);
    if(!prev||row.score>prev.score||(row.score===prev.score&&row.stage>prev.stage))bestByDay.set(key,row);
  }
  for(const row of bestByDay.values()){
    const p=tracked.get(row.guest_key)!;
    p.score+=Math.max(0,row.score);p.days++;p.perfect+=row.perfect?1:0;p.stages+=row.stage;
  }
  const results=[...tracked.values()].map(p=>({...p,tier:tierFor(p.score)}))
    .sort((a,b)=>b.score-a.score||b.perfect-a.perfect||b.stages-a.stages||a.handle.localeCompare(b.handle));
  let rank=0;
  return results.map((p,i)=>{
    if(i===0||p.score!==results[i-1].score||p.perfect!==results[i-1].perfect||p.stages!==results[i-1].stages)rank=i+1;
    return {...p,rank};
  });
}
export function spoilerFreeShare(stage:number,guesses:number,score:number,history:{stage:number;correct:boolean}[],date:string){
  const grid=Array.from({length:7},(_,i)=>{
    const attempts=history.filter(x=>x.stage===i);
    return attempts.some(x=>x.correct)?attempts.length===1?'🟩':'🟨':'⬛';
  }).join('');
  return 'WHERE7 🌍 '+date+'\n'+grid+'\n'+Math.max(0,Math.min(7,stage))+'/7 locations · '+Math.max(0,Math.min(7,guesses))+'/7 chances used · '+Math.max(0,score).toLocaleString('en-GB')+' points\nPlay the same mystery: https://www.where7.world';
}
