/** Isolated Next API → Supabase client → test REST adapter → PostgreSQL.
 * The adapter models the query forms used by this app; it is not a hosted Auth test.
 */
import {PGlite} from '@electric-sql/pglite';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url)),read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const db=new PGlite(),admin='00000000-0000-4000-8000-000000000001';
let app;const logs=[];
const tables=new Set(['challenges','game_sessions','results','daily_challenge_assignments','clue_reports']);
const identifier=value=>{if(!/^[a-z_][a-z_0-9]*$/.test(value))throw Error('Unexpected test identifier');return '"'+value+'"';};
const encode=value=>value&&typeof value==='object'?JSON.stringify(value):value;
const gateway=createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 try{
  const url=new URL(req.url,'http://localhost');let text='';for await(const chunk of req)text+=chunk;
  const body=text?JSON.parse(text):{};
  if(url.pathname.startsWith('/auth/')){res.writeHead(401);res.end('{"message":"No test auth session"}');return;}
  if(url.pathname.startsWith('/rest/v1/rpc/')){
   const name=url.pathname.split('/').at(-1),rpc={where7_assign_daily_challenge:['target_day'],where7_report_clue:['reporter','session_id','game_mode','content_revision','stage_index','report_category','report_notes']}[name];
   if(!rpc)throw Error('Unexpected test RPC');const values=rpc.map(key=>encode(body[key]));
   const result=await db.query('select public.'+identifier(name)+'('+values.map((_,i)=>'$'+(i+1)).join(',')+') as value',values);
   res.end(JSON.stringify(result.rows[0].value));return;
  }
  const table=url.pathname.split('/').at(-1);if(!tables.has(table))throw Error('Unexpected test table '+table);
  const values=[],where=[];
  for(const [column,filter] of url.searchParams){
   if(['select','limit','order','on_conflict'].includes(column))continue;
   const split=filter.indexOf('.'),op=filter.slice(0,split),value=filter.slice(split+1);
   if(!['eq','like'].includes(op))throw Error('Unexpected test filter '+op);
   values.push(value);where.push(identifier(column)+(op==='eq'?' = ':' like ')+'$'+values.length);
  }
  const clause=where.length?' where '+where.join(' and '):'';
  let result;
  if(req.method==='GET'){
   const select=(url.searchParams.get('select')||'*').split(',').map(v=>v==='*'?'*':identifier(v)).join(',');
   result=await db.query('select '+select+' from '+identifier(table)+clause+(url.searchParams.has('limit')?' limit '+Number(url.searchParams.get('limit')):''),values);
  }else if(req.method==='PATCH'){
   const assignments=Object.entries(body).map(([key,value])=>{values.push(encode(value));return identifier(key)+'=$'+values.length;});
   result=await db.query('update '+identifier(table)+' set '+assignments.join(',')+clause+' returning *',values);
  }else if(req.method==='POST'){
   const entries=Object.entries(body),columns=entries.map(([key])=>identifier(key)),params=entries.map(([,value])=>encode(value));
   const conflict=(url.searchParams.get('on_conflict')||'').split(',').filter(Boolean).map(identifier);
   let onConflict='';if(conflict.length){onConflict=' on conflict('+conflict.join(',')+') '+(String(req.headers.prefer).includes('ignore-duplicates')?'do nothing':'do update set '+columns.map(c=>c+'=excluded.'+c).join(','));}
   result=await db.query('insert into '+identifier(table)+'('+columns.join(',')+') values('+params.map((_,i)=>'$'+(i+1)).join(',')+')'+onConflict+' returning *',params);
  }else throw Error('Unexpected test method');
  if(String(req.headers.accept).includes('vnd.pgrst.object')){
   if(result.rows.length!==1){res.writeHead(406);res.end('{"code":"PGRST116","message":"Expected one row"}');return;}
   res.end(JSON.stringify(result.rows[0]));
  }else res.end(JSON.stringify(result.rows));
 }catch(error){logs.push('Test gateway: '+error.message);res.writeHead(400);res.end(JSON.stringify({message:error.message,code:error.code||'TEST_ADAPTER'}));}
});
const fixture=(id,reserve=false)=>{
 const c=structuredClone(JSON.parse(read('data/challenges.json'))[1]);c.id=id;c.title='Synthetic flow fixture';c.reserve=reserve;
 c.checklist={mobileTested:true,notes:'Test fixture only.',stages:Array.from({length:7},()=>Object.fromEntries(['facts','uniqueAnswer','source','alternatives','hierarchy','coordinates','aliases'].map(k=>[k,true])))};
 c.stages=c.stages.map((s,i)=>{const placeId=id+':'+i,answer='Fixture '+id+' '+i;return {...s,answer,clue:'A synthetic clue for '+answer+'.',source:'https://example.test/fact',place:{id:placeId,parentId:i===0?null:id+':'+(i-1),lat:40,lng:-74,source:'https://example.test/place',relationshipSource:'https://example.test/parent',relation:'within'},choices:i===0?[]:Array.from({length:5},(_,j)=>({id:j===0?placeId:id+':decoy:'+i+':'+j,name:j===0?answer:'Decoy '+i+' '+j,lat:40+j*.01,lng:-74}))};});return c;
};
const save=async(c,revision)=>(await db.query("select where7_save_content($1::jsonb,$2,$3::uuid,'approve') as value",[JSON.stringify(c),revision,admin])).rows[0].value;
const deadline=setTimeout(()=>{app?.kill();gateway.close();process.exit(1)},60000);
try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await db.exec(read('supabase/schema.sql').replace('create extension if not exists pgcrypto;',''));await db.exec(read('supabase/random_daily_rotation.sql'));await db.exec(read('supabase/migrations/20261022010833_puzzle_quality.sql'));
 const c=fixture('flow-original'),reserve=await save(fixture('flow-reserve',true),0);await save(c,0);
 await new Promise(resolve=>gateway.listen(3106,'127.0.0.1',resolve));
 app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3105'],{cwd:root,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3106',NEXT_PUBLIC_SUPABASE_ANON_KEY:'isolated-test-anon',SUPABASE_SERVICE_ROLE_KEY:'isolated-test-service'},stdio:['ignore','pipe','pipe']});
 app.stdout.on('data',d=>logs.push(d.toString()));app.stderr.on('data',d=>logs.push(d.toString()));
 const base='http://127.0.0.1:3105';for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 let cookie='';
 const get=async(query='')=>{const r=await fetch(base+'/api/game'+query,{headers:{cookie}});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d.game;};
 const post=async(g,action,extra={})=>{const r=await fetch(base+'/api/game',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({action,mode:g.mode,challengeId:g.challengeId,version:g.version,stage:g.stage,dailyDate:g.dailyDate,practiceKey:g.practiceKey,...extra})});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d.game;};
 const first=await get();assert.equal(first.demo,false);assert.equal(first.challengeId,c.id);assert.equal(first.contentRevision,1);
 c.stages[0].clue='A revised synthetic first clue.';await save(c,1);
 assert.equal((await get()).current.clue,first.current.clue);
 const progressed=await post(first,'guess',{answer:c.stages[0].answer});assert.equal(progressed.stage,1);assert.equal(progressed.contentRevision,1);
 const reportBody={challengeId:c.id,revision:1,mode:'daily',dailyDate:first.dailyDate,stage:0,category:'ambiguous',notes:'Synthetic test report.'};
 for(let i=0;i<2;i++){const r=await fetch(base+'/api/reports',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(reportBody)});assert.equal(r.status,200,await r.text());}
 assert.equal((await db.query('select count(*)::int n from clue_reports')).rows[0].n,1);
 const future=await fetch(base+'/api/reports',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({...reportBody,stage:6})});assert.equal(future.status,409);
 await db.query('select where7_replace_daily($1::date,$2,$3,1,$4,$5::uuid)',[first.dailyDate,c.id,reserve.id,'A synthetic replacement rehearsal.',admin]);
 assert.equal((await get()).challengeId,c.id);
 const priorCookie=cookie;cookie='';assert.equal((await get()).challengeId,reserve.id);cookie=priorCookie;
 const yesterday=new Date(Date.parse(first.dailyDate)-86400000).toISOString().slice(0,10);
 await db.query('insert into daily_challenge_assignments(challenge_date,challenge_id,challenge_snapshot) select $1::date,$2,snapshot from challenge_revisions where challenge_id=$2 and revision=1',[yesterday,c.id]);
 const archive=await get('?mode=practice&challenge=archive:'+yesterday);assert.equal(archive.contentRevision,1);assert.equal(archive.practiceKey,'archive:'+yesterday);
 const practice=await get('?mode=practice&challenge='+c.id);assert.equal(practice.contentRevision,2);assert.equal(practice.practiceKey,undefined);
 c.stages[0].clue='A third revision, separate from both saved practice runs.';await save(c,2);
 assert.equal((await get('?mode=practice&challenge='+c.id)).contentRevision,2);
 assert.equal((await post(archive,'restart')).contentRevision,1);
 assert.equal((await post(practice,'restart')).contentRevision,3);
 assert(!JSON.stringify(await get()).includes('challengeSnapshot'));
 console.log('Content API flow passed: real Next handlers and Supabase client preserve daily/practice/archive revisions, keep existing players on the original after replacement, give new players the reserve, and accept idempotent reached-clue reports without exposing snapshots. PostgreSQL is isolated; Auth/REST transport is a test adapter.');
} catch(error){console.error(error);console.error(logs.join('').slice(-3000));process.exitCode=1;}
finally{clearTimeout(deadline);app?.kill();await new Promise(resolve=>gateway.close(resolve));await db.close();}
