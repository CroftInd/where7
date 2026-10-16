'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {Map,Settings2,Compass,Heart,HeartCrack,Flame,Sparkles,Lightbulb,Flag,Share2,RotateCcw,Check,Lock,ChevronDown,Volume2,VolumeX,Info,ExternalLink,ArrowRight,Trophy,Target,Clock,Menu,Play,X,BookOpen} from 'lucide-react';
import type {PublicGame} from '@/lib/types';
const MapCanvas=dynamic(()=>import('./MapCanvas'),{ssr:false,loading:()=> <div className="map-loading"><div className="loading-orb"/>Preparing your atlas…</div>});
const STAGES=['COUNTRY','STATE / REGION','CITY','AREA','DISTRICT','STREET','BUILDING'];
const fmt=(t:number)=>{let seconds=Math.floor(t/1000);return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`};
function spentByStage(game:PublicGame,i:number){return game.history.filter(v=>v.stage===i).length}
export default function Game(){
  const [game,setGame]=useState<PublicGame|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [displayName,setDisplayName]=useState(''),[nameSaving,setNameSaving]=useState(false),[nameStatus,setNameStatus]=useState('');
  const [mode,setMode]=useState<'daily'|'practice'>('daily'),[challenge,setChallenge]=useState('london');
  const [error,setError]=useState(''),[toast,setToast]=useState(''),[selected,setSelected]=useState<string|null>(null);
  const [feedback,setFeedback]=useState<'right'|'wrong'|null>(null),[mobileOpen,setMobileOpen]=useState(true),[sound,setSound]=useState(false);
  const [elapsed,setElapsed]=useState(0),[showHow,setShowHow]=useState(false),[showOptions,setShowOptions]=useState(false);
  const [countries,setCountries]=useState<string[]>([]),[countryQuery,setCountryQuery]=useState('');
  const pendingAction=useRef(false);
  const prevLives=useRef(7),[breaking,setBreaking]=useState<number|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const sessionStart=game?.startedAt;
  useEffect(()=>{if(!sessionStart)return;const update=()=>setElapsed(Math.max(0,Date.now()-new Date(sessionStart).getTime()));update();const id=setInterval(update,1000);return()=>clearInterval(id)},[sessionStart]);
  const load=async(m=mode,id=challenge)=>{
    setLoading(true);setError('');setSelected(null);setFeedback(null);
    try{const response=await fetch(`/api/game?mode=${m}&challenge=${encodeURIComponent(id)}`,{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load game');setGame(data.game);prevLives.current=data.game.hearts;}
    catch(e){setError(e instanceof Error?e.message:'Unable to load game');}
    finally{setLoading(false)}
  };
  useEffect(()=>{const params=new URLSearchParams(window.location.search);const initialMode=params.get('mode')==='practice'?'practice':'daily';const initialId=params.get('challenge')||'london';setMode(initialMode);setChallenge(initialId);void load(initialMode,initialId)},[]);
  useEffect(()=>{Promise.all(['/world-countries.geojson','/microstates.geojson'].map(url=>fetch(url).then(r=>r.json()))).then(data=>{
    const names=[...new Set(data.flatMap((f:{features:{properties:{name:string}}[]})=>f.features.map(v=>v.properties.name)))].sort((a,b)=>a.localeCompare(b));setCountries(names);
  }).catch(()=>{})},[]);
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(id)},[toast]);
  const playTone=(correct:boolean)=>{
    if(!sound)return;
    try{const Ctx=window.AudioContext;const ctx=new Ctx();const notes=correct?[440,554,660]:[270,200];notes.forEach((n,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=n;g.gain.setValueAtTime(0.00001,ctx.currentTime+i*0.09);g.gain.exponentialRampToValueAtTime(0.055,ctx.currentTime+i*0.09+0.012);g.gain.exponentialRampToValueAtTime(0.00001,ctx.currentTime+i*0.09+0.2);o.connect(g).connect(ctx.destination);o.start(ctx.currentTime+i*0.09);o.stop(ctx.currentTime+i*0.09+0.21)});setTimeout(()=>void ctx.close(),950)}catch{}
  };
  const action=async(kind:'guess'|'hint'|'giveup'|'restart',answer?:string)=>{
    if(!game||busy||pendingAction.current||(game.status!=='playing'&&kind!=='restart'))return;
    if(kind==='giveup'&&!confirm('End this expedition? Your daily run cannot be restarted.'))return;
    pendingAction.current=true;setBusy(true);setError('');
    if(kind==='guess')setSelected(answer||'');
    try{
      const response=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:kind,mode:game.mode,challengeId:game.challengeId,stage:game.stage,answer})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to submit');
      if(kind==='guess'){
        const right=Boolean(data.correct);setFeedback(right?'right':'wrong');playTone(right);
        if(data.game.hearts<prevLives.current){setBreaking(prevLives.current-1);setTimeout(()=>setBreaking(null),670)}
        prevLives.current=data.game.hearts;
        setToast(right?`✦ ${answer} — location confirmed`:`${answer} isn't correct · ${data.game.hearts} hearts left`);
      }
      if(kind==='hint')setToast('Field note opened · 125-point deduction if correct');
      if(kind==='restart'){prevLives.current=7;setToast('Practice expedition restarted');}
      setGame(data.game);setTimeout(()=>{setSelected(null);setFeedback(null)},850);
    }catch(e){setError(e instanceof Error?e.message:'Unable to submit');setSelected(null)}
    finally{setBusy(false);pendingAction.current=false}
  };
  const switchMode=(m:'daily'|'practice',id=challenge)=>{setMode(m);setChallenge(id);setShowOptions(false);void load(m,id)};
  const submitLeaderboard=async()=>{
    if(!displayName.trim())return;
    setNameSaving(true);setNameStatus('');
    try{const response=await fetch('/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:displayName})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not publish player name');
      setNameStatus('Your verified score is on today’s leaderboard.');
    }catch(e){setNameStatus(e instanceof Error?e.message:'Leaderboard is currently unavailable')}
    finally{setNameSaving(false)}
  };
  const share=async()=>{
    if(!game)return;
    const pieces=Array.from({length:7},(_,i)=>i<game.stage?spentByStage(game,i)===1?'🟩':'🟨':game.status==='playing'?'⬜':'🔒').join('');
    const str=`WHERE7 • The Daily Geography Mystery\n${pieces}\n${game.stage}/7 locations · ${game.guesses}/7 guesses · ${game.score.toLocaleString()} points\nCan you find the destination?`;
    try{await navigator.clipboard.writeText(str);setToast('Shareable result copied')}catch{setToast('Clipboard unavailable. Select and copy the results instead.')}
  };
  const stage=game?.current;const finished=!!game&&game.status!=='playing';
  return <main className="app-shell">
    <header className="site-header">
      <a href="/" className="brand" aria-label="WHERE7 home"><div className="brand-icon"><Compass size={22}/></div><strong>WHERE<span>7</span></strong><span className="brand-separator"/><small>THE DAILY GEOGRAPHY GAME</small></a>
      <div className="season-chip">SEASON 01 <span className="live-dot"/></div>
      <nav className="header-actions" aria-label="Main menu">
        <span className="header-date"><Flame size={14}/> Daily expedition</span>
        <button type="button" className="sound-button" title="Toggle sound" onClick={()=>setSound(v=>!v)} aria-label={sound?'Mute sounds':'Enable sounds'}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button>
        <button type="button" className="header-link" onClick={()=>setShowHow(true)}><Info size={17}/><span>How to play</span></button>
        <Link className="header-link" href="/leaderboard" aria-label="Open daily leaderboard"><Trophy size={17}/><span>Leaderboard</span></Link>
        <Link className="header-link" href="/stats" aria-label="Open explorer statistics"><Target size={17}/><span>My stats</span></Link>
        <Link className="header-link" href="/archive" aria-label="Open challenge archive"><BookOpen size={17}/><span>Archive</span></Link>
        <Link className="admin-link" href="/admin" aria-label="Open Challenge Studio"><Settings2 size={18}/><span>Studio</span></Link>
      </nav>
    </header>
    <div className="game-canvas">
      <MapCanvas stage={stage||null} disabled={loading||finished||busy} selected={selected} onSelect={name=>void action('guess',name)}/>
      <aside className={`mission-panel ${mobileOpen?'':'minimised'}`} aria-live="polite">
        <button className="mobile-grip" aria-label={mobileOpen?'Minimise clues':'Show clues'} onClick={()=>setMobileOpen(v=>!v)}><span/><ChevronDown size={18}/></button>
        <div className="mission-inside">
          <div className="eyebrow expedition-eyebrow"><span className="glow-diamond"/> {mode==='daily'?"TODAY'S EXPEDITION":"PRACTICE EXPEDITION"}<span className="score-value"><Sparkles size={17}/> {(game?.score||0).toLocaleString()} <small>PTS</small></span></div>
          <div className="stage-meta"><span>STEP {String(Math.min((game?.stage||0)+1,7)).padStart(2,'0')} / 07</span><span><Target size={13}/> DESTINATION UNKNOWN</span></div>
          <div className="progress-track" aria-label="Stage progress">{STAGES.map((v,i)=><div key={v} className={i<(game?.stage||0)?'done':i===(game?.stage||0)?'active':''}/>)}</div>
          <div className={`heart-container ${breaking!==null?'heart-loss':''}`}>
            <span className="heart-caption">LIVES <small>· ONE PER GUESS</small></span>
            <div className="heart-row">{Array.from({length:7},(_,i)=><span key={i} className={`heart-unit ${i<(game?.hearts??7)?'alive':'spent'} ${i===breaking?'breaking':''}`} title={`Life ${i+1}`}>
              {i<(game?.hearts??7)?<Heart fill="currentColor" size={20}/>:<HeartCrack size={20}/>}</span>)}</div>
            <strong className="heart-count">{game?.hearts??7} / 7</strong>
          </div>
          <div className="heart-helper">A flawless run is the only way to reach the final building.</div>
          {loading?<div className="clue-loading"><div className="skeleton"/><div className="skeleton wide"/><div className="skeleton"/></div>:
            game&&game.status==='playing'&&stage?<>
              <div className="stage-ident"><span>STAGE {stage.level+1} OF 7 · {stage.label.toUpperCase()}</span></div>
              <h1 className="mission-heading" key={'heading'+stage.level}>Find the {stage.label==='State / Region'?'region':stage.label.toLowerCase()}.</h1>
              <section className="clue-card" key={'clue'+stage.level}>
                <div className="clue-label"><span>STATEMENT {stage.level+1}</span><span>FIELD NOTES ↗</span></div>
                <p>{stage.clue}</p>
                {stage.hint&&<div className="hint-content"><Lightbulb size={17}/> {stage.hint}</div>}
              </section>

              <div className="select-helper">{stage.selection==='country'?'Choose a country. Hover to see its name.':stage.selection==='region'?'Select the correct state or region.':'Explore the map and choose the correct location.'}</div>
              <div className="mission-actions">
                <button className="primary-action" disabled={busy||!!stage.hint} onClick={()=>void action('hint')}><Lightbulb size={17}/>{stage.hint?'Hint revealed':'Hint (−125 pts)'}</button>
                <button className="secondary-action" disabled={busy} onClick={()=>void action('giveup')}><Flag size={16}/> Give up</button>
              </div>
              <details className="accessible-options"><summary>Need a list of selectable locations?</summary>
                {stage.selection==='country'?<><input className="country-search" placeholder="Search a country…" value={countryQuery} onChange={e=>setCountryQuery(e.target.value)} aria-label="Search country names"/><div className="options-list country-list">{countries.filter(v=>v.toLowerCase().includes(countryQuery.trim().toLowerCase())).slice(0,25).map(v=><button key={v} onClick={()=>void action('guess',v)} disabled={busy}>{v}</button>)}</div></>:
                <div className="options-list">{stage.choices.map(v=><button key={v.id} onClick={()=>void action('guess',v.name)} disabled={busy}>{v.name}</button>)}</div>}
              </details>
            </>:game&&<div className="inline-result"><Trophy size={32}/><h2>{game.status==='won'?'Perfect discovery!':game.status==='lost'?'Journey complete':'Expedition ended'}</h2><p>{game.status==='won'?'Seven flawless choices. You reached the final destination.':'The destination remains a mystery. Try a practice expedition.'}</p><button onClick={()=>void share()} className="primary-action"><Share2 size={17}/> Share result</button></div>}
          {error&&<div className="form-error" role="alert">{error}</div>}
          <div className="mission-bottom">
            <div className="places-title"><span>⌁ PLACES DISCOVERED</span><span>WORLD ↗ DESTINATION</span></div>
            <div className="discovered-trail">{game?.path.length?<>{game.path.map((v,i)=><span key={i} className="path-pill">{v}<ArrowRight size={11}/></span>)}</>:<span>Your journey begins here</span>}</div>
            <div className="mission-footer">Seven guesses, one destination: every answer costs a heart. Only a perfect run reaches the final building.</div>
          </div>
        </div>
      </aside>
      <div className="map-stage-badge"><span>{String(Math.min((game?.stage||0)+1,7)).padStart(2,'0')}</span><div><b>{STAGES[Math.min(game?.stage||0,6)]}</b><small>{game?.status==='playing'?'Select on the map':'Expedition finished'}</small></div></div>
      <div className="game-mode-bar"><button onClick={()=>setShowOptions(v=>!v)}><Map size={16}/>{mode==='daily'?'Daily mystery':challenge==='nyc'?'New York practice':'London practice'}<ChevronDown size={15}/></button>
        {showOptions&&<div className="mode-dropdown"><button onClick={()=>switchMode('daily')}><Compass size={15}/> Today's daily mystery</button><button onClick={()=>switchMode('practice','london')}>🇬🇧 Westminster practice</button><button onClick={()=>switchMode('practice','nyc')}>🇺🇸 Manhattan practice</button></div>}
      </div>
      <div className="map-status"><span className="ping"/>{game?.demo?'DEMO · LOCAL SERVER':'LIVE · VERIFIED SERVER'}<span>·</span><Clock size={12}/>{fmt(elapsed)}</div>
      {toast&&<div className={`toast-message ${feedback||''}`} role="status">{feedback==='right'?<Check size={17}/>:feedback==='wrong'?<HeartCrack size={17}/>:<Sparkles size={17}/>} {toast}</div>}
      {finished&&<div className="results-backdrop" role="dialog" aria-modal="true" aria-labelledby="results-title"><div className="results-dialog">
        <div className="result-halo"><Trophy size={42}/></div>
        <div className="eyebrow">{game?.status==='won'?'EXPEDITION COMPLETED':'EXPEDITION REPORT'}</div>
        <h2 id="results-title">{game?.status==='won'?'An extraordinary journey.':game?.status==='lost'?'Not quite the final destination.':'The journey ended.'}</h2>
        <p>{game?.status==='won'?'Seven correct answers, seven hearts used, one amazing discovery.':'One or more incorrect guesses kept the final building out of reach. There is always another journey.'}</p>
        <div className="result-metrics"><div><strong>{game?.score.toLocaleString()}</strong><span>POINTS</span></div><div><strong>{game?.stage} / 7</strong><span>DISCOVERED</span></div><div><strong>{fmt(elapsed)}</strong><span>TIME</span></div></div>
        <div className="result-stages">{STAGES.map((v,i)=><span title={v} key={i} className={i<(game?.stage||0)?'clear':'closed'}>{i<(game?.stage||0)?<Check size={16}/>:<Lock size={15}/>}</span>)}</div>
        <div className="results-path">{game?.path.join(' → ')||'No locations discovered yet'}</div>
        {!!game?.sources?.length&&<details className="result-sources"><summary><ExternalLink size={13}/> Review factual sources</summary>{game.sources.map(s=><a key={s.stage} href={s.url} rel="noreferrer noopener" target="_blank">Stage {s.stage+1}: {s.answer} ↗</a>)}</details>}
        {game?.mode==='daily'&&<div className="leaderboard-submit"><label htmlFor="public-name">JOIN TODAY’S LEADERBOARD</label><div><input id="public-name" maxLength={24} placeholder="Explorer name" value={displayName} onChange={e=>setDisplayName(e.target.value)}/><button disabled={nameSaving||!displayName.trim()} onClick={()=>void submitLeaderboard()}><Trophy size={15}/> Submit</button></div>{nameStatus&&<small role="status">{nameStatus}</small>}</div>}
        <div className="result-buttons"><button className="primary-action" onClick={()=>void share()}><Share2 size={17}/> Copy share card</button>
          <button className="secondary-action" onClick={()=>switchMode('practice',game?.challengeId||'london')}><Play size={16}/> Practice</button></div>
        {mode==='practice'&&<button className="result-again" onClick={()=>void action('restart')}><RotateCcw size={15}/> Restart this practice puzzle</button>}
      </div></div>}
      {showHow&&<div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="how-title"><div className="how-modal"><button className="close-modal" aria-label="Close instructions" onClick={()=>setShowHow(false)}><X size={19}/></button><div className="eyebrow"><BookOpen size={16}/> YOUR FIELD GUIDE</div><h2 id="how-title">Seven clues. One place.</h2><p>Begin with the entire world. Read each factual statement and select the correct location directly on the interactive map.</p><div className="how-lines"><div><Compass/><span>Correct answers reveal more specific locations.</span></div><div><Heart/><span>Every guess, right or wrong, uses one of seven hearts.</span></div><div><Trophy/><span>Only seven correct answers unlock the final building.</span></div><div><Lightbulb/><span>Hints cost points, but not hearts.</span></div></div><button className="primary-action" onClick={()=>setShowHow(false)}>Begin expedition <ArrowRight size={17}/></button></div></div>}
    </div>
  </main>
}
