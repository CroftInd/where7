'use client';
import {useEffect,useState} from 'react';
import {createBrowserClient} from '@supabase/ssr';
import Link from 'next/link';
import {ArrowLeft,Plus,Save,LogOut,Database,Layers,CheckCircle2} from 'lucide-react';
import type {Challenge} from '@/lib/types';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const auth=url&&key?createBrowserClient(url,key):null;
const names=['Country','State / Region','City','Area','District','Street','Building'];
type Place={id:string;name:string;level:number;parent_id:string|null;clue:string;hint:string;source:string;lat:number;lng:number;iso3:string|null;published:boolean};
type PlaceDraft=Omit<Place,'id'> & {id?:string};
const fresh=(level=0):PlaceDraft=>({name:'',level,parent_id:null,clue:'',hint:'',source:'https://www.openstreetmap.org/',lat:0,lng:0,iso3:null,published:true});
export default function Studio(){
 const [user,setUser]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[places,setPlaces]=useState<Place[]>([]),[challenges,setChallenges]=useState<Challenge[]>([]);
 const [tab,setTab]=useState<'places'|'legacy'>('places'),[place,setPlace]=useState<PlaceDraft>(fresh()),[challenge,setChallenge]=useState<Challenge|null>(null);
 const [allowed,setAllowed]=useState(false),[checking,setChecking]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const refresh=async()=>{
  const [p,c]=await Promise.all([fetch('/api/admin/places',{cache:'no-store'}),fetch('/api/admin/challenges',{cache:'no-store'})]);
  const [pd,cd]=await Promise.all([p.json(),c.json()]);
  if(!p.ok)throw new Error(pd.error||'Could not load geography');if(!c.ok)throw new Error(cd.error||'Could not load published challenges');
  setPlaces(pd.places||[]);setChallenges(cd.challenges||[]);
 };
 useEffect(()=>{if(!auth)return;void auth.auth.getUser().then(({data})=>setUser(data.user?.email||''));const {data:{subscription}}=auth.auth.onAuthStateChange((_e,s)=>setUser(s?.user.email||''));return()=>subscription.unsubscribe()},[]);
 useEffect(()=>{if(!user){setAllowed(false);setChallenges([]);setPlaces([]);return;}setChecking(true);setAllowed(false);
  fetch('/api/admin/challenges',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Administrator access required');setAllowed(true);await refresh();}).catch(e=>setError(e.message)).finally(()=>setChecking(false));
 },[user]);
 const login=async(e:React.FormEvent)=>{e.preventDefault();if(!auth)return;setBusy(true);setError('');const {error}=await auth.auth.signInWithPassword({email,password});if(error)setError(error.message);setPassword('');setBusy(false)};
 const savePlace=async()=>{setBusy(true);setError('');setSuccess('');try{
  const res=await fetch('/api/admin/places',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(place)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not save place');
  setSuccess('Geography entry saved. Add the next stage beneath it to create a complete path.');setPlace(fresh(place.level));await refresh();
 }catch(e){setError(e instanceof Error?e.message:'Save failed')}finally{setBusy(false)}};
 const saveChallenge=async()=>{if(!challenge)return;setBusy(true);setError('');setSuccess('');try{
  const res=await fetch('/api/admin/challenges',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(challenge)});const data=await res.json();if(!res.ok)throw new Error((data.details||[]).join('; ')||data.error||'Save failed');
  setSuccess('Existing published challenge updated.');await refresh();
 }catch(e){setError(e instanceof Error?e.message:'Save failed')}finally{setBusy(false)}};
 const patchStage=(index:number,key:'answer'|'clue'|'hint'|'source',value:string)=>setChallenge(c=>c?{...c,stages:c.stages.map((s,i)=>i===index?{...s,[key]:value}:s)}:null);
 const patchPlace=(patch:Partial<PlaceDraft>)=>setPlace(p=>({...p,...patch}));
 const parentOptions=places.filter(p=>p.level===place.level-1);
 const countryLabels:Record<string,string>={GBR:'United Kingdom',USA:'United States',FRA:'France',ITA:'Italy',ESP:'Spain',DEU:'Germany',JPN:'Japan',AUS:'Australia',IND:'India',BRA:'Brazil',ARE:'United Arab Emirates'};
 const grouped=Object.entries(challenges.reduce<Record<string,Challenge[]>>((acc,c)=>{const iso=c.countryIso3||'OTHER';(acc[iso]??=[]).push(c);return acc;},{})).sort(([a],[b])=>(countryLabels[a]||a).localeCompare(countryLabels[b]||b));
 return <main className="studio-page"><header className="studio-header"><div className="heading"><Database size={28}/><div><h1>WHERE7 / Challenge manager</h1><p>Reusable locations, simple clues, and published puzzle editing.</p></div></div><Link href="/"><ArrowLeft size={16}/> Back to game</Link></header>
 <div className="leaderboard-content" style={{maxWidth:1120}}>
 {!auth?<p className="studio-error">Supabase is not configured.</p>:!user?<form className="studio-panel" onSubmit={login} style={{padding:24,display:'grid',gap:14,maxWidth:420}}><h2>Administrator sign in</h2><input required type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/><button className="primary-action" disabled={busy}>Sign in</button></form>:checking?<p>Checking administrator permissions…</p>:!allowed?<div className="studio-error">Access denied. Only the configured administrator account can manage challenges. <Link href="/account">Switch account</Link></div>:<>
 <div className="studio-toolbar" style={{marginBottom:20,display:'flex',gap:12,flexWrap:'wrap'}}><button onClick={()=>setTab('places')}><Plus size={16}/> Geography library</button><button onClick={()=>setTab('legacy')}><Layers size={16}/> Published challenges ({challenges.filter(c=>c.status==='published').length})</button><button onClick={()=>void refresh().catch(e=>setError(e.message))}>Refresh</button><button onClick={()=>void auth?.auth.signOut()}><LogOut size={16}/> Sign out</button></div>
 {tab==='places'?<div style={{display:'grid',gridTemplateColumns:'minmax(240px,1fr) minmax(280px,1.4fr)',gap:20}}>
 <section className="studio-panel" style={{padding:20}}><h2>Saved locations ({places.length})</h2><p>Select an existing place to edit, or create a new one.</p><div style={{maxHeight:640,overflowY:'auto',display:'grid',gap:6}}>{places.map(p=><button key={p.id} className="secondary-action" style={{justifyContent:'flex-start',textAlign:'left'}} onClick={()=>setPlace({...p})}><small>{names[p.level]} · </small>{p.name}{!p.published?' (draft)':''}</button>)}</div></section>
 <section className="studio-panel" style={{padding:20,display:'grid',gap:13}}><h2>{place.id?'Edit location':'Add location'}</h2><p>Build a path: country → region → city → area → district → street → building. Each location is reusable in future daily challenges.</p>
 <label>Stage<select value={place.level} onChange={e=>setPlace(fresh(Number(e.target.value)))}>{names.map((n,i)=><option value={i} key={n}>{i+1}. {n}</option>)}</select></label>
 {place.level>0&&<label>Inside (parent location)<select value={place.parent_id||''} onChange={e=>patchPlace({parent_id:e.target.value})}><option value="">Select parent…</option>{parentOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
 <label>Correct location name<input value={place.name} onChange={e=>patchPlace({name:e.target.value})} placeholder={place.level===0?'United Kingdom':'England, London, Westminster…'}/></label>
 {place.level===0&&<label>ISO 3-letter country code<input maxLength={3} value={place.iso3||''} onChange={e=>patchPlace({iso3:e.target.value.toUpperCase()})} placeholder="GBR"/></label>}
 <label>Player-facing clue (do not reveal the answer)<textarea rows={3} value={place.clue} onChange={e=>patchPlace({clue:e.target.value})} placeholder="A country made up of four constituent nations…"/></label>
 <label>Optional hint<textarea rows={2} value={place.hint} onChange={e=>patchPlace({hint:e.target.value})}/></label>
 <label>Evidence/source URL<input type="url" value={place.source} onChange={e=>patchPlace({source:e.target.value})}/></label>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><label>Latitude<input type="number" step="any" value={place.lat} onChange={e=>patchPlace({lat:Number(e.target.value)})}/></label><label>Longitude<input type="number" step="any" value={place.lng} onChange={e=>patchPlace({lng:Number(e.target.value)})}/></label></div>
 <label><input type="checkbox" checked={place.published} onChange={e=>patchPlace({published:e.target.checked})}/> Published / available for future paths</label>
 <button className="primary-action" disabled={busy} onClick={()=>void savePlace()}><Save size={16}/> Save location</button><button className="secondary-action" onClick={()=>setPlace(fresh(place.level))}>New location</button></section></div>:
 <div style={{display:'grid',gridTemplateColumns:'minmax(230px,1fr) minmax(300px,1.6fr)',gap:20}}><section className="studio-panel" style={{padding:20}}><h2>Existing challenges</h2><p>Published challenges appear immediately, even before being selected for a day.</p><div style={{display:'grid',gap:12,maxHeight:650,overflowY:'auto'}}>{grouped.map(([iso,group])=><div key={iso}><h3 style={{margin:'10px 0 6px'}}>{countryLabels[iso]||iso} ({group.filter(c=>c.status==='published').length} published)</h3><div style={{display:'grid',gap:6}}>{group.sort((a,b)=>Number(b.status==='published')-Number(a.status==='published')||a.title.localeCompare(b.title)).map(c=><button className="secondary-action" key={c.id} style={{textAlign:'left',justifyContent:'flex-start'}} onClick={()=>setChallenge(structuredClone(c))}>{c.title} · {c.status}</button>)}</div></div>)}{!challenges.length&&<p>No database challenges found. Confirm you imported the published challenges into this Supabase project.</p>}</div></section>
 <section className="studio-panel" style={{padding:20}}>{challenge?<><h2>Edit: {challenge.title}</h2><label>Title<input value={challenge.title} onChange={e=>setChallenge(c=>c?{...c,title:e.target.value}:c)}/></label><label>Status<select value={challenge.status} onChange={e=>setChallenge(c=>c?{...c,status:e.target.value as 'draft'|'published'}:c)}><option value="draft">Draft</option><option value="published">Published</option></select></label>
 {challenge.stages.map((s,i)=><div key={i} style={{padding:'12px 0',borderBottom:'1px solid #526274'}}><h3>{i+1}. {names[i]}</h3><label>Answer<input value={s.answer} onChange={e=>patchStage(i,'answer',e.target.value)}/></label><label>Clue<textarea rows={2} value={s.clue} onChange={e=>patchStage(i,'clue',e.target.value)}/></label><label>Hint<input value={s.hint} onChange={e=>patchStage(i,'hint',e.target.value)}/></label><label>Source<input value={s.source} onChange={e=>patchStage(i,'source',e.target.value)}/></label>
 {i>0&&<label>Map choices (Name | Latitude | Longitude, one per line)<textarea key={`${challenge.id}-${i}`} rows={3} defaultValue={s.choices.map(v=>`${v.name} | ${v.lat} | ${v.lng}`).join('\n')} onBlur={e=>{
   const lines=e.target.value.split('\n').map(x=>x.trim()).filter(Boolean);
   const parsed=lines.map((line,j)=>{const [name,latitude,longitude]=line.split('|').map(x=>x.trim());return {id:`choice-${j}`,name,lat:Number(latitude),lng:Number(longitude)};});
   if(parsed.length<3||parsed.some(x=>!x.name||!Number.isFinite(x.lat)||!Number.isFinite(x.lng))){setError(`Stage ${i+1}: add at least three valid choices`);return;}
   setChallenge(c=>c?{...c,stages:c.stages.map((st,j)=>j===i?{...st,choices:parsed}:st)}:null);
 }}/></label>}</div>)}
 <p>If you change a correct answer, also update its map choices so the new answer is selectable. Changes to a challenge already assigned today can affect active players.</p><button disabled={busy} className="primary-action" onClick={()=>void saveChallenge()}><Save size={16}/> Save published challenge</button></>:<p>Select a challenge on the left to edit it.</p>}</section></div>}
 </>}
 {error&&<p className="studio-error" role="alert">{error}</p>}{success&&<p className="studio-success" role="status"><CheckCircle2 size={16}/> {success}</p>}
 </div></main>;
}
