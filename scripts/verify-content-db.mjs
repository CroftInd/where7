import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const db=new PGlite();
const admin='00000000-0000-4000-8000-000000000001',guest='00000000-0000-4000-8000-000000000002';
const checks=['facts','uniqueAnswer','source','alternatives','hierarchy','coordinates','aliases'];
// Deliberately synthetic test content. It is never imported into a connected project.
function fixture(index=0){
 const c=structuredClone(JSON.parse(read('data/challenges.json'))[1]);c.id='db-fixture-'+index;c.countryIso3=['USA','FRA','JPN','ZAF','BRA','NZL'][index%6];c.title='Test expedition '+index;c.reserve=false;
 c.checklist={mobileTested:true,notes:'Synthetic database verification only.',stages:Array.from({length:7},()=>Object.fromEntries(checks.map(k=>[k,true])))};
 c.stages=c.stages.map((s,i)=>{const id='db-fixture:'+index+':'+i,answer='Test location '+index+' '+i;
 return {...s,answer,clue:'A specific synthetic test clue for location '+index+' '+i+'.',source:'https://example.test/fact',place:{id,parentId:i===0?null:'db-fixture:'+index+':'+(i-1),lat:40,lng:-74,source:'https://example.test/place',relationshipSource:'https://example.test/relationship',relation:'within'},choices:i===0?[]:Array.from({length:5},(_,j)=>({id:j===0?id:'decoy:'+index+':'+i+':'+j,name:j===0?answer:'Test alternative '+index+' '+i+' '+j,lat:40+j*.001,lng:-74}))};});return c;
}
const save=async(c,revision,intent='approve')=>(await db.query('select public.where7_save_content($1::jsonb,$2,$3::uuid,$4) as snapshot',[JSON.stringify(c),revision,admin,intent])).rows[0].snapshot;
try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(read('supabase/schema.sql').replace('create extension if not exists pgcrypto;',''));
 await db.exec(read('supabase/random_daily_rotation.sql'));
 const legacy=fixture(99);
 await db.query("insert into challenges(id,title,country_iso3,status,difficulty,stages) values($1,$2,$3,'published','standard',$4::jsonb)",[legacy.id,legacy.title,legacy.countryIso3,JSON.stringify(legacy.stages)]);
 const today=(await db.query("select (now() at time zone 'UTC')::date::text as day")).rows[0].day;
 await db.query("insert into daily_challenge_assignments(challenge_date,challenge_id) values($1::date,$2)",[today,legacy.id]);
 const legacySession={challengeId:legacy.id,mode:'daily',stage:0,guesses:0,score:0,hints:[],history:[],status:'playing',version:0,startedAt:new Date().toISOString(),endedAt:null};
 await db.query("insert into game_sessions(guest_key,challenge_id,mode,data) values($1::uuid,$2,'daily',$3::jsonb)",[guest,today+':'+legacy.id,JSON.stringify(legacySession)]);
 const migration=read('supabase/migrations/20261022010833_puzzle_quality.sql');
 await db.exec(migration);await db.exec(migration); // Reapplication must not alter frozen revisions.
 let frozen=(await db.query('select data from game_sessions')).rows[0].data.challengeSnapshot;
 assert.equal(frozen.id,legacy.id);assert.equal(frozen.revision,1);assert.equal(frozen.reviewStatus,'draft');
 assert.equal((await db.query('select reviews_required from content_settings')).rows[0].reviews_required,false);
 await assert.rejects(()=>db.query('select where7_activate_quality($1::uuid)',[admin]),/30 days/);
 const missing=fixture(0);missing.checklist.stages[3].facts=false;
 await assert.rejects(()=>save(missing,0),/sign-off/);
 const noProof=fixture(0);delete noProof.stages[3].place.relationshipSource;
 await assert.rejects(()=>save(noProof,0),/publication/);
 const content=fixture(0),first=await save(content,0);assert.equal(first.reviewStatus,'approved');assert.equal(first.revision,1);
 await assert.rejects(()=>save(content,0),/CONTENT_CONFLICT/);
 content.stages[0].clue='An edited synthetic clue for another revision.';
 const second=await save(content,1,'draft');assert.equal(second.revision,2);assert.equal(second.reviewStatus,'draft');
 assert.equal((await db.query('select snapshot from challenge_revisions where challenge_id=$1 and revision=1',[content.id])).rows[0].snapshot.stages[0].clue,first.stages[0].clue);
 await assert.rejects(()=>db.query('update challenge_revisions set review_status=\'approved\' where challenge_id=$1',[content.id]),/immutable/);
 const duplicate=fixture(1);duplicate.stages[6].answer=legacy.stages[6].answer; // unrelated country is allowed; actual duplicates below share country.
 const reserve=fixture(40);reserve.reserve=true;const spare=await save(reserve,0);
 const copies=fixture(41);copies.countryIso3=reserve.countryIso3;copies.stages[6].answer=reserve.stages[6].answer;copies.stages[6].choices[0].name=reserve.stages[6].answer;
 await assert.rejects(()=>save(copies,0),/destination/);
 const approved=[];for(let i=1;i<=31;i++)approved.push(await save(fixture(i),0));
 const entries=approved.slice(0,30).map((c,i)=>({day:new Date(Date.parse(today+'T00:00:00Z')+(i+1)*86400000).toISOString().slice(0,10),challengeId:c.id,revision:1}));
 await assert.rejects(()=>db.query('select where7_schedule_content($1::jsonb,$2::uuid)',[JSON.stringify([{...entries[0],challengeId:second.id,revision:2}]),admin]),/approved/);
 const invalidBatch=[entries[0],{...entries[1],challengeId:'missing',revision:1}];
 await assert.rejects(()=>db.query('select where7_schedule_content($1::jsonb,$2::uuid)',[JSON.stringify(invalidBatch),admin]),/approved/);
 assert.equal((await db.query('select count(*)::int as n from challenge_schedule')).rows[0].n,0);
 await db.query('select where7_schedule_content($1::jsonb,$2::uuid)',[JSON.stringify(entries),admin]);
 assert.equal((await db.query('select where7_activate_quality($1::uuid) as active',[admin])).rows[0].active,true);
 const assigned=await db.query('select where7_assign_daily_challenge($1::date) as id',[entries[0].day]);assert.equal(assigned.rows[0].id,entries[0].challengeId);
 const edited=fixture(1);edited.stages[0].clue='Another edit after scheduling, never changing the frozen assignment.';await save(edited,1,'draft');
 assert.equal((await db.query('select challenge_snapshot from daily_challenge_assignments where challenge_date=$1::date',[entries[0].day])).rows[0].challenge_snapshot.stages[0].clue,approved[0].stages[0].clue);
 await assert.rejects(()=>db.query('select where7_replace_daily($1::date,$2,$3,$4,$5,$6::uuid)',[today,'wrong-id',spare.id,1,'A synthetic replacement test reason.',admin]),/changed/);
 await db.query('select where7_replace_daily($1::date,$2,$3,$4,$5,$6::uuid)',[today,legacy.id,spare.id,1,'A synthetic replacement test reason.',admin]);
 assert.equal((await db.query('select challenge_id from daily_challenge_assignments where challenge_date=$1::date',[today])).rows[0].challenge_id,spare.id);
 frozen=(await db.query('select data from game_sessions')).rows[0].data.challengeSnapshot;assert.equal(frozen.id,legacy.id);
 const report=async(stage=0,revision=1,reporter=guest)=>db.query('select where7_report_clue($1::uuid,$2,$3,$4,$5,$6,$7) as id',[reporter,today+':'+legacy.id,'daily',revision,stage,'ambiguous','Synthetic clue report.']);
 const r=await report();assert.equal((await report()).rows[0].id,r.rows[0].id);
 await assert.rejects(()=>report(1),/reached/);await assert.rejects(()=>report(0,2),/reached/);
 await assert.rejects(()=>report(0,1,'00000000-0000-4000-8000-000000000099'),/reached/);
 // Exercise the distributed daily cap with distinct saved runs belonging to this test guest.
 for(let i=0;i<9;i++){
  const s={...legacySession,startedAt:new Date(Date.now()+1000*(i+1)).toISOString(),challengeSnapshot:frozen};
  await db.query('update game_sessions set data=$1::jsonb where guest_key=$2::uuid',[JSON.stringify(s),guest]);await report();
 }
 await db.query('update game_sessions set data=jsonb_set(data,\'{startedAt}\',to_jsonb($1::text)) where guest_key=$2::uuid',[new Date(Date.now()+60000).toISOString(),guest]);
 await assert.rejects(()=>report(),/limit/);
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  await assert.rejects(()=>db.query('select * from clue_reports'),/permission denied/);
  await assert.rejects(()=>db.query('select where7_activate_quality($1::uuid)',[admin]),/permission denied/);
  await db.exec('reset role');
 }
 console.log('Content DB verification passed: additive migration/backfill, immutable revisions, stale saves, explicit sign-off, atomic scheduling, 30-day activation, frozen assignments, emergency replacement, report idempotency/context/limits and anonymous permissions.');
}finally{await db.close();}
