import test from 'node:test';
import assert from 'node:assert/strict';
import {contentIssues,checklistComplete,validGeometry,containsPoint,planBuffer,placeKey,duplicateDestinations,reviewCandidates} from '../lib/content-quality.ts';
import {emptyChecklist,REVIEW_CHECKS} from '../lib/content-types.ts';
import {guess,newSession,publicGame,validateChallenge} from '../lib/engine.ts';
import type {Challenge} from '../lib/types.ts';
import seeds from '../data/challenges.json' with {type:'json'};

function fixture(index=0):Challenge{
 const c=structuredClone(seeds.find(c=>c.id==='nyc')) as Challenge;
 c.id='fixture-'+index;c.revision=1;c.reviewStatus='approved';c.countryIso3=['USA','FRA','JPN','ZAF','BRA','NZL'][index%6];c.reserve=false;c.status='published';
 c.stages=c.stages.map((s,i)=>{
  const answer=i===6?'Fixture destination '+index:s.answer;
  const id='fixture:'+index+':'+i;
  const place={id,parentId:i===0?null:'fixture:'+index+':'+(i-1),lat:40.75,lng:-73.98,source:'https://example.test/evidence',relationshipSource:i===0?undefined:'https://example.test/relationship',relation:'within' as const};
  return {...s,answer,place,choices:i===0?[]:Array.from({length:5},(_,j)=>({id:j===0?id:'decoy:'+i+':'+j,name:j===0?answer:'Fixture decoy '+i+' '+j,lat:40.75+j*.001,lng:-73.98}))};
 });
 return c;
}
test('publication requires source-backed identities and a continuous geographic chain',()=>{
 const ready=fixture();assert.deepEqual(contentIssues(ready).filter(i=>i.severity==='error'),[]);
 const broken=structuredClone(ready);broken.stages[4].place!.parentId='wrong-parent';
 assert(contentIssues(broken).some(i=>i.code==='parent'));
 delete broken.stages[2].place;
 assert(contentIssues(broken).some(i=>i.code==='place_evidence'));
});
test('a generic prompt, equivalent alternatives or a mismatched marker blocks publication',()=>{
 const c=fixture();c.stages[4].clue='Zoom further into the neighbourhood around the destination shown on the map.';
 assert(contentIssues(c).some(i=>i.code==='generic_clue'));
 c.countryIso3='USA';c.stages[5].choices[0].name='Fifth Avenue';c.stages[5].choices[1].name='5th Avenue';
 assert(contentIssues(c).some(i=>i.code==='equivalent_choices'));
 c.stages[1].choices[0].lat=35;
 assert(contentIssues(c).some(i=>i.code==='answer_location'));
 assert.equal(placeKey('New York County','USA',3),placeKey('Manhattan','USA',3));
 assert.notEqual(placeKey('New York County','USA',2),placeKey('Manhattan','USA',2));
});
test('the four UK nations require a documented exception; five remains the default',()=>{
 const c=fixture();c.countryIso3='GBR';c.stages[1].answer='England';c.stages[1].choices=['England','Northern Ireland','Scotland','Wales'].map((name,j)=>({id:j===0?c.stages[1].place!.id:'nation-'+j,name,lat:40.75,lng:-73.98}));
 assert(contentIssues(c).some(i=>i.code==='choice_count'));
 c.stages[1].choiceException={reason:'The UK consists of four constituent nations; all four are listed.',source:'https://service-manual.ons.gov.uk/content/language/countries-and-regions'};
 assert(!contentIssues(c).some(i=>i.code==='choice_count'));
 c.stages[1].choices[3].name='Greater London';assert(contentIssues(c).some(i=>i.code==='choice_count'));
});
test('geometry validates coordinates and parent containment, including holes and the date line',()=>{
 const geometry={type:'Polygon' as const,coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[3,1],[3,3],[1,3],[1,1]]]};
 assert(validGeometry(geometry));assert.equal(containsPoint(geometry,[.5,.5]),true);assert.equal(containsPoint(geometry,[2,2]),false);
 assert.equal(validGeometry({type:'Polygon',coordinates:[[[0,0],[1,0],[1,1]]]}),false);
 assert.equal(validGeometry({type:'Point',coordinates:[181,0]}),false);
 assert.equal(validGeometry({type:'LineString',coordinates:[[0,0],[1,1]]}),true);
 const dateline={type:'Polygon' as const,coordinates:[[[179,-1],[-179,-1],[-179,1],[179,1],[179,-1]]]};
 assert.equal(containsPoint(dateline,[180,0]),true);
 const c=fixture();c.stages[0].place!.geometry=geometry;c.stages[0].place!.attribution='Test fixture';
 assert(contentIssues(c).some(i=>i.code==='outside_parent'));
});
test('review sign-off is explicit for all seven stages and cannot be inferred from status',()=>{
 const checklist=emptyChecklist();assert.equal(checklistComplete(checklist),false);
 for(const stage of checklist.stages)for(const key of REVIEW_CHECKS)stage[key]=true;
 assert.equal(checklistComplete(checklist),false);checklist.mobileTested=true;assert(checklistComplete(checklist));
 checklist.stages[4].coordinates=false;assert(!checklistComplete(checklist));
});
test('the buffer proposes 30 distinct approved destinations, excludes reserves and covers UTC dates',()=>{
 const all=Array.from({length:35},(_,i)=>fixture(i));all[0].reserve=true;all[1].reviewStatus='in_review';
 const plan=planBuffer(all,'2026-12-20');assert.equal(plan.length,30);assert.equal(plan.at(-1)?.day,'2027-01-18');
 assert(!plan.some(p=>['fixture-0','fixture-1'].includes(p.challengeId)));assert.equal(new Set(plan.map(p=>p.challengeId)).size,30);
 assert.equal(new Set(plan.slice(0,6).map(p=>p.countryIso3)).size,6);
 const duplicate=structuredClone(all[2]);duplicate.id='duplicate';
 assert.equal(duplicateDestinations([all[2],duplicate]).length,1);
 assert.equal(planBuffer([all[2],duplicate],'2026-10-23').length,1);
});
test('active runs retain their frozen clues, aliases and answers after a content edit',()=>{
 const original=fixture();const session={...newSession(original.id,'daily'),challengeSnapshot:structuredClone(original)};
 const changed=structuredClone(original);changed.revision=2;changed.stages[0].answer='Canada';changed.stages[0].clue='This is the edited clue.';
 const result=guess(session,changed,original.stages[0].answer);
 assert.equal(result.stage,1);assert.equal(publicGame(session,changed,false).current?.clue,original.stages[0].clue);
 const publicPayload=JSON.stringify(publicGame(session,changed,false));
 assert(!publicPayload.includes('challengeSnapshot'));assert(!publicPayload.includes('relationshipSource'));assert(!publicPayload.includes('Fixture destination'));
 assert.equal(publicGame(session,changed,false).contentRevision,1);
});
test('declared aliases are accepted without exposing correct-answer alias lists',()=>{
 const c=fixture();c.stages[0].answerAliases=['US of A'];
 assert.equal(guess(newSession(c.id,'practice'),c,'US of A').stage,1);
 assert(!JSON.stringify(publicGame(newSession(c.id,'practice'),c,false)).includes('US of A'));
 const s=guess(newSession(c.id,'practice'),c,c.stages[0].answer);c.stages[1].choices[0].aliases=['Local alias'];
 assert.equal(guess(s,c,'Local alias').stage,2);
});
test('drafts may be incomplete while publication validation remains strict',()=>{
 const c=fixture();c.stages[2].clue='';c.stages[2].hint='';c.stages[2].source='';c.stages[2].choices=[];
 assert.equal(validateChallenge(c,{draft:true}).valid,true);assert.equal(validateChallenge(c).valid,false);
 c.stages[4].place={id:2} as never;assert.equal(validateChallenge(c,{draft:true}).valid,false);
});

test('review candidates are diverse and never become approved simply by entering the queue',()=>{
 const all=Array.from({length:36},(_,i)=>({...fixture(i),reviewStatus:'draft' as const}));
 const queue=reviewCandidates(all);assert.equal(queue.length,30);assert.equal(new Set(queue.slice(0,6).map(c=>c.countryIso3)).size,6);
 assert(queue.every(c=>c.reviewStatus==='draft'));assert.equal(planBuffer(all,'2026-10-23').length,0);
});

test('sourced borough geometries have valid selection anchors and imported extra fields are stripped',()=>{
 const london=seeds.find(c=>c.id==='london') as Challenge;
 assert.equal(london.stages[3].choices.length,5);
 for(const choice of london.stages[3].choices){assert(validGeometry(choice.geometry));assert.equal(containsPoint(choice.geometry!,[choice.lng,choice.lat]),true);assert(choice.source?.startsWith('https://'));assert(choice.attribution);}
 const c=fixture();(c.stages[2].choices[0] as unknown as Record<string,unknown>).privateAnswer='Do not serialize imported metadata';
 const result=validateChallenge(c);assert(result.valid);if(result.valid)assert(!JSON.stringify(result.value.stages[2].choices).includes('privateAnswer'));
});
test('Belgium offers its three real regions without adding provinces or aliases',()=>{
 const c=fixture();c.countryIso3='BEL';const s=c.stages[1];s.answer='Brussels-Capital Region';s.choices=['Brussels-Capital Region','Flemish Region','Walloon Region'].map((name,i)=>({id:i?'belgium-'+i:s.place!.id,name,lat:s.place!.lat,lng:s.place!.lng}));
 assert(contentIssues(c).some(i=>i.code==='choice_count'));
 s.choiceException={reason:'Belgium has exactly three territorial regions; this is the complete set.',source:'https://www.belgium.be/en/about_belgium/government/regions'};
 assert(!contentIssues(c).some(i=>i.code==='choice_count'));
 s.choices[2].name='Province of Antwerp';assert(contentIssues(c).some(i=>i.code==='choice_count'));
});
test('withdrawn draft copies do not count as duplicate published destinations',()=>{const c=fixture(),copy=structuredClone(c);copy.id='withdrawn';copy.status='draft';assert.deepEqual(duplicateDestinations([c,copy]),[]);});
test('Ireland offers the complete traditional province set, separately from counties',()=>{
 const c=fixture();c.countryIso3='IRL';const s=c.stages[1];s.answer='Leinster';s.choices=['Leinster','Connacht','Munster','Ulster'].map((name,i)=>({id:i?'province-'+i:s.place!.id,name,lat:40.75,lng:-73.98}));
 assert(contentIssues(c).some(i=>i.code==='choice_count'));
 s.choiceException={reason:'The four traditional provinces are the complete set; Ulster includes its part in the Republic.',source:'https://www.ireland.com/help-and-advice/practical-information/irelands-counties-and-provinces/'};
 assert(!contentIssues(c).some(i=>i.code==='choice_count'));
 s.choices[3].name='County Dublin';assert(contentIssues(c).some(i=>i.code==='choice_count'));
});
test('translated regional names cannot be presented as competing answers',()=>{
 for(const [iso,a,b] of [['ESP','Catalonia','Cataluña'],['NLD','North Holland','Noord-Holland'],['AUT','Vienna','Wien'],['CZE','Prague','Hlavní město Praha'],['CHN','Beijing','Beijing Municipality'],['BEL','Flemish Region','Vlaams Gewest']]){
  const c=fixture();c.countryIso3=iso;c.stages[1].answer=a;c.stages[1].choices[0].name=a;c.stages[1].choices[1].name=b;
  assert(contentIssues(c).some(i=>i.code==='equivalent_choices'),iso);
 }
});
