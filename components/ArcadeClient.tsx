'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {Timer,Compass,Trophy,ArrowLeft,Play,Users,SkipForward,Copy,CheckCircle2,Shield,RotateCcw,ArrowRight,Clock3,MapPin} from 'lucide-react';
type Choice={id:string;name:string;lat:number;lng:number};
type Question={id:string;stage:number;label:string;clue:string;choices:Choice[]};
type Run={id:string;mode:'time'|'duel';index:number;total:number;score:number;hits:number;status:string;expiresAt:string;startedAt:string;question:Question|null};
type Duel={id:string;code:string;expired:boolean;owner:boolean;canJoin:boolean;players:{name:string;self:boolean;result:{score:number;status:string;hits:number}|null}[]};
type Payload={run?:Run;duels?:Duel[];recent?:{id:string;score:number;hits:number;status:string;started_at:string}[];signedIn?:boolean;error?:string;duel?:{id:string;code:string};joined?:boolean;roomId?:string;correct?:boolean;awarded?:number};
export default function ArcadeClient(){
 const [data,setData]=useState<Payload>({}),[run,setRun]=useState<Run|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[invite,setInvite]=useState(''),[remaining,setRemaining]=useState(180);
 const update=useCallback(async(id?:string)=>{
  const res=await fetch('/api/arcade'+(id?'?run='+encodeURIComponent(id):''),{cache:'no-store'});
  const value=await res.json() as Payload;
  if(!res.ok)throw Error(value.error||'Arcade is not available.');
  setData(value);if(value.run)setRun(value.run);
 },[]);
 useEffect(()=>{void update().catch(e=>setError(String(e)))},[update]);
 useEffect(()=>{if(!run||run.status!=='active')return;const tick=()=>setRemaining(Math.max(0,Math.ceil((Date.parse(run.expiresAt)-Date.now())/1000)));tick();const n=window.setInterval(tick,500);return()=>clearInterval(n)},[run?.id,run?.status,run?.expiresAt]);
 const act=async(action:string,other:Record<string,unknown>={})=>{
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{const res=await fetch('/api/arcade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...other})});const result=await res.json() as Payload;if(!res.ok)throw Error(result.error||'Arcade action failed.');
  if(result.run)setRun(result.run);
  if(result.duel){setInvite(result.duel.code);setNotice('Challenge created! Share the invitation code with a friend.')}
  else if(result.joined){setNotice('You joined the challenge. Select it below to play.')}
  else if(result.correct!==undefined){setNotice(result.correct?'Correct! +100 points':'Not this time. Next location!')}
  await update(result.run?.id);
  }catch(e){setError(e instanceof Error?e.message:'Arcade action failed.')}finally{setBusy(false)}
 };
 const finish=run&&(run.status!=='active'||remaining<=0||run.index>=run.total);
 const clock=String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');
 return <main className="arcade-page"><header className="exp-nav"><Link href="/"><Compass/> WHERE<span>7</span></Link><strong>EXPLORER ARCADE</strong><Link href="/explore"><ArrowLeft size={16}/> Practice Explorer</Link></header><div className="exp-wrap">
 <div className="arcade-head"><span>MORE WAYS TO EXPLORE</span><h1>Beat the clock. Challenge a friend.</h1><p>Fast geography rounds using real locations from the WHERE7 atlas. No daily lives, streaks or leaderboard XP are affected.</p></div>
 {error&&<div className="exp-error" role="alert">{error}<button onClick={()=>void update(run?.id).catch(e=>setError(String(e)))}>Retry</button></div>}
 {notice&&<div className="arcade-notice" role="status">{notice}</div>}
 {run&&!finish?<section className="arcade-playing"><div className="arcade-top"><span><Timer size={17}/> {run.mode==='duel'?'FRIEND DUEL':'TIME ATTACK'}</span><strong className={remaining<30?'arcade-urgent':''}>{clock}</strong><span><Trophy size={17}/> {run.score} points</span></div>
 <div className="arcade-meter"><span style={{width:(run.index/run.total*100)+'%'}}/></div>
 <div className="arcade-round"><span>ROUND {run.index+1} OF {run.total} · {run.question?.label.toUpperCase()}</span><h2>{run.question?.clue}</h2><p><MapPin size={16}/> Choose the correct location</p></div>
 <div className="arcade-answers">{run.question?.choices.map((choice,i)=><button key={choice.id} disabled={busy} onClick={()=>void act('answer',{runId:run.id,answer:choice.name})}><span>{String.fromCharCode(65+i)}</span>{choice.name}</button>)}</div>
 <button className="arcade-skip" disabled={busy} onClick={()=>void act('skip',{runId:run.id})}><SkipForward size={17}/> Skip this question</button>
 </section>:run&&finish?<section className="arcade-finish"><Trophy size={45}/><span>{run.mode==='duel'?'CHALLENGE RESULT':'TIME ATTACK COMPLETE'}</span><h2>{run.score.toLocaleString()} points</h2><p>{run.hits} correct answers across {run.index} questions. {run.mode==='duel'?"Your opponent's score will appear in the duel results after their run.":'Try to beat your own personal best.'}</p>
 {run.status==='active'&&remaining<=0&&<button disabled={busy} className="exp-next" onClick={()=>void act('skip',{runId:run.id})}>Finalize expired run</button>}
 <button className="exp-next" disabled={busy} onClick={()=>{setRun(null);void update()}}><RotateCcw size={16}/> Return to arcade</button></section>:<>
 <section className="arcade-grid"><div className="arcade-card"><div className="arcade-card-icon"><Timer size={32}/></div><h2>Time Attack</h2><p>15 rapid-fire geographical questions. Three minutes to identify as many places as possible. +100 points for every correct answer.</p><button disabled={busy} onClick={()=>void act('start')}><Play size={17}/> Start three-minute run</button></div>
 <div className="arcade-card"><div className="arcade-card-icon"><Users size={32}/></div><h2>Friend Challenges</h2><p>Create a private asynchronous duel. Both players receive the same questions and compete independently, with server-scored results.</p>
 {data.signedIn?<button disabled={busy} onClick={()=>void act('create_duel')}><Trophy size={17}/> Create a private challenge</button>:<Link href="/account"><Shield size={17}/> Sign in to challenge</Link>}
 </div></section>
 {invite&&<div className="arcade-invite"><b>YOUR INVITE CODE: {invite}</b><button onClick={()=>void navigator.clipboard.writeText(invite)}><Copy size={16}/> Copy</button></div>}
 {data.signedIn&&<section className="exp-panel"><h2>Join a friend's challenge</h2><p>Enter the 10-character code sent by another Explorer.</p><div className="arcade-join"><input value={invite} onChange={e=>setInvite(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,''))} maxLength={10} placeholder="Invitation code"/><button disabled={busy||invite.length!==10} onClick={()=>void act('join_duel',{code:invite})}>Join <ArrowRight size={16}/></button></div></section>}
 {data.duels?.length? <section className="exp-panel"><h2><Users size={20}/> Your private challenges</h2><div className="arcade-duels">{data.duels.map(d=><div key={d.id}><div><strong>{d.code}</strong><small>{d.players.map(p=>p.name+(p.result?' · '+p.result.score+' points':' · not played')).join(' vs ')}</small></div><button disabled={busy||d.expired} onClick={()=>void act('start_duel',{duelId:d.id})}>Play <Play size={15}/></button></div>)}</div></section>:null}
 {data.recent?.length?<section className="exp-panel"><h2><Clock3 size={19}/> Recent Time Attack runs</h2><div className="arcade-duels">{data.recent.map(r=><div key={r.id}><span>{new Date(r.started_at).toLocaleDateString('en-GB')}</span><strong>{r.score} points · {r.hits} correct</strong><small>{r.status}</small><button onClick={()=>void update(r.id).catch(e=>setError(String(e)))}>View run</button></div>)}</div></section>:null}
 </>}
 <p className="arcade-foot">Official daily scores remain separate. No arcade mode can grant mission XP or streak protection.</p></div></main>
}
