'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {Map,Settings2,Compass,CircleHelp,HelpCircle,Flame,Sparkles,Lightbulb,Flag,Share2,RotateCcw,Check,Lock,ChevronDown,Volume2,VolumeX,Info,ChevronUp,CheckCircle2,ExternalLink,ArrowRight,Trophy,Target,Clock,Menu,Play,X,BookOpen,Gift,Zap,Medal,TrendingUp} from 'lucide-react';
import type {PublicGame} from '@/lib/types';
import {xpFromScore} from '@/lib/ranks';
import {formatScore,shouldAnimate} from '@/lib/presentation';
import ProgressionClient from './ProgressionClient';
import FocusDialog from './FocusDialog';
import LocationChoices from './LocationChoices';
import {requestGame,GameRequestError} from '@/lib/game-client';
const MapCanvas=dynamic(()=>import('./MapCanvas'),{ssr:false,loading:()=> <div className="map-loading"><div className="loading-orb"/>Preparing your atlas…</div>});
const STAGES=['COUNTRY','STATE / REGION','CITY','AREA','DISTRICT','STREET','BUILDING'];
const fmt=(t:number)=>{let seconds=Math.floor(t/1000);return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`};
export default function Game(){
  const [game,setGame]=useState<PublicGame|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [displayName,setDisplayName]=useState(''),[nameSaving,setNameSaving]=useState(false),[nameStatus,setNameStatus]=useState('');
  const [mode,setMode]=useState<'daily'|'practice'>('daily'),[challenge,setChallenge]=useState('london');
  const [error,setError]=useState(''),[toast,setToast]=useState(''),[selected,setSelected]=useState<string|null>(null);
  const [feedback,setFeedback]=useState<'right'|'wrong'|null>(null),[feedbackText,setFeedbackText]=useState(''),[mobileOpen,setMobileOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false),[mobileNavOpen,setMobileNavOpen]=useState(false),[settingsReady,setSettingsReady]=useState(false);
  const [preferences,setPreferences]=useState({sound:false,haptics:false,reduceMotion:false});
  const [animatedScore,setAnimatedScore]=useState(0);
  const touchStartY=useRef<number|null>(null),ignoreGripClick=useRef(false);

  const [celebrate,setCelebrate]=useState(false);
  const timers=useRef<number[]>([]);
  const [elapsed,setElapsed]=useState(0),[showHow,setShowHow]=useState(false),[showOptions,setShowOptions]=useState(false);
  const [needsSync,setNeedsSync]=useState(false),[guidePrompt,setGuidePrompt]=useState(false),[reportOpen,setReportOpen]=useState(true);
  const [now,setNow]=useState(Date.now()),[resetLabel,setResetLabel]=useState('midnight UTC');
  const gameRef=useRef<PublicGame|null>(null);gameRef.current=game;
  const missionRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const id=requestAnimationFrame(()=>missionRef.current?.scrollTo({top:0}));
    return()=>cancelAnimationFrame(id);
  },[game?.stage,game?.challengeId,mobileOpen]);
  const blocked=loading||busy||needsSync;
  const pendingAction=useRef(false);
  const loadRequestId=useRef(0);
  const currentLoad=useRef<AbortController|null>(null);
  const prevLives=useRef(7),[breaking,setBreaking]=useState<number|null>(null);
  useEffect(()=>{
    try{
      const saved=window.localStorage.getItem('where7-preferences-v1');
      if(saved){const parsed=JSON.parse(saved) as Record<string,unknown>;
        setPreferences({sound:parsed.sound===true,haptics:parsed.haptics===true,reduceMotion:parsed.reduceMotion===true});
      } else if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        setPreferences(p=>({...p,reduceMotion:true}));
      }
    }catch{/* Storage is optional: the game must work without it. */}
    setSettingsReady(true);
  },[]);
  useEffect(()=>{
    if(!settingsReady)return;
    try{window.localStorage.setItem('where7-preferences-v1',JSON.stringify(preferences));}catch{}
  },[settingsReady,preferences]);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.key!=='Escape')return;
      setSelected(null);setSettingsOpen(false);setMobileNavOpen(false);setShowOptions(false);
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);
  useEffect(()=>()=>{timers.current.forEach(clearTimeout);timers.current=[];},[]);
  const motionAllowed=shouldAnimate(preferences.reduceMotion);
  const bump= (success:boolean)=>{
    if(!preferences.haptics)return;
    try{navigator.vibrate?.(success?[14,40,26]:[35]);}catch{}
  };
  const choose=(name:string)=>{
    if(!game||game.status!=='playing'||blocked)return;
    setSelected(name);setFeedback(null);
    if(preferences.haptics){try{navigator.vibrate?.(8);}catch{}}
  };
  const handleGripTouchStart=(e:React.TouchEvent<HTMLButtonElement>)=>{touchStartY.current=e.touches[0]?.clientY??null};
  const handleGripTouchEnd=(e:React.TouchEvent<HTMLButtonElement>)=>{
    const start=touchStartY.current;touchStartY.current=null;
    if(start===null)return;
    const difference=start-(e.changedTouches[0]?.clientY??start);
    if(Math.abs(difference)>36){setMobileOpen(difference>0);ignoreGripClick.current=true;window.setTimeout(()=>{ignoreGripClick.current=false},450);}
  };
  const sessionStart=game?.startedAt,sessionEnd=game?.endedAt;
  useEffect(()=>{
    if(!sessionStart)return;
    const update=()=>setElapsed(Math.max(0,(sessionEnd?Date.parse(sessionEnd):Date.now())-Date.parse(sessionStart)));
    update();if(sessionEnd)return;const id=setInterval(update,1000);return()=>clearInterval(id);
  },[sessionStart,sessionEnd]);
  useEffect(()=>{
    const tick=()=>setNow(Date.now());const timer=setInterval(tick,1000);
    return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    if(!game?.resetsAt)return;
    setResetLabel(new Date(game.resetsAt).toLocaleString(undefined,{weekday:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}));
  },[game?.resetsAt]);
  const dailyExpired=game?.mode==='daily'&&!!game.resetsAt&&now>=Date.parse(game.resetsAt);
  useEffect(()=>{
    const target=game?.score??0;
    if(!motionAllowed){setAnimatedScore(target);return;}
    let frame=0;
    const from=animatedScore;
    const delta=target-from;
    if(delta===0)return;
    const started=performance.now();
    const tick=(now:number)=>{
      const progress=Math.min(1,(now-started)/620);
      const eased=1-Math.pow(1-progress,3);
      setAnimatedScore(Math.round(from+delta*eased));
      if(progress<1)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
    // Start a new count-up only when the server's score changes.
  },[game?.score,motionAllowed]);
  const load=async(m:'daily'|'practice'=mode,id=challenge,preserve=false)=>{
    const requestId=++loadRequestId.current;
    currentLoad.current?.abort();
    const controller=new AbortController();currentLoad.current=controller;
    setLoading(true);if(!preserve)setGame(null);
    setError('');setSelected(null);setFeedback(null);
    try{
      const data=await requestGame(`/api/game?mode=${m}&challenge=${encodeURIComponent(id)}`,{signal:controller.signal});
      if(requestId!==loadRequestId.current)return false;
      if(data.game.mode!==m)throw new Error('The server returned the wrong expedition mode. Please reload.');
      setGame(data.game);prevLives.current=data.game.hearts;setNeedsSync(false);setReportOpen(true);
      return true;
    }catch(e){
      if(requestId!==loadRequestId.current||controller.signal.aborted)return false;
      setNeedsSync(true);setError('Unable to check your progress. Your last saved run is kept. Retry before making another guess.');
      return false;
    }finally{
      if(requestId===loadRequestId.current){setLoading(false);currentLoad.current=null;}
    }
  };
  useEffect(()=>{
    try {
      if(window.localStorage.getItem('where7-how-to-play-seen-v1')!=='yes')setGuidePrompt(true);
    } catch {setGuidePrompt(true); }
  },[]);
  const closeHow=()=>{
    try{window.localStorage.setItem('where7-how-to-play-seen-v1','yes')}catch{}
    setShowHow(false);setGuidePrompt(false);
  };
  useEffect(()=>{const params=new URLSearchParams(window.location.search);const initialMode=params.get('mode')==='practice'?'practice':'daily';const initialId=params.get('challenge')||'london';setMode(initialMode);setChallenge(initialId);void load(initialMode,initialId);return()=>{loadRequestId.current++;currentLoad.current?.abort();}},[]);
  useEffect(()=>{
    const check=()=>{
      const current=gameRef.current;
      if(document.hidden||pendingAction.current||currentLoad.current||!current)return;
      void load(current.mode,challenge,true);
    };
    window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
    return()=>{window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
  },[challenge]);
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(id)},[toast]);
  const playTone=(correct:boolean)=>{
    if(!preferences.sound)return;
    try{const Ctx=window.AudioContext;const ctx=new Ctx();const notes=correct?[440,554,660]:[270,200];notes.forEach((n,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=n;g.gain.setValueAtTime(0.00001,ctx.currentTime+i*0.09);g.gain.exponentialRampToValueAtTime(0.055,ctx.currentTime+i*0.09+0.012);g.gain.exponentialRampToValueAtTime(0.00001,ctx.currentTime+i*0.09+0.2);o.connect(g).connect(ctx.destination);o.start(ctx.currentTime+i*0.09);o.stop(ctx.currentTime+i*0.09+0.21)});setTimeout(()=>void ctx.close(),950)}catch{}
  };
  const action=async(kind:'guess'|'hint'|'giveup'|'restart',answer?:string)=>{
    if(!game||blocked||dailyExpired||pendingAction.current||(game.status!=='playing'&&kind!=='restart'))return;
    // Never issue a restart request for the official daily session. The server
    // must keep its existing anti-reset protection.
    if(kind==='restart'&&game.mode!=='practice')return;
    if(kind==='giveup'&&!confirm(game.mode==='daily'?'End this expedition? Your daily run cannot be restarted.':'End this practice expedition? You can restart it afterwards.'))return;
    if(kind==='guess'&&!answer)return;
    pendingAction.current=true;setBusy(true);setError('');
    currentLoad.current?.abort();const actionGeneration=++loadRequestId.current;
    try{
      const data=await requestGame('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:kind,mode:game.mode,challengeId:game.challengeId,stage:game.stage,version:game.version,dailyDate:game.dailyDate,answer})});
      if(actionGeneration!==loadRequestId.current)return;
      if(kind==='guess'){
        const right=Boolean(data.correct);setFeedback(right?'right':'wrong');setFeedbackText(right?`${answer} confirmed · ${data.game.hearts} chances left`:`Incorrect · 1 chance used · ${data.game.hearts} left`);playTone(right);bump(right);
        if(right&&motionAllowed){setCelebrate(true);timers.current.push(window.setTimeout(()=>setCelebrate(false),1100));}
        if(data.game.hearts<prevLives.current){setBreaking(prevLives.current-1);timers.current.push(window.setTimeout(()=>setBreaking(null),670))}
        prevLives.current=data.game.hearts;

      }
      if(kind==='hint')setToast('Field note opened · 125-point deduction if correct');
      if(kind==='restart'){prevLives.current=7;setToast('Practice expedition restarted');}
      setGame(data.game);setReportOpen(true);
      setSelected(null);if(kind==='guess')setMobileOpen(false);

    }catch(e){
      if(actionGeneration!==loadRequestId.current)return;
      setNeedsSync(true);
      const conflict=e instanceof GameRequestError&&e.code;
      setError(conflict?e.message:'The reply was interrupted. Your guess may have saved. Check your progress before trying again.');
      // Do not replay the POST: a lost response may already have spent a chance.
      setMobileOpen(true);
    }
    finally{setBusy(false);pendingAction.current=false}
  };
  const switchMode=(m:'daily'|'practice',id=challenge)=>{if(pendingAction.current)return;setMode(m);setChallenge(id);setShowOptions(false);setNameStatus('');setNameSaving(false);setElapsed(0);void load(m,id);window.history.replaceState(null,'',m==='daily'?'/':`/?mode=practice&challenge=${encodeURIComponent(id)}`)};
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
    if(!game||game.status==='playing')return;
    const cells=Array.from({length:7},(_,i)=>{
      const attempts=game.history.filter(v=>v.stage===i);
      return attempts.some(v=>v.correct)?attempts.length===1?'🟩':'🟨':'⬛';
    }).join('');
    const date=game.dailyDate||new Date(game.startedAt).toISOString().slice(0,10);
    const message=(game.mode==='daily'?'WHERE7 🌍 ':'WHERE7 Practice 🌍 ')+date+'\n'+cells+'\n'+game.stage+'/7 locations · '+game.guesses+'/7 chances used · '+game.score.toLocaleString()+' points\nPlay: https://www.where7.world';
    const recordShare=()=>{void requestGame('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'share',mode:game.mode,challengeId:game.challengeId,stage:game.stage,version:game.version,dailyDate:game.dailyDate})}).catch(()=>{});};
    try{
      if(navigator.share){await navigator.share({title:'WHERE7 Daily Geography',text:message,url:'https://www.where7.world'});setToast('Result shared');recordShare();return;}
      await navigator.clipboard.writeText(message);setToast('Spoiler-free result copied');recordShare();
    }catch(e){if((e as Error).name!=='AbortError')setToast('Share unavailable — try again.')}
  };
  const stage=game?.current;const finished=!!game&&game.status!=='playing';
  useEffect(()=>{
    if(!feedback)return;const id=setTimeout(()=>{setFeedback(null);setFeedbackText('');},2200);return()=>clearTimeout(id);
  },[feedback,feedbackText]);
  const toggleGrip=()=>{if(ignoreGripClick.current){ignoreGripClick.current=false;return}setMobileOpen(v=>!v)};
  const chosenStage=selected&&stage&&!finished&&!feedback&&!loading&&!needsSync&&!dailyExpired;
  const selectionDisabled=blocked||dailyExpired;

  return <main className={`app-shell ${preferences.reduceMotion?'reduce-motion':''}`}>
    <a className="skip-to-clue" href="#mission-details" onClick={()=>setMobileOpen(true)}>Skip to clue and location list</a>
    <header className="site-header">
      <a href="/" className="brand" aria-label="WHERE7 home"><div className="brand-icon"><Compass size={22}/></div><strong>WHERE<span>7</span></strong><span className="brand-separator"/><small>THE DAILY GEOGRAPHY GAME</small></a>
      <div className="season-chip">SEASON 01 <span className="live-dot"/></div>
      <nav className="header-actions" aria-label="Main menu">
        <span className="header-date"><Flame size={14}/> Daily expedition</span>
        <button type="button" className="sound-button" title="Toggle sound" onClick={()=>setPreferences(p=>({...p,sound:!p.sound}))} aria-label={preferences.sound?'Mute sounds':'Enable sounds'}>{preferences.sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button>
        <button type="button" className="sound-button settings-toggle" title="Game preferences" aria-expanded={settingsOpen} aria-controls="game-preferences" onClick={()=>{setSettingsOpen(v=>!v);setMobileNavOpen(false)}}><Settings2 size={19}/><span className="sr-only">Game preferences</span></button>
        <button type="button" className="header-link" onClick={()=>setShowHow(true)}><Info size={17}/><span>How to play</span></button>
        <Link className="header-link" href="/leaderboard" aria-label="Open daily leaderboard"><Trophy size={17}/><span>Leaderboard</span></Link>
        <button type="button" className="mobile-menu-toggle" aria-label={mobileNavOpen?"Close navigation":"More navigation"} aria-expanded={mobileNavOpen} aria-controls="mobile-navigation" onClick={()=>{setMobileNavOpen(v=>!v);setSettingsOpen(false)}}>{mobileNavOpen?<X size={20}/>:<Menu size={20}/>}</button>
      </nav>
      {mobileNavOpen&&<nav id="mobile-navigation" className="mobile-nav-panel" aria-label="Game navigation">
        <button type="button" onClick={()=>{setShowHow(true);setMobileNavOpen(false)}}><Info size={18}/> How to play</button>
        <Link href="/leaderboard"><Trophy size={18}/> Leaderboard</Link>
        <Link href="/account"><Target size={18}/> My account</Link>
        <Link href="/stats"><TrendingUp size={18}/> My statistics</Link>
        <Link href="/rewards"><Gift size={18}/> Missions & Rewards</Link>
        <Link href="/social"><Trophy size={18}/> Friends & leagues</Link>
        <Link href="/plus"><Sparkles size={18}/> Themes & Plus</Link>
        <Link href="/explore"><Map size={18}/> Practice Explorer</Link>
        <Link href="/arcade"><Clock size={18}/> Time Attack & Duels</Link>
        <Link href="/archive"><BookOpen size={18}/> Challenge archive</Link>
      </nav>}
      {settingsOpen&&<section id="game-preferences" className="game-settings-panel" aria-label="Game preferences">
        <div className="game-settings-heading"><b>EXPEDITION SETTINGS</b><button type="button" onClick={()=>setSettingsOpen(false)} aria-label="Close preferences"><X size={18}/></button></div>
        <label><span><Volume2 size={17}/> Sound effects</span><input type="checkbox" checked={preferences.sound} onChange={e=>setPreferences(p=>({...p,sound:e.target.checked}))}/></label>
        <label><span><Zap size={17}/> Haptic feedback</span><input type="checkbox" checked={preferences.haptics} onChange={e=>setPreferences(p=>({...p,haptics:e.target.checked}))}/></label>
        <label><span><Sparkles size={17}/> Reduce animations</span><input type="checkbox" checked={preferences.reduceMotion} onChange={e=>setPreferences(p=>({...p,reduceMotion:e.target.checked}))}/></label>
        <small>Saved on this device. Haptics work on supported browsers.</small>
      </section>}
    </header>
    <div className={`game-canvas ${celebrate?'stage-celebrate':''} ${mobileOpen?'sheet-expanded':'sheet-compact'}`}>
      {celebrate&&<div className="discovery-burst" aria-hidden="true">{Array.from({length:12},(_,i)=><span key={i} style={{'--ray':i} as React.CSSProperties}>✦</span>)}</div>}
      <MapCanvas key={`map-${game?.mode||mode}`} stage={stage||null} disabled={selectionDisabled||finished} selected={selected} reduceMotion={preferences.reduceMotion} onSelect={choose}/>
      {chosenStage&&<div className="map-confirm-card" role="group" aria-label="Confirm your map selection">
        <div className="map-confirm-marker"><Target size={19}/></div>
        <div className="map-confirm-text"><span>YOUR SELECTION · 1 CHANCE</span><strong title={selected||''}>{selected}</strong></div>
        <div className="map-confirm-buttons"><button type="button" className="confirm-clear" onClick={()=>setSelected(null)} aria-label="Cancel selected location"><X size={19}/></button><button type="button" className="confirm-submit" disabled={selectionDisabled} onClick={()=>void action('guess',selected||undefined)}><Check size={17}/> Confirm</button></div>
      </div>}
      {feedback&&<div className={`stage-feedback-banner ${feedback}`} role="status" aria-live="polite">{feedback==='right'?<CheckCircle2 size={22}/>:<HelpCircle size={22}/>}<span>{feedbackText}</span></div>}
      <aside className={`mission-panel ${mobileOpen?'':'minimised'}`} aria-live="off" aria-busy={loading||busy}>
        <button type="button" className="mobile-grip" aria-label={mobileOpen?'Collapse clue sheet':'Expand clue sheet'} aria-expanded={mobileOpen} aria-controls="mission-details" onClick={toggleGrip} onTouchStart={handleGripTouchStart} onTouchEnd={handleGripTouchEnd}><span className="grip-pill" aria-hidden="true"/><span className="mobile-grip-label">{stage?`STAGE ${stage.level+1} · ${stage.label.toUpperCase()}`:'EXPEDITION CLUES'}</span>{mobileOpen?<ChevronDown size={19}/>:<ChevronUp size={19}/>}</button>
        {!mobileOpen&&<div className="sheet-peek"><div><span className="peek-eyebrow"><CircleHelp size={13}/> {game?.hearts??7} chances left · {formatScore(animatedScore)} pts</span><strong>{error||stage?.clue|| (loading?'Preparing today’s clue…':finished?'Your expedition report is ready.':'Choose a destination to explore.')}</strong></div><button type="button" onClick={()=>setMobileOpen(true)}>{needsSync?'Recover run':'Read clue'} <ChevronUp size={16}/></button></div>}
        <div ref={missionRef} className="mission-inside" id="mission-details" tabIndex={-1}>
          <div className="eyebrow expedition-eyebrow"><span className="glow-diamond"/> {mode==='daily'?"TODAY'S EXPEDITION":"PRACTICE EXPEDITION"}<span className="score-value"><Sparkles size={17}/> {formatScore(animatedScore)} <small>PTS</small></span></div>
          <div className="stage-meta"><span>STEP {String(Math.min((game?.stage||0)+1,7)).padStart(2,'0')} / 07</span><span><Target size={13}/> DESTINATION UNKNOWN</span></div>
          <div className="progress-track" role="img" aria-label={`${game?.stage||0} of 7 locations discovered`}>{STAGES.map((v,i)=><div key={v} className={i<(game?.stage||0)?'done':i===(game?.stage||0)?'active':''}/>)}</div>
          <div className={`heart-container ${breaking!==null?'heart-loss':''}`}>
            <span className="heart-caption">CHANCES <small>· ONE PER GUESS</small></span>
            <div className="heart-row" aria-hidden="true">{Array.from({length:7},(_,i)=><span key={i} className={`heart-unit ${i<(game?.hearts??7)?'alive':'spent'} ${i===breaking?'breaking':''}`} title={`Chance ${i+1}`}>
              {i<(game?.hearts??7)?<CircleHelp size={20}/>:<HelpCircle size={20}/>}</span>)}</div>
            <strong className="heart-count" aria-label={`${game?.hearts??7} chances remaining out of 7`}>{game?.hearts??7} / 7</strong>
          </div>
          <div className="heart-helper">Every guess uses 1 chance — correct or incorrect.</div>

          {game?.mode==='daily'&&<div className="daily-reset-note">{dailyExpired?'A new daily expedition is ready.':`Next daily: ${resetLabel} (midnight UTC).`}{dailyExpired&&<button type="button" disabled={loading||busy} onClick={()=>void load('daily',challenge,true)}>Load new daily</button>}</div>}
          {(needsSync||error)&&<div className="game-recovery" role="alert"><p>{error||'Check your saved progress before continuing.'}</p><button type="button" disabled={loading||busy} onClick={()=>void load(mode,challenge,true)}>{loading?'Checking…':game?'Check saved progress':'Retry expedition'}</button></div>}
          {busy&&<p className="saving-status" role="status">Saving your choice… please wait.</p>}
          <div className="reward-strip" aria-label="Daily rewards"><div><Zap size={16}/><span>XP IN PLAY</span><b>+{xpFromScore(game?.score||0)}</b></div><div><Gift size={16}/><span>DAILY REWARD</span><b>{mode==='daily'?'1 run / day':'Practice'}</b></div></div>
          {loading?<div className="clue-loading"><div className="skeleton"/><div className="skeleton wide"/><div className="skeleton"/></div>:
            game&&game.status==='playing'&&stage?<>
              <div className="stage-ident"><span>STAGE {stage.level+1} OF 7 · {stage.label.toUpperCase()}</span></div>
              <h1 className="mission-heading" key={'heading'+stage.level}>Find the {stage.label==='State / Region'?'region':stage.label.toLowerCase()}.</h1>
              <section className="clue-card" key={'clue'+stage.level}>
                <div className="clue-label"><span>STATEMENT {stage.level+1}</span><span>FIELD NOTES ↗</span></div>
                <p>{stage.clue}</p>
                {stage.hint&&<div className="hint-content"><Lightbulb size={17}/> {stage.hint}</div>}
              </section>

              {guidePrompt&&<section className="first-expedition-guide"><b>Your first expedition?</b><p>Seven correct guesses reach the building. Every guess spends a chance.</p><button type="button" onClick={()=>setShowHow(true)}>See the field guide</button><button type="button" onClick={closeHow} aria-label="Dismiss first expedition guide">Got it</button></section>}
              <div className="select-helper">Select on the map or use the list below. Previewing a place is free.</div>
              <LocationChoices key={`${game.challengeId}:${stage.level}`} stage={stage} selected={selected} disabled={selectionDisabled} onSelect={choose}/>
              {chosenStage&&<div className="selected-inline"><Target size={15}/> Selected: <strong>{selected}</strong><div className="selected-actions"><button type="button" className="confirm-clear" onClick={()=>setSelected(null)}><X size={16}/> Change</button><button type="button" className="confirm-submit" disabled={selectionDisabled} onClick={()=>void action('guess',selected||undefined)}><Check size={16}/> Confirm guess</button></div></div>}
              <div className="mission-actions">
                <button className="primary-action" disabled={selectionDisabled||!!stage.hint} onClick={()=>void action('hint')}><Lightbulb size={17}/>{stage.hint?'Hint revealed':'Hint (−125 pts)'}</button>
                <button className="secondary-action" disabled={selectionDisabled} onClick={()=>void action('giveup')}><Flag size={16}/> Give up</button>
              </div>
            </>:game&&<div className="inline-result"><Trophy size={32}/><h2>{game.status==='won'?'Perfect discovery!':game.status==='lost'?'Journey complete':'Expedition ended'}</h2><p>{game.status==='won'?'Seven flawless choices. You reached the final destination.':'The destination remains a mystery. Try a practice expedition.'}</p><button onClick={()=>setReportOpen(true)} className="primary-action"><BookOpen size={17}/> Open expedition report</button></div>}

          <div className="mission-bottom">
            <div className="places-title"><span>⌁ PLACES DISCOVERED</span><span>WORLD ↗ DESTINATION</span></div>
            <div className="discovered-trail">{game?.path.length?<>{game.path.map((v,i)=><span key={i} className="path-pill">{v}<ArrowRight size={11}/></span>)}</>:<span>Your journey begins here</span>}</div>
            <div className="mission-footer">Seven guesses, one destination: every guess uses a chance. Only a perfect run reaches the final building.</div>
          </div>
        </div>
      </aside>
      <div className="map-stage-badge"><span>{String(Math.min((game?.stage||0)+1,7)).padStart(2,'0')}</span><div><b>{STAGES[Math.min(game?.stage||0,6)]}</b><small>{loading?'Checking progress…':game?.status==='playing'?'Map or location list':game?'Expedition finished':'Waiting for expedition'}</small></div></div>
      <div className="game-mode-bar"><button disabled={busy||loading} aria-expanded={showOptions} onClick={()=>setShowOptions(v=>!v)}><Map size={16}/>{mode==='daily'?'Daily mystery':challenge==='nyc'?'New York practice':'London practice'}<ChevronDown size={15}/></button>
        {showOptions&&<div className="mode-dropdown"><button onClick={()=>switchMode('daily')}><Compass size={15}/> Today's daily mystery</button><button onClick={()=>switchMode('practice','london')}>🇬🇧 Westminster practice</button><button onClick={()=>switchMode('practice','nyc')}>🇺🇸 Manhattan practice</button></div>}
      </div>
      <div className="map-status"><span className="ping"/>{!game?'CONNECTING':game.demo?'DEMO · LOCAL SERVER':'LIVE · VERIFIED SERVER'}<span>·</span><Clock size={12}/>{fmt(elapsed)}</div>
      {toast&&<div className={`toast-message ${feedback||''}`} role="status">{feedback==='right'?<Check size={17}/>:feedback==='wrong'?<HelpCircle size={17}/>:<Sparkles size={17}/>} {toast}</div>}
      {finished&&reportOpen&&!showHow&&<FocusDialog className="results-backdrop" labelledBy="results-title" onClose={()=>setReportOpen(false)}><div className="results-dialog"><button type="button" className="close-modal" aria-label="Close expedition report" onClick={()=>setReportOpen(false)}><X size={19}/></button>
        <div className="result-halo"><Trophy size={42}/></div>
        <div className="eyebrow">{game?.status==='won'?'EXPEDITION COMPLETED':'EXPEDITION REPORT'}</div>
        <h2 id="results-title">{game?.status==='won'?'An extraordinary journey.':game?.status==='lost'?'Not quite the final destination.':'The journey ended.'}</h2>
        <p>{game?.status==='won'?'Seven correct answers, seven chances used, one amazing discovery.':'One or more incorrect guesses kept the final building out of reach. There is always another journey.'}</p>
        <div className="xp-earned" role="status"><Zap size={20}/> <span>{game?.mode==='daily'?'DAILY XP EARNED':'PRACTICE XP ESTIMATE'}</span><strong>+{xpFromScore(game?.score||0).toLocaleString()} XP</strong></div>
        {game?.mode==='daily'&&<ProgressionClient compact/>}
        <div className="result-metrics"><div><strong>{game?.score.toLocaleString()}</strong><span>POINTS</span></div><div><strong>{game?.stage} / 7</strong><span>DISCOVERED</span></div><div><strong>{fmt(elapsed)}</strong><span>TIME</span></div></div>
        <div className="reward-milestones"><span><Medal size={15}/> {game?.status==='won'?'Perfect expedition!':'Every stage counts'}</span><span><TrendingUp size={15}/> <Link href="/rewards">Passport & streaks →</Link></span></div>
        <div className="result-stages">{STAGES.map((v,i)=><span title={v} key={i} className={i<(game?.stage||0)?'clear':'closed'}>{i<(game?.stage||0)?<Check size={16}/>:<Lock size={15}/>}</span>)}</div>
        <div className="results-path">{game?.path.join(' → ')||'No locations discovered yet'}</div>
        {!!game?.sources?.length&&<details className="result-sources"><summary><ExternalLink size={13}/> Review factual sources</summary>{game.sources.map(s=><a key={s.stage} href={s.url} rel="noreferrer noopener" target="_blank">Stage {s.stage+1}: {s.answer} ↗</a>)}</details>}
        {game?.mode==='daily'&&<div className="leaderboard-submit"><label htmlFor="public-name">JOIN TODAY’S LEADERBOARD</label><div><input id="public-name" maxLength={24} placeholder="Explorer name" value={displayName} onChange={e=>setDisplayName(e.target.value)}/><button disabled={dailyExpired||nameSaving||!displayName.trim()} onClick={()=>void submitLeaderboard()}><Trophy size={15}/> Submit</button></div>{nameStatus&&<small role="status">{nameStatus}</small>}</div>}
        <div className="result-buttons">{dailyExpired&&<button type="button" className="primary-action" disabled={loading} onClick={()=>void load('daily',challenge,true)}>Load today’s new expedition</button>}<button className="primary-action" onClick={()=>void share()}><Share2 size={17}/> Copy share card</button>
          <button className="secondary-action" onClick={()=>switchMode('practice',game?.challengeId||'london')}><Play size={16}/> Practice</button></div>
        {game?.mode==='practice'&&<button className="result-again" onClick={()=>void action('restart')}><RotateCcw size={15}/> Restart this practice puzzle</button>}
      </div></FocusDialog>}
      {showHow&&<FocusDialog className="modal-scrim" labelledBy="how-title" onClose={closeHow}><div className="how-modal"><button className="close-modal" aria-label="Close instructions" onClick={closeHow}><X size={19}/></button><div className="eyebrow"><BookOpen size={16}/> YOUR FIELD GUIDE</div><h2 id="how-title">Seven clues. One place.</h2><p>Begin with the entire world. Read each factual statement, tap the location on the interactive map, then confirm your choice before using a chance.</p><div className="rule-example"><b>For example</b><p>Correct country: 6 chances remain and the region unlocks. Incorrect country: 6 chances remain and you stay at the country.</p></div><div className="how-lines"><div><Compass/><span>Correct answers reveal more specific locations.</span></div><div><CircleHelp/><span>Every guess, right or wrong, uses one of seven chances.</span></div><div><Trophy/><span>Only seven correct answers unlock the final building.</span></div><div><Lightbulb/><span>Hints cost points, but not chances.</span></div></div><button className="primary-action" onClick={closeHow}>Back to expedition <ArrowRight size={17}/></button></div></FocusDialog>}
    </div>
  </main>
}
