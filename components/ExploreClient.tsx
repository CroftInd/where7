'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {Compass,ArrowLeft,Search,Globe2,CheckCircle2,Play,MapPinned,ArrowRight} from 'lucide-react';
type Item={id:string;title:string;countryIso3:string;continent:string|null;difficulty:'easy'|'standard'|'expert';completed:boolean};
type Payload={challenges:Item[];continents:string[];completed:number;total:number;error?:string};
export default function ExploreClient(){
 const [state,setState]=useState<Payload|null>(null),[error,setError]=useState(''),[term,setTerm]=useState(''),[continent,setContinent]=useState('All'),[difficulty,setDifficulty]=useState('All'),[status,setStatus]=useState('All'),[view,setView]=useState<'explorer'|'expedition'>('explorer'),[expedition,setExpedition]=useState<string[]>([]),[stop,setStop]=useState(0);
 useEffect(()=>{const controller=new AbortController();fetch('/api/explore',{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json() as Payload;if(!r.ok)throw Error(d.error||'Unable to load locations');setState(d)}).catch(e=>{if(!controller.signal.aborted)setError(String(e))});return()=>controller.abort()},[]);
 const filtered=useMemo(()=>state?.challenges.filter(c=>(continent==='All'||c.continent===continent)&&(difficulty==='All'||c.difficulty===difficulty)&&(status==='All'||(status==='Completed'?c.completed:!c.completed))&&((c.title+' '+c.countryIso3+' '+c.continent).toLowerCase().includes(term.toLowerCase())))||[],[state,continent,difficulty,status,term]);
 const selectExpedition=(place:string)=>{setContinent(place);setView('expedition');setStop(0);const pool=(state?.challenges||[]).filter(c=>c.continent===place&&!c.completed);const source=pool.length>=5?pool:(state?.challenges||[]).filter(c=>c.continent===place);setExpedition(source.slice(0,5).map(c=>c.id))};
 return <main className="exp-page"><header className="exp-nav"><Link href="/"><Compass/> WHERE<span>7</span></Link><strong>PRACTICE EXPLORER</strong><Link href="/"><ArrowLeft size={17}/> Back to game</Link></header><div className="exp-wrap">
  <div className="exp-hero"><span>EXPLORE WITHOUT PRESSURE</span><h1>The world is your classroom.</h1><p>Choose a destination, explore an entire continent, or test your speed. Practice doesn't affect daily streaks or competitive leagues.</p><Link href="/arcade" className="exp-accent">Time Attack & Duels <ArrowRight size={17}/></Link></div>
  {error&&<div className="exp-error" role="alert">{error}</div>}
  {!state?<p className="exp-empty">Loading your global atlas…</p>:<>
  <div className="exp-stats"><span><strong>{state.total}</strong> published destinations</span><span><strong>{state.completed}</strong> practiced</span><span><strong>{state.continents.length}</strong> continents</span></div>
  <div className="exp-tabs"><button className={view==='explorer'?'active':''} onClick={()=>setView('explorer')}><Search size={17}/> All locations</button><button className={view==='expedition'?'active':''} onClick={()=>setView('expedition')}><Globe2 size={17}/> Continental expeditions</button></div>
  {view==='explorer'?<section className="exp-panel"><div className="exp-heading"><h2><MapPinned size={21}/> Practice Explorer</h2><span>Every location is replayable</span></div>
   <div className="exp-filters"><label><Search size={16}/><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="Search destinations or countries"/></label><select aria-label="Choose continent" value={continent} onChange={e=>setContinent(e.target.value)}><option>All</option>{state.continents.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Choose difficulty" value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option>All</option><option value="easy">Easy</option><option value="standard">Standard</option><option value="expert">Expert</option></select><select aria-label="Completion status" value={status} onChange={e=>setStatus(e.target.value)}><option>All</option><option>Completed</option><option>Not started</option></select></div>
   <p className="exp-count">{filtered.length} destinations matching your filters</p>
   <div className="exp-card-grid">{filtered.map(c=><article key={c.id} className="exp-card"><div className="exp-card-symbol">{c.completed?<CheckCircle2 size={20}/>:<MapPinned size={20}/>}</div><div><small>{c.continent} · {c.countryIso3} · {c.difficulty}</small><h3>{c.title}</h3></div><Link href={'/?mode=practice&challenge='+encodeURIComponent(c.id)}><Play size={15}/> {c.completed?'Replay':'Explore'}</Link></article>)}</div>
   {!filtered.length&&<p className="exp-empty">No destinations match those filters.</p>}
   </section>:<section className="exp-panel"><div className="exp-heading"><h2><Globe2 size={21}/> Continental expeditions</h2><span>Five destinations per itinerary</span></div>
   <p>Pick a continent to create a five-stop itinerary using the published challenge library. Play each stop individually with full map controls.</p>
   <div className="exp-continent-grid">{state.continents.map(c=><button key={c} className={continent===c?'active':''} onClick={()=>selectExpedition(c)}><Globe2 size={21}/><strong>{c}</strong><small>{state.challenges.filter(x=>x.continent===c).length} locations</small></button>)}</div>
   {expedition.length>0&&<div className="exp-journey"><h3>{continent} · Your five-stop itinerary</h3><div className="exp-itinerary">{expedition.map((id,i)=>{const c=state.challenges.find(v=>v.id===id)!;return <div key={id} className={i===stop?'current':''}><span>{i+1}</span><div><b>{c.title}</b><small>{c.countryIso3} · {c.difficulty}</small></div><Link href={'/?mode=practice&challenge='+encodeURIComponent(c.id)}>Play <ArrowRight size={14}/></Link></div>})}</div><button className="exp-next" onClick={()=>setStop(i=>(i+1)%expedition.length)}>Next suggested stop <ArrowRight size={15}/></button></div>}
  </section>}
  </>}
  </div></main>
}
