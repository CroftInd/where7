'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Check,ChevronRight,Compass,Crown,Flame,Gift,Lock,ShieldCheck,Sparkles,Star,Trophy,Zap,CalendarDays,RefreshCw,MapPinned} from 'lucide-react';
import type {Progression,Mission,CalendarDay} from '@/lib/progression';

type Payload={progression:Progression;signedIn:boolean;gainedXp?:number;levelUp?:boolean;error?:string};
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const labelDay=(s:string)=>new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'short'});
const pct=(m:Mission)=>Math.max(0,Math.min(100,Math.round(m.progress/m.target*100)));

function Quest({mission,claim,busy,signedIn}: {mission:Mission;claim:(key:string)=>void;busy:boolean;signedIn:boolean}){
 return <div className={`quest-card ${mission.claimed?'quest-done':''} ${mission.earned&&!mission.claimed?'quest-ready':''}`}>
  <div className="quest-top"><span className="quest-symbol">{mission.claimed?<Check size={18}/>:mission.earned?<Gift size={19}/>:<Compass size={18}/>}</span><span className="quest-kicker">{mission.kind==='daily'?'DAILY MISSION':'WEEKLY QUEST'} {mission.shield&&<span className="quest-shield">· SHIELD</span>}</span><span className="quest-xp">+{mission.xp} XP</span></div>
  <h3>{mission.title}</h3><p>{mission.description}</p>
  <div className="quest-progress-label"><span>{mission.progress} / {mission.target}</span><span>{mission.claimed?'Collected':mission.earned?'Ready to claim':`${pct(mission)}% complete`}</span></div>
  <div className="quest-progress" role="progressbar" aria-valuemin={0} aria-valuemax={mission.target} aria-valuenow={mission.progress} aria-label={mission.title}><span style={{width:`${pct(mission)}%`}}/></div>
  {mission.shield&&<small className="quest-extra"><ShieldCheck size={13}/> Includes one streak shield (maximum two stored)</small>}
  {mission.claimed?<div className="quest-collected"><Check size={15}/> Reward collected</div>:mission.earned?<button type="button" className="quest-claim" disabled={busy||!signedIn} onClick={()=>claim(mission.key)}>{signedIn?'Collect reward':'Sign in to collect'} <ArrowRight size={15}/></button>:<div className="quest-pending"><Lock size={13}/> Keep exploring</div>}
 </div>
}

function Calendar({daysList}:{daysList:CalendarDay[]}){
 return <div className="calendar-card"><div className="calendar-heading"><CalendarDays size={19}/><div><h3>Expedition calendar</h3><p>Every day you show up counts.</p></div></div><div className="passport-calendar" role="grid" aria-label="Your last six weeks of daily expeditions">{days.map(d=><span key={d} className="calendar-weekday">{d}</span>)}
 {daysList.map(day=><div key={day.date} title={`${labelDay(day.date)} · ${day.status}`} className={`calendar-tile ${day.status}`} role="gridcell" aria-label={`${labelDay(day.date)}, ${day.status==='done'?'expedition completed':day.status==='shield'?'streak protected':day.status==='today'?'today':day.status==='future'?'upcoming':'no expedition'}`}>
  {day.status==='done'?<Check size={14}/>:day.status==='shield'?<ShieldCheck size={14}/>:<span>{Number(day.date.slice(-2))}</span>}
 </div>)}
 </div><div className="calendar-legend"><span><i className="calendar-dot done"/>Completed</span><span><i className="calendar-dot shield"/>Protected</span><span><i className="calendar-dot today"/>Today</span></div></div>
}

export default function ProgressionClient({compact=false}:{compact?:boolean}){
 const [payload,setPayload]=useState<Payload|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[levelUp,setLevelUp]=useState(false);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  const response=await fetch('/api/progression',{cache:'no-store',signal});const data=await response.json() as Payload;
  if(!response.ok)throw new Error(data.error||'Unable to load rewards.');
  setPayload(data);setError('');
 },[]);
 useEffect(()=>{const abort=new AbortController();void refresh(abort.signal).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Rewards unavailable')});return()=>abort.abort()},[refresh]);
 const act=async(action:'claim_all'|'claim'|'protect_yesterday',key?:string)=>{
  if(busy)return;setBusy(true);setNotice('');setLevelUp(false);
  try{const res=await fetch('/api/progression',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,key})});const data=await res.json() as Payload;
   if(!res.ok)throw new Error(data.error||'Reward could not be saved.');
   setPayload(data);setError('');setLevelUp(!!data.levelUp);
   if(action==='protect_yesterday')setNotice('Your streak is safe. Yesterday is protected.');
   else setNotice(`Collected +${data.gainedXp||0} XP!${data.levelUp?' You reached a new level!':''}`);
  }catch(e){setNotice(e instanceof Error?e.message:'Reward unavailable.')}finally{setBusy(false)}
 };
 if(error&&!payload)return <div className="rewards-loading"><p role="alert">{error}</p><button type="button" onClick={()=>void refresh().catch(()=>setError('Rewards still unavailable.'))}><RefreshCw size={15}/> Retry</button></div>;
 if(!payload)return <div className="rewards-loading" role="status"><span className="loading-orb"/> Charting your expedition rewards…</div>;
 const {progression:p,signedIn}=payload;
 const pending=[...p.daily,...p.weekly].filter(m=>m.earned&&!m.claimed);
 return <section className={`progression-ui ${compact?'rewards-compact':''}`} aria-label="WHERE7 progression and rewards">
  {levelUp&&<div className="levelup-flash" role="status"><Crown size={23}/><div><strong>LEVEL UP!</strong><span>Level {p.profile.level} · {p.profile.rank}</span></div><Sparkles size={22}/></div>}
  {notice&&<div className="reward-notice" role="status"><Sparkles size={17}/>{notice}</div>}
  {compact?<>
   <div className="results-reward-overview"><div><span className="reward-kicker">TODAY’S FIELD REWARDS</span><h3>{pending.length?`${pending.length} rewards ready`:'Your expedition rewards'}</h3><p>{p.dailyCompleted?`${p.todayStages} locations discovered · ${p.todayScore.toLocaleString()} points`:'Make your daily discovery to earn rewards.'}</p></div><div className="result-reward-xp"><Zap size={19}/> {p.availableXp} <small>XP ready</small></div></div>
   <div className="result-reward-checklist">{p.daily.map(m=><div key={m.key} className={m.claimed?'claimed':m.earned?'ready':''}><span>{m.claimed?<Check size={14}/>:m.earned?<Gift size={14}/>:<Lock size={14}/>}</span><b>{m.title}</b><small>{m.claimed?'Collected':m.earned?`+${m.xp} XP ready`:`${m.progress}/${m.target}`}</small></div>)}</div>
   {signedIn&&pending.length>0?<button type="button" className="reward-main-button" disabled={busy} onClick={()=>void act('claim_all')}><Gift size={18}/> {busy?'Collecting…':`Collect ${p.availableXp} XP`} <ArrowRight size={18}/></button>:!signedIn?<Link className="reward-main-button" href="/account"><Zap size={17}/> Sign in to collect expedition XP <ArrowRight size={17}/></Link>:<Link href="/rewards" className="reward-open-link">Open your Explorer Passport <ArrowRight size={16}/></Link>}
  </>:<>
   <div className="passport-hero"><div className="passport-orbit" aria-hidden="true"><Compass size={106}/></div><div className="passport-head"><span className="reward-kicker"><Sparkles size={14}/> EXPLORER PASSPORT · SEASON 01</span><span className="passport-flair"><Star size={14}/> {p.profile.flair}</span></div><div className="passport-main"><div className="passport-level"><small>LEVEL</small><strong>{p.profile.level}</strong></div><div className="passport-description"><h1>{p.profile.rank}</h1><p>Explore the world, collect field rewards, become a legendary cartographer.</p></div></div><div className="passport-xp-header"><b>{p.profile.xp.toLocaleString()} XP</b><span>{p.profile.xpToNext?p.profile.xpToNext.toLocaleString()+' to next level':'MAX LEVEL ACHIEVED'}</span></div><div className="passport-xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.profile.progressPct} aria-label="Level progress"><span style={{width:`${p.profile.progressPct}%`}}/></div><div className="passport-overview"><div><Flame size={17}/><strong>{p.streak.current}</strong><span>day streak</span></div><div><ShieldCheck size={17}/><strong>{p.streak.shields}</strong><span>shields left</span></div><div><Trophy size={17}/><strong>{p.achievements.filter(a=>a.earned).length}</strong><span>badges earned</span></div></div></div>
   {!signedIn&&<div className="rewards-signin"><Zap size={20}/><div><strong>Keep your progress forever.</strong><p>Sign in to collect mission XP, unlock cosmetic titles and save streak shields.</p></div><Link href="/account">Sign in <ArrowRight size={16}/></Link></div>}
   {p.streak.canProtectYesterday&&signedIn&&<div className="shield-alert"><ShieldCheck size={26}/><div><strong>Save your streak!</strong><p>You missed {labelDay(p.streak.yesterday)}. Use 1 of your {p.streak.shields} shields to preserve your run.</p></div><button disabled={busy} onClick={()=>void act('protect_yesterday')}>Protect yesterday</button></div>}
   <div className="rewards-section-title"><div><span className="reward-kicker">01 · TODAY’S OBJECTIVES</span><h2>Daily missions</h2><p>Reset every day at midnight UTC. Official daily games only.</p></div><span className="mission-count">{p.daily.filter(m=>m.claimed).length} / {p.daily.length} claimed</span></div>
   <div className="quest-grid">{p.daily.map(m=><Quest key={m.key} mission={m} busy={busy} signedIn={signedIn} claim={key=>void act('claim',key)}/>)}</div>
   <div className="rewards-section-title"><div><span className="reward-kicker">02 · THE LONG GAME</span><h2>Weekly quests</h2><p>Monday–Sunday · Reset Monday at midnight UTC.</p></div><span className="mission-count">{p.weekly.filter(m=>m.claimed).length} / {p.weekly.length} claimed</span></div>
   <div className="quest-grid">{p.weekly.map(m=><Quest key={m.key} mission={m} busy={busy} signedIn={signedIn} claim={key=>void act('claim',key)}/>)}</div>
   {signedIn&&pending.length>0&&<div className="reward-collect-row"><div><strong>{pending.length} available rewards</strong><span>{p.availableXp} bonus XP ready to collect</span></div><button type="button" disabled={busy} onClick={()=>void act('claim_all')}><Gift size={18}/> Collect all rewards <ArrowRight size={18}/></button></div>}
   <div className="rewards-extras-grid"><Calendar daysList={p.calendar}/><div className="shield-card"><div className="shield-emblem"><ShieldCheck size={34}/></div><span className="reward-kicker">STREAK PROTECTION</span><h3>A second chance to show up.</h3><p>Earn a shield by completing five official daily expeditions in one week. Store up to two. A shield can save yesterday’s missed day, but not two missed days in a row.</p><div className="shield-balance"><strong>{p.streak.shields} <small>/ 2</small></strong><span>SHIELDS AVAILABLE</span></div>{signedIn&&p.streak.canProtectYesterday?<button disabled={busy} onClick={()=>void act('protect_yesterday')}>Use a shield for yesterday <ArrowRight size={16}/></button>:<span className="shield-notice">{p.streak.shields?'No missed day needs protection.':'Complete a weekly quest to earn one.'}</span>}</div></div>
   <div className="rewards-section-title"><div><span className="reward-kicker">03 · COLLECT YOUR LEGACY</span><h2>Achievement collection</h2><p>Milestone badges and cosmetic passport titles earned through real journeys.</p></div><span className="mission-count">{p.achievements.filter(a=>a.earned).length} / {p.achievements.length} unlocked</span></div>
   <div className="achievement-grid-v2">{p.achievements.map(a=><div key={a.id} className={`badge-collectible ${a.earned?'unlocked':''} tier-${a.tier}`}><span className="badge-medallion">{a.earned?<Trophy size={23}/>:<Lock size={20}/>}</span><div><small>{a.tier.toUpperCase()} · {a.earned?'UNLOCKED':'LOCKED'}</small><strong>{a.title}</strong><p>{a.description}</p></div></div>)}</div>
   <div className="rewards-footer"><MapPinned size={18}/><p>Only completed official daily expeditions count toward these quests. Practice and archived runs cannot generate rewards.</p><Link href="/">Back to the map <ChevronRight size={16}/></Link></div>
  </>}
 </section>;
}
