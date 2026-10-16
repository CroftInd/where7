import {BASE_POINTS,MAX_GUESSES,type Challenge,type PublicGame,type Session} from './types.ts';

export function normalized(name:string):string {
  const value=name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const aliases:Record<string,string>={usa:'unitedstates',us:'unitedstates',unitedstatesofamerica:'unitedstates',
    uk:'unitedkingdom',greatbritain:'unitedkingdom',britain:'unitedkingdom',nyc:'newyorkcity',
    cityofnewyork:'newyorkcity',cityofwestminsterlondon:'cityofwestminster'};
  return aliases[value]||value;
}
const REGION_NAMES:Record<string,string[]>={
  USA:['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming','District of Columbia'],
  GBR:['England','Scotland','Wales','Northern Ireland']
};
export function newSession(challengeId:string,mode:Session['mode'],now=new Date().toISOString()):Session {
  return {challengeId,mode,stage:0,guesses:0,score:0,hints:[],history:[],status:'playing',startedAt:now,endedAt:null,version:0};
}
export function guess(session:Session,challenge:Challenge,answer:string,at=new Date().toISOString()):Session {
  if(session.status!=='playing')throw new Error('This expedition has finished.');
  if(session.stage<0||session.stage>=7||session.guesses>=MAX_GUESSES)throw new Error('No guesses remain.');
  const stage=session.stage;
  const submitted=normalized(answer);
  if(!submitted || answer.length>120)throw new Error('Please select a valid map location.');
  // Only allow map features in the current stage, to prevent free-text answer guessing.
  if(stage>0 && !challenge.stages[stage].choices.some(c=>normalized(c.name)===submitted)) {
    // Official regional outlines include many more selections than the small fallback marker set.
    // Whitelist the published country division names; do NOT accept arbitrary strings.
    const official=challenge.stages[stage].selection==='region'?REGION_NAMES[challenge.countryIso3]||[]:[];
    if(!official.some(name=>normalized(name)===submitted))throw new Error('Choose one of the highlighted locations.');
  }
  const correct=submitted===normalized(challenge.stages[stage].answer);
  const next:Session={...session,guesses:session.guesses+1,history:[...session.history,{stage,answer,correct,time:at}],version:session.version+1};
  if(correct){next.score+=Math.max(50,BASE_POINTS[stage]-(session.hints.includes(stage)?125:0)); next.stage+=1;}
  if(next.stage===7){next.status='won';next.endedAt=at;}
  else if(next.guesses>=MAX_GUESSES){next.status='lost';next.endedAt=at;}
  return next;
}
export function useHint(session:Session):Session {
  if(session.status!=='playing')throw new Error('This expedition has finished.');
  if(session.hints.includes(session.stage))return session;
  return {...session,hints:[...session.hints,session.stage],version:session.version+1};
}
export function abandon(session:Session,at=new Date().toISOString()):Session {
  if(session.status!=='playing')return session;
  return {...session,status:'abandoned',endedAt:at,version:session.version+1};
}
export function publicGame(session:Session,challenge:Challenge,demo:boolean):PublicGame {
  const stage=challenge.stages[session.stage];
  const current=session.status==='playing' && stage ? {
    level:stage.level,label:stage.label,clue:stage.clue,center:stage.center,zoom:stage.zoom,
    selection:stage.selection,choices:stage.choices,countryIso3:challenge.countryIso3,
    ...(session.hints.includes(session.stage)?{hint:stage.hint}:{})
  }:null;
  return {challengeId:challenge.id,title:session.status==='playing'?'Daily Mystery':challenge.title,mode:session.mode,stage:session.stage,guesses:session.guesses,
    hearts:MAX_GUESSES-session.guesses,score:session.score,hints:session.hints,history:session.history,
    status:session.status,startedAt:session.startedAt,endedAt:session.endedAt,current,
    path:challenge.stages.slice(0,Math.min(session.stage,7)).map(s=>s.answer), demo,
    ...(session.status!=='playing'?{sources:challenge.stages.slice(0,session.stage).map((s,i)=>({stage:i,answer:s.answer,url:s.source}))}:{})};
}
export function validateChallenge(input:unknown):{valid:true;value:Challenge}|{valid:false;errors:string[]} {
  const errors:string[]=[];
  if(!input||typeof input!=='object'||Array.isArray(input))return{valid:false,errors:['Challenge must be an object.']};
  const x=input as Record<string,unknown>;
  if(typeof x.title!=='string'||x.title.trim().length<4||x.title.length>120)errors.push('Title must be 4–120 characters.');
  if(typeof x.countryIso3!=='string'||!/^[A-Z]{3}$/.test(x.countryIso3))errors.push('Country code must be a 3-letter ISO code.');
  if(x.status!=='draft'&&x.status!=='published')errors.push('Choose a valid status.');
  if(x.publishDate!==null&&x.publishDate!==undefined&&(typeof x.publishDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.publishDate)))errors.push('Use YYYY-MM-DD for dates.');
  if(!Array.isArray(x.stages)||x.stages.length!==7)errors.push('Exactly seven stages are required.');
  else x.stages.forEach((v,i)=>{
    const s=v as Record<string,unknown>;
    if(!s||typeof s!=='object') {errors.push(`Stage ${i+1}: invalid stage.`);return;}
    for(const key of ['clue','hint','answer'])if(typeof s[key]!=='string'||String(s[key]).trim().length<3||String(s[key]).length>600)errors.push(`Stage ${i+1}: ${key} is missing or too long.`);
    if(typeof s.source!=='string'||!/^https:\/\//.test(s.source))errors.push(`Stage ${i+1}: source must be an HTTPS link.`);
    if(!Array.isArray(s.center)||s.center.length!==2||!s.center.every(n=>typeof n==='number'&&Number.isFinite(n)))errors.push(`Stage ${i+1}: invalid map center.`);
    if(typeof s.zoom!=='number'||s.zoom<1||s.zoom>20)errors.push(`Stage ${i+1}: zoom must be 1–20.`);
    if(i>0){
      if(!Array.isArray(s.choices)||s.choices.length<3||s.choices.length>40)errors.push(`Stage ${i+1}: provide 3–40 map choices.`);
      else {
        const names=new Set<string>(); let match=false;
        s.choices.forEach((c)=>{
          if(!c||typeof c.name!=='string'||typeof c.lat!=='number'||typeof c.lng!=='number'||!Number.isFinite(c.lat)||!Number.isFinite(c.lng)||Math.abs(c.lat)>90||Math.abs(c.lng)>180)errors.push(`Stage ${i+1}: invalid map choice.`);
          else{ const name=normalized(c.name);if(names.has(name))errors.push(`Stage ${i+1}: duplicate location.`);names.add(name);if(name===normalized(String(s.answer)))match=true;}
        });
        if(!match)errors.push(`Stage ${i+1}: correct answer must appear among choices.`);
      }
    }
  });
  if(errors.length)return{valid:false,errors};
  // Strip unknown fields, and tightly limit payload size server-side before calling this helper.
  return{valid:true,value:x as unknown as Challenge};
}
