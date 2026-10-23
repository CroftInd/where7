import {normalized,validateChallenge} from './engine.ts';
import {REVIEW_CHECKS,type QualityIssue,type ReviewChecklist,type ScheduleEntry} from './content-types.ts';
import type {Challenge,Stage} from './types.ts';
import type {Geometry,Position} from 'geojson';
import {continentFor} from './continents.ts';

export const httpsSource=(value:unknown)=>{
  if(typeof value!=='string'||value.length>1500)return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname;}catch{return false;}
};
/** Curated equivalences are context-specific; do not globally merge unrelated names. */
export function placeKey(name:string,iso:string,level:number){
  const key=normalized(name);
  const groups:Record<string,string[][]>={
    'USA:3':[['manhattan','newyorkcounty'],['brooklyn','kingscounty'],['statenisland','richmondcounty']],
    'USA:5':[['fifthavenue','5thavenue'],['sixthavenue','6thavenue','avenueoftheamericas']],
    'DNK:1':[['capitalregion','capitalregionofdenmark','hovedstaden']],
    'ESP:1':[['catalonia','cataluna','catalunya','catalunacatalunya'],['communityofmadrid','comunidaddemadrid']],
    'NLD:1':[['northholland','noordholland'],['southholland','zuidholland']],
    'AUT:1':[['vienna','wien']],
    'CZE:1':[['prague','praha','hlavnimestopraha']],
    'CHN:1':[['beijing','beijingmunicipality'],['shanghai','shanghaimunicipality']],
    'BEL:1':[['brusselscapitalregion','brusselshoofdstedelijkgewest','brusselshoofdstedelijk'],['flemishregion','vlaamsgewest'],['walloonregion','wallonie','wallonnegewest']]
  };
  return groups[iso+':'+level]?.find(group=>group.includes(key))?.[0]||key;
}
export function validGeometry(geometry:unknown):geometry is Geometry{
  if(!geometry||typeof geometry!=='object')return false;
  const g=geometry as {type:string;coordinates:unknown};
  if(!['Polygon','MultiPolygon','LineString','MultiLineString','Point'].includes(g.type))return false;
  let count=0;
  const point=(v:unknown):v is Position=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&Math.abs(v[0])<=180&&Math.abs(v[1])<=90&&++count<=6000;
  const line=(v:unknown,min=2)=>Array.isArray(v)&&v.length>=min&&v.every(point);
  const ring=(v:unknown)=>line(v,4)&&JSON.stringify((v as Position[])[0])===JSON.stringify((v as Position[]).at(-1));
  const polygon=(v:unknown)=>Array.isArray(v)&&v.length>0&&v.every(ring);
  if(g.type==='Point')return point(g.coordinates);
  if(g.type==='LineString')return line(g.coordinates);
  if(g.type==='MultiLineString')return Array.isArray(g.coordinates)&&g.coordinates.length>0&&g.coordinates.every(v=>line(v));
  if(g.type==='Polygon')return polygon(g.coordinates);
  return Array.isArray(g.coordinates)&&g.coordinates.length>0&&g.coordinates.every(polygon);
}
function inRing(point:Position,ring:Position[]){
  let inside=false;const [x,y]=point;
  // Unwrap around the point, including polygons crossing the date line.
  const relative=(lng:number)=>x+((lng-x+540)%360)-180;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j],ax=relative(a[0]),bx=relative(b[0]);
    const cross=(x-ax)*(b[1]-a[1])-(y-a[1])*(bx-ax);
    if(Math.abs(cross)<1e-9&&x>=Math.min(ax,bx)&&x<=Math.max(ax,bx)&&y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1]))return true;
    if((a[1]>y)!==(b[1]>y)&&x<(bx-ax)*(y-a[1])/(b[1]-a[1])+ax)inside=!inside;
  }
  return inside;
}
export function containsPoint(geometry:Geometry,point:Position):boolean|null{
  const polygon=(rings:Position[][])=>inRing(point,rings[0])&&!rings.slice(1).some(r=>inRing(point,r));
  if(geometry.type==='Polygon')return polygon(geometry.coordinates);
  if(geometry.type==='MultiPolygon')return geometry.coordinates.some(polygon);
  return null; // A road is not an enclosing area. Require address/access evidence.
}
export function choiceExceptionAllowed(stage:Stage,iso:string){
  const peers:Record<string,string[]>={GBR:['england','scotland','wales','northernireland'],BEL:['brusselscapitalregion','flemishregion','walloonregion'],IRL:['connacht','leinster','munster','ulster']};
  const expected=peers[iso];
  return stage.level===1&&!!expected&&stage.choices.length===expected.length&&
    expected.every(n=>stage.choices.some(c=>normalized(c.name)===n))&&
    !!stage.choiceException&&stage.choiceException.reason.trim().length>=20&&httpsSource(stage.choiceException.source);
}
export function contentIssues(challenge:Challenge,{requireEvidence=true}={}):QualityIssue[]{
  const issues:QualityIssue[]=[];
  const add=(stage:number|null,code:string,message:string,severity:'error'|'warning'='error')=>issues.push({stage,code,message,severity});
  const parsed=validateChallenge(challenge);
  if(!parsed.valid){for(const error of parsed.errors)add(null,'structure',error);return issues;}
  const ids=new Set<string>();
  for(const [i,s] of challenge.stages.entries()){
    if(s.level!==i||!s.label?.trim())add(i,'stage','Stages must be ordered and have a clear player-facing label.');
    if(s.selection!==(i===0?'country':s.selection)||!['country','region','markers'].includes(s.selection)||i>0&&s.selection==='country')add(i,'selection','Only the first stage may select a country.');
    if(!httpsSource(s.source))add(i,'source','Provide a valid HTTPS source.');
    else if(new URL(s.source).pathname.replace(/\//g,'').length<3)add(i,'source_specificity','Use a specific evidence page, not a website homepage.','warning');
    if(s.clue.trim().length<20)add(i,'clue','Write a specific, discriminating clue.','warning');
    if(/next map area|zoom further into|final access road|cluster of nearby|shown on the map/i.test(s.clue))add(i,'generic_clue','This generic navigation prompt does not distinguish the answer.');
    if(s.center.length!==2||Math.abs(s.center[0])>180||Math.abs(s.center[1])>90)add(i,'coordinates','Map centre is outside valid longitude/latitude bounds.');
    if(i>0){
      if(s.choices.length<5&&!choiceExceptionAllowed(s,challenge.countryIso3))add(i,'choice_count','Needs at least five choices, or a documented complete finite geographic set.');
      const seen=new Set<string>(),choiceIds=new Set<string>();
      for(const c of s.choices){
        if(!c.id||choiceIds.has(c.id))add(i,'choice_id','Choices need distinct stable IDs.');
        choiceIds.add(c.id);
        const own=new Set([c.name,...(c.aliases||[])].map(n=>placeKey(n,challenge.countryIso3,i)));
        for(const name of own){if(seen.has(name))add(i,'equivalent_choices','Two choices name the same place or alias.');seen.add(name);}
        if(c.geometry&&(!validGeometry(c.geometry)||!httpsSource(c.source)||!c.attribution?.trim()))add(i,'geometry','Choice geometry requires valid GeoJSON, a source and attribution.');
        if(c.geometry&&validGeometry(c.geometry)&&containsPoint(c.geometry,[c.lng,c.lat])===false)add(i,'geometry_point','Choice marker is outside its own geometry.');
      }
    }
    const place=s.place;
    if(!place){if(requireEvidence)add(i,'place_evidence','Add a stable place ID, location and relationship evidence.');continue;}
    if(!/^[A-Za-z0-9][A-Za-z0-9:._/-]{2,159}$/.test(place.id)||ids.has(place.id))add(i,'place_id','Each stage needs a distinct stable place ID.');
    ids.add(place.id);
    if(!Number.isFinite(place.lat)||!Number.isFinite(place.lng)||Math.abs(place.lat)>90||Math.abs(place.lng)>180||!httpsSource(place.source))add(i,'place_evidence','Place coordinates and a supporting HTTPS source are required.');
    if(i===0&&place.parentId!==null)add(i,'parent','Country must not have a parent.');
    if(i>0){
      const parent=challenge.stages[i-1].place;
      if(!parent||place.parentId!==parent.id)add(i,'parent','Place must reference the preceding stage’s stable ID.');
      if(!httpsSource(place.relationshipSource))add(i,'relationship_source','Cite evidence that this place is within, or accessed from, the parent.');
      if(!['within','accessed_from'].includes(place.relation||''))add(i,'relationship','Choose within or accessed from.');
      const correct=s.choices.find(c=>normalized(c.name)===normalized(s.answer));
      if(correct&&(correct.id!==place.id||Math.abs(correct.lat-place.lat)>0.0001||Math.abs(correct.lng-place.lng)>0.0001))add(i,'answer_location','The answer choice must match the place ID and coordinates.');
      if(parent?.geometry&&['LineString','MultiLineString'].includes(parent.geometry.type)&&place.relation!=='accessed_from')add(i,'road_relationship','Use evidenced access from a road, not polygon containment.');
      if(parent?.geometry&&validGeometry(parent.geometry)&&place.relation==='within'&&containsPoint(parent.geometry,[place.lng,place.lat])===false)add(i,'outside_parent','The child point lies outside the supplied parent boundary.');
    }
    if(place.geometry&&(!validGeometry(place.geometry)||!place.attribution?.trim()))add(i,'geometry','Place geometry requires valid coordinates and attribution.');
  }
  return issues;
}
export function checklistComplete(value:unknown):value is ReviewChecklist{
  if(!value||typeof value!=='object')return false;
  const c=value as ReviewChecklist;
  return Array.isArray(c.stages)&&c.stages.length===7&&c.stages.every(s=>s&&REVIEW_CHECKS.every(key=>s[key]===true))&&c.mobileTested===true&&typeof c.notes==='string'&&c.notes.length<=2000&&(c.minutesSpent===undefined||typeof c.minutesSpent==='number'&&Number.isFinite(c.minutesSpent)&&c.minutesSpent>=0&&c.minutesSpent<=1440);
}
export const destinationKey=(c:Challenge)=>c.countryIso3+':'+normalized(c.stages[6]?.answer||c.id);
export function duplicateDestinations(challenges:Challenge[]){
  const groups=new Map<string,Challenge[]>();for(const c of challenges.filter(c=>c.status==='published')){const key=destinationKey(c);groups.set(key,[...(groups.get(key)||[]),c]);}
  return [...groups.values()].filter(g=>g.length>1).map(g=>g.map(c=>c.id));
}
/** A deterministic proposal; this does not mark content reviewed or publish it. */
export function planBuffer(challenges:Challenge[],startDay:string,days=30):ScheduleEntry[]{
  const eligible=challenges.filter(c=>c.status==='published'&&c.reviewStatus==='approved'&&!c.reserve&&contentIssues(c).every(i=>i.severity!=='error'));
  const remaining=[...new Map(eligible.map(c=>[destinationKey(c),c])).values()];
  const countries=new Map<string,number>(),continents=new Map<string,number>(),plan:ScheduleEntry[]=[];
  let last='';
  const count=Math.min(days,remaining.length);
  for(let i=0;i<count;i++){
    remaining.sort((a,b)=>(Number(a.countryIso3===last)-Number(b.countryIso3===last))||
      (continents.get(continentFor(a.countryIso3)||'Other')||0)-(continents.get(continentFor(b.countryIso3)||'Other')||0)||
      (countries.get(a.countryIso3)||0)-(countries.get(b.countryIso3)||0)||a.id.localeCompare(b.id));
    const c=remaining.shift()!;last=c.countryIso3;const continent=continentFor(last)||'Other';
    countries.set(last,(countries.get(last)||0)+1);continents.set(continent,(continents.get(continent)||0)+1);
    plan.push({day:new Date(Date.parse(startDay+'T00:00:00Z')+i*86400000).toISOString().slice(0,10),challengeId:c.id,revision:c.revision||1,countryIso3:last});
  }
  return plan;
}

/** A review work queue, deliberately separate from the approved publishing buffer. */
export function reviewCandidates(challenges:Challenge[],count=30):Challenge[]{
 const unique=[...new Map(challenges.filter(c=>c.reviewStatus!=='approved').map(c=>[destinationKey(c),c])).values()];
 const issues=new Map(unique.map(c=>[c.id,contentIssues(c).filter(i=>i.severity==='error').length]));
 const countries=new Map<string,number>(),continents=new Map<string,number>(),selected:Challenge[]=[];
 const total=Math.min(count,unique.length);
 for(let i=0;i<total;i++){
  unique.sort((a,b)=>(continents.get(continentFor(a.countryIso3)||'Other')||0)-(continents.get(continentFor(b.countryIso3)||'Other')||0)||
   (countries.get(a.countryIso3)||0)-(countries.get(b.countryIso3)||0)||(issues.get(a.id)||0)-(issues.get(b.id)||0)||a.id.localeCompare(b.id));
  const c=unique.shift()!,continent=continentFor(c.countryIso3)||'Other';selected.push(c);
  countries.set(c.countryIso3,(countries.get(c.countryIso3)||0)+1);continents.set(continent,(continents.get(continent)||0)+1);
 }
 return selected;
}
