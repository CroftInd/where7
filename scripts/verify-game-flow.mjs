import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3101'],{cwd,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_ANON_KEY:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:['ignore','pipe','pipe']});
const deadline=setTimeout(()=>{server.kill();console.error('Flow verification timed out.');process.exit(1)},60000);
const logs=[];server.stdout.on('data',d=>logs.push(d.toString()));server.stderr.on('data',d=>logs.push(d.toString()));
const base='http://127.0.0.1:3101';
async function wait(){for(let i=0;i<40;i++){try{if((await fetch(base)).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('server failed: '+logs.join(''));}
async function run(){
 await wait();let cookie='';
 const get=async(mode='practice',id='london')=>{
  const r=await fetch(`${base}/api/game?mode=${mode}&challenge=${id}`,{headers:{cookie}});
  if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
  assert.equal(r.status,200);return (await r.json()).game;
 };
 const post=async(s,action,extra={})=>{const r=await fetch(base+'/api/game',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({action,mode:s.mode,challengeId:s.challengeId,stage:s.stage,version:s.version,dailyDate:s.dailyDate,...extra})});return {status:r.status,body:await r.json()};};
 let s=await get();
 const duplicates=await Promise.all([post(s,'guess',{answer:'Canada'}),post(s,'guess',{answer:'Canada'})]);
 assert.deepEqual(duplicates.map(r=>r.status).sort(),[200,409]);
 let saved=await get();assert.equal(saved.guesses,1);assert.equal(saved.hearts,6);
 assert.equal((await post(s,'guess',{answer:'Canada'})).status,409);
 assert.equal((await get()).guesses,1);
 const old=saved;const hint=await post(saved,'hint');assert.equal(hint.status,200);saved=hint.body.game;
 assert.equal(saved.guesses,1);assert.equal((await post(old,'guess',{answer:'United Kingdom'})).status,409);
 const seeds=JSON.parse(fs.readFileSync(cwd+'/data/challenges.json','utf8'));
 const challenge=seeds.find(c=>c.id==='london');
 const restarted=await post(saved,'restart');assert.equal(restarted.status,200);s=restarted.body.game;
 assert(s.version>saved.version);assert.equal(s.guesses,0);
 assert.equal((await post(saved,'guess',{answer:'Canada'})).status,409);
 for(let i=0;i<7;i++){const result=await post(s,'guess',{answer:challenge.stages[i].answer});assert.equal(result.status,200);s=result.body.game;assert.equal(s.guesses,i+1);assert.equal(s.hearts,6-i);}
 assert.equal(s.status,'won');assert.equal(s.stage,7);assert.equal((await get()).status,'won');
 const report=await post(s,'share');assert.equal(report.status,200);assert.equal(report.body.game.version,s.version);
 const daily=await get('daily');assert.match(daily.dailyDate,/^\d{4}-\d{2}-\d{2}$/);assert(daily.resetsAt);
 assert.equal((await post(daily,'guess',{answer:'Canada',dailyDate:'2026-01-01'})).status,409);
 assert.equal((await get('daily')).guesses,0);
 assert.equal((await post(daily,'restart')).status,400);
 const noVersion=await post(daily,'guess',{answer:'Canada',version:undefined});assert.equal(noVersion.status,409);
 await new Promise(r=>setTimeout(r,100));
 const events=logs.join('').split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
 assert(events.some(e=>e.event==='game_completed'));assert(events.some(e=>e.event==='guess_rejected'));assert(events.some(e=>e.event==='share_action'));
 assert(!JSON.stringify(events).includes('Canada'));
 console.log('API integration passed: concurrent duplicates, lost-response replay, hint conflict, restart conflict, perfect run, reload, share event, daily date and restart guards.');

}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{clearTimeout(deadline);server.kill();});
