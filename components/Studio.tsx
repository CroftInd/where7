'use client';
import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import StudioImport from './StudioImport';
import ContentWorkbench from './ContentWorkbench';
import EditorialPanel from './EditorialPanel';
import QualityRepair from './QualityRepair';
import type {StudioAudit} from '@/lib/studio';
const CoordinatePicker=dynamic(()=>import('./CoordinatePicker'),{ssr:false});
import {createBrowserClient} from '@supabase/ssr';
import Link from 'next/link';
import {ArrowLeft,Plus,Save,LogOut,Database,Layers,CheckCircle2,Search,Upload,ShieldCheck,BookOpen} from 'lucide-react';
import type {Challenge} from '@/lib/types';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const auth=url&&key?createBrowserClient(url,key):null;
const names=['Country','State / Region','City','Area','District','Street','Building'];
type Place={id:string;name:string;level:number;parent_id:string|null;clue:string;hint:string;source:string;lat:number;lng:number;iso3:string|null;published:boolean};
type PlaceDraft=Omit<Place,'id'> & {id?:string};
type ClueTemplate={id:string;level:number;title:string;clue:string;hint:string};
const fresh=(level=0):PlaceDraft=>({name:'',level,parent_id:null,clue:'',hint:'',source:'https://www.openstreetmap.org/',lat:0,lng:0,iso3:null,published:true});
export default function Studio(){
 const [user,setUser]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[places,setPlaces]=useState<Place[]>([]),[challenges,setChallenges]=useState<Challenge[]>([]);
 const [tab,setTab]=useState<'places'|'legacy'|'import'|'quality'>('places'),[place,setPlace]=useState<PlaceDraft>(fresh());
 const [placeQuery,setPlaceQuery]=useState(''),[placeFilter,setPlaceFilter]=useState(-1),[templates,setTemplates]=useState<ClueTemplate[]>([]),[templateTitle,setTemplateTitle]=useState(''),[audit,setAudit]=useState<StudioAudit|null>(null);
 const [repairId,setRepairId]=useState(''),[repairDirty,setRepairDirty]=useState(false);
 const openRepair=(id:string,published=false)=>{if(id===repairId)return;if(!published&&repairDirty&&!confirm('Discard unsaved corrections?'))return;setRepairDirty(false);setRepairId(id);};
 const selectTab=(next:typeof tab)=>{if(next!==tab&&tab==='quality'&&repairDirty&&!confirm('Discard unsaved corrections?'))return;setRepairDirty(false);setTab(next);};
 const [allowed,setAllowed]=useState(false),[checking,setChecking]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const refresh=async()=>{
  const [p,c,t,q]=await Promise.all([fetch('/api/admin/places',{cache:'no-store'}),fetch('/api/admin/challenges',{cache:'no-store'}),fetch('/api/admin/templates',{cache:'no-store'}),fetch('/api/admin/quality',{cache:'no-store'})]);
  const [pd,cd,td,qd]=await Promise.all([p.json(),c.json(),t.json(),q.json()]);
  if(!p.ok)throw new Error(pd.error||'Could not load geography');if(!c.ok)throw new Error(cd.error||'Could not load challenges');
  if(!t.ok||!q.ok)throw new Error('Templates or quality audit unavailable.');
  setPlaces(pd.places||[]);setChallenges(cd.challenges||[]);setTemplates(td.templates||[]);setAudit(qd.audit||null);
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
 const patchPlace=(patch:Partial<PlaceDraft>)=>setPlace(p=>({...p,...patch}));
 const saveTemplate=async()=>{setError('');try{const res=await fetch('/api/admin/templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({level:place.level,title:templateTitle,clue:place.clue,hint:place.hint})});const data=await res.json();if(!res.ok)throw Error(data.error||'Unable to save template');setSuccess('Clue template saved.');setTemplateTitle('');await refresh()}catch(e){setError(e instanceof Error?e.message:'Template error')}};
 const placeTrail=(p:Place)=>{const route=[p.name];let current=p;for(let i=0;i<6&&current.parent_id;i++){const par=places.find(x=>x.id===current.parent_id);if(!par)break;route.unshift(par.name);current=par}return route.join(' › ')};
 const filteredPlaces=places.filter(p=>(placeFilter<0||p.level===placeFilter)&&placeTrail(p).toLowerCase().includes(placeQuery.toLowerCase()));
 const parentOptions=places.filter(p=>p.level===place.level-1);
 return <main className="studio-page"><header className="studio-header"><div className="heading"><Database size={28}/><div><h1>WHERE7 / Challenge manager</h1><p>Reusable locations, simple clues, and published puzzle editing.</p></div></div><Link href="/"><ArrowLeft size={16}/> Back to game</Link></header>
 <div className="leaderboard-content" style={{maxWidth:1120}}>
 {!auth?<p className="studio-error">Supabase is not configured.</p>:!user?<form className="studio-panel" onSubmit={login} style={{padding:24,display:'grid',gap:14,maxWidth:420}}><h2>Administrator sign in</h2><input required type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input required type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/><button className="primary-action" disabled={busy}>Sign in</button></form>:checking?<p>Checking administrator permissions…</p>:!allowed?<div className="studio-error">Access denied. Only the configured administrator account can manage challenges. <Link href="/account">Switch account</Link></div>:<>
 <div className="studio-toolbar" style={{marginBottom:20,display:'flex',gap:12,flexWrap:'wrap'}}><button onClick={()=>selectTab('places')}><Plus size={16}/> Geography library</button><button onClick={()=>selectTab('legacy')}><Layers size={16}/> Content & reviews ({challenges.length})</button><button onClick={()=>selectTab('import')}><Upload size={16}/> CSV Import</button><button onClick={()=>selectTab('quality')}><ShieldCheck size={16}/> Quality audit</button><button onClick={()=>void refresh().catch(e=>setError(e.message))}>Refresh</button><button onClick={()=>void auth?.auth.signOut()}><LogOut size={16}/> Sign out</button></div>
 {tab==='places'?<div className="studio-workbench">
 <section className="studio-panel" style={{padding:20}}><h2>Saved locations ({places.length})</h2><p>Search the full geographic hierarchy or select a place to edit.</p>
 <div className="studio-location-filters"><label><Search size={15}/><input value={placeQuery} onChange={e=>setPlaceQuery(e.target.value)} placeholder="Search place or ancestor"/></label><select aria-label="Filter by stage" value={placeFilter} onChange={e=>setPlaceFilter(Number(e.target.value))}><option value={-1}>Every stage</option>{names.map((n,i)=><option key={i} value={i}>{n}</option>)}</select></div><p>{filteredPlaces.length} matching locations</p>
 <div style={{maxHeight:640,overflowY:'auto',display:'grid',gap:6}}>{filteredPlaces.map(p=><button key={p.id} className="secondary-action" style={{justifyContent:'flex-start',textAlign:'left'}} onClick={()=>setPlace({...p})}><small>{names[p.level]} · </small>{placeTrail(p)}{!p.published?' (draft)':''}</button>)}</div></section>
 <section className="studio-panel" style={{padding:20,display:'grid',gap:13}}><h2>{place.id?'Edit location':'Add location'}</h2><p>Build a path: country → region → city → area → district → street → building. Each location is reusable in future daily challenges.</p>
 <label>Stage<select value={place.level} onChange={e=>setPlace(fresh(Number(e.target.value)))}>{names.map((n,i)=><option value={i} key={n}>{i+1}. {n}</option>)}</select></label>
 {place.level>0&&<label>Inside (parent location)<select value={place.parent_id||''} onChange={e=>patchPlace({parent_id:e.target.value})}><option value="">Select parent…</option>{parentOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
 <label>Correct location name<input value={place.name} onChange={e=>patchPlace({name:e.target.value})} placeholder={place.level===0?'United Kingdom':'England, London, Westminster…'}/></label>
 {place.level===0&&<label>ISO 3-letter country code<input maxLength={3} value={place.iso3||''} onChange={e=>patchPlace({iso3:e.target.value.toUpperCase()})} placeholder="GBR"/></label>}
 <label>Reusable clue templates<select defaultValue="" onChange={e=>{const t=templates.find(x=>x.id===e.target.value);if(t)patchPlace({clue:t.clue,hint:t.hint})}}><option value="">Choose a stage-specific template…</option>{templates.filter(t=>t.level===place.level).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
 <label>Player-facing clue (do not reveal the answer)<textarea rows={3} value={place.clue} onChange={e=>patchPlace({clue:e.target.value})} placeholder="A country made up of four constituent nations…"/></label>
 <label>Optional hint<textarea rows={2} value={place.hint} onChange={e=>patchPlace({hint:e.target.value})}/></label>
 <div className="studio-template-save"><input value={templateTitle} onChange={e=>setTemplateTitle(e.target.value)} placeholder="Clue template title"/><button className="secondary-action" type="button" disabled={templateTitle.trim().length<3||place.clue.length<10||busy} onClick={()=>void saveTemplate()}><BookOpen size={16}/> Save clue</button></div>
 <label>Evidence/source URL<input type="url" value={place.source} onChange={e=>patchPlace({source:e.target.value})}/></label>
 <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><label>Latitude<input type="number" step="any" value={place.lat} onChange={e=>patchPlace({lat:Number(e.target.value)})}/></label><label>Longitude<input type="number" step="any" value={place.lng} onChange={e=>patchPlace({lng:Number(e.target.value)})}/></label></div>
 <CoordinatePicker lat={place.lat} lng={place.lng} onChange={(lat,lng)=>patchPlace({lat,lng})}/>
 <label><input type="checkbox" checked={place.published} onChange={e=>patchPlace({published:e.target.checked})}/> Published / available for future paths</label>
 <button className="primary-action" disabled={busy} onClick={()=>void savePlace()}><Save size={16}/> Save location</button><button className="secondary-action" onClick={()=>setPlace(fresh(place.level))}>New location</button></section></div>:
 tab==='import'?<StudioImport onImported={refresh}/>:
 tab==='quality'?<><QualityRepair challenges={challenges} places={places} selectedId={repairId} onSelect={openRepair} onDirtyChange={setRepairDirty} onSaved={refresh}/><EditorialPanel challenges={challenges} onEdit={openRepair}/><section className="studio-panel studio-audit"><h2><ShieldCheck size={21}/> Atlas quality & publication report</h2>{audit?<><div className="studio-audit-cards"><div><b>{audit.validPublished}/{audit.published}</b><span>Structurally valid legacy challenges</span></div><div><b>{audit.totalPlaces}</b><span>Reusable geographic nodes</span></div><div><b>{audit.completePaths}</b><span>Complete 7-stage paths</span></div><div><b>{audit.orphanedNodes}</b><span>Orphaned location nodes</span></div></div>{audit.invalid.length?<div className="studio-audit-errors">{audit.invalid.map(x=><div key={x.id}><strong>{x.title}</strong> <button type="button" onClick={()=>openRepair(x.id)}>Edit and correct</button><ul>{x.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div>)}</div>:<p className="studio-success"><CheckCircle2 size={16}/> Every published challenge passes the automated structural checks.</p>}<p>This structural report does not certify factual accuracy or editorial sign-off. Use the review queue above.</p></>:<p>Refresh to load the quality report.</p>}</section></>:
 <ContentWorkbench challenges={challenges} places={places} onSaved={refresh}/>}
 </>}
 {error&&<p className="studio-error" role="alert">{error}</p>}{success&&<p className="studio-success" role="status"><CheckCircle2 size={16}/> {success}</p>}
 </div></main>;
}
