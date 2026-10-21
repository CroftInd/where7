import type {Challenge,Choice} from './types.ts';
export const ATTACK_SECONDS=180;
export const ATTACK_QUESTIONS=15;
export type ArcadeQuestion={id:string;challengeId:string;stage:number;label:string;clue:string;choices:Choice[];answer:string};
export type PublicArcadeQuestion=Omit<ArcadeQuestion,'answer'|'challengeId'>;
export const publicQuestion=(q:ArcadeQuestion):PublicArcadeQuestion=>({id:q.id,stage:q.stage,label:q.label,clue:q.clue,choices:q.choices});
export function chooseArcadeQuestions(challenges:Challenge[],random:()=>number=Math.random):ArcadeQuestion[]{
 const eligible=challenges.filter(c=>c.status==='published'&&c.stages.length===7&&c.stages.slice(1).some(s=>s.choices.length===5));
 const pool=eligible.flatMap(c=>c.stages.slice(1).filter(s=>s.choices.length===5).map(s=>({c,s})));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 const used=new Set<string>();
 const result:ArcadeQuestion[]=[];
 for(const {c,s} of pool){
  if(used.has(c.id))continue;used.add(c.id);
  result.push({id:c.id+':'+s.level,challengeId:c.id,stage:s.level,label:s.label,clue:s.clue,choices:s.choices,answer:s.answer});
  if(result.length===ATTACK_QUESTIONS)break;
 }
 return result;
}
export function expiresAt(startedAt:string){return new Date(Date.parse(startedAt)+ATTACK_SECONDS*1000).toISOString()}
export function isExpired(expires:string,now=new Date()){return Date.parse(expires)<=now.getTime()}
export function awardAnswer(q:ArcadeQuestion,name:string){return q.choices.some(x=>x.name===name)&&q.answer===name?100:0}
