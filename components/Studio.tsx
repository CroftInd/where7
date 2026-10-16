'use client';
import {useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {createBrowserClient} from '@supabase/ssr';
import {Settings2,ArrowLeft,ShieldCheck,Plus,Copy,Download,Upload,Trash2,Save,Eye,MapPin,LogIn,LogOut,Calendar,AlertTriangle,CheckCircle2,Lock,Check} from 'lucide-react';
import type {Challenge,Stage,PublicStage,Choice} from '@/lib/types';
const MapCanvas=dynamic(()=>import('./MapCanvas'),{ssr:false,loading:()=> <div className="map-loading">Loading map…</div>});
const envReady=!!process.env.NEXT_PUBLIC_SUPABASE_URL&&!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase=envReady?createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!):null;
const blankStage=(i:number):Stage=>({level:i,label:['Country','State / Region','City','Area','District','Street','Building'][i],clue:'Write a verified geographic statement for this location.',hint:'Add a helpful hint here.',answer:i===0?'United Kingdom':'Example Location',source:'https://www.openstreetmap.org/',center:[-0.1278,51.5074],zoom:[2,4,7,10,12,14,17][i],selection:i===0?'country':i===1?'region':'markers',choices:i===0?[]:[{id:'1',name:'Example Location',lat:51.5074,lng:-0.1278},{id:'2',name:'Alternative One',lat:51.514,lng:-0.132},{id:'3',name:'Alternative Two',lat:51.502,lng:-0.12}]});
const blank=():Challenge=>({id:'custom-'+crypto.randomUUID(),title:'New geographic mystery',description:'Seven clues lead to one unforgettable destination.',countryIso3:'GBR',status:'draft',publishDate:null,difficulty:'standard',stages:Array.from({length:7},(_,i)=>blankStage(i))});
function toPublic(stage:Stage,iso:string):PublicStage {const {answer,hint,source,...publicStage}=stage;return {...publicStage,countryIso3:iso}}
export default function Studio(){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[user,setUser]=useState('');
  const [list,setList]=useState<Challenge[]>([]),[draft,setDraft]=useState<Challenge|null>(null),[tab,setTab]=useState(0),[saving,setSaving]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[success,setSuccess]=useState(''),[pick,setPick]=useState(false),[preview,setPreview]=useState(false),[hoverResult,setHoverResult]=useState('');
  const [choiceText,setChoiceText]=useState('');const importFile=useRef<HTMLInputElement>(null);
  const getLibrary=async()=>{
    const response=await fetch('/api/admin/challenges',{cache:'no-store'});const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Unable to access challenge studio.');
    setList(data.challenges);
    // Preserve local edits; refreshing the library must not overwrite unsaved changes.
    setDraft(prev=>prev||null);
  };
  useEffect(()=>{if(!supabase)return;supabase.auth.getUser().then(({data})=>{if(data.user?.email)setUser(data.user.email)});const {data:{subscription}}=supabase.auth.onAuthStateChange((_ev,s)=>setUser(s?.user.email||''));return()=>subscription.unsubscribe()},[]);
  useEffect(()=>{if(!user)return;void getLibrary().catch(e=>setError(e.message))},[user]);
  useEffect(()=>{if(draft)setChoiceText(draft.stages[tab].choices.map(v=>`${v.name} | ${v.lat} | ${v.lng}`).join('\n'));setPick(false);setPreview(false);setHoverResult('')},[draft?.id,tab]);
  const login=async(e:React.FormEvent)=>{e.preventDefault();if(!supabase)return;setBusy(true);setError('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message);setPassword('');setBusy(false)};
  const logout=async()=>{await supabase?.auth.signOut();setList([]);setUser('');setDraft(null)};
  const modify=(key:keyof Challenge,value:unknown)=>{setDraft(p=>p?{...p,[key]:value}:p);setSuccess('')};
  const modifyStage=(key:keyof Stage,value:unknown)=>setDraft(p=>{if(!p)return p;const stages=p.stages.map((s,i)=>i===tab?{...s,[key]:value}:s);return {...p,stages}});
  const edit=(c:Challenge)=>{setDraft(structuredClone(c));setTab(0);setError('');setSuccess('');};
  const duplicate=(c?:Challenge)=>{const base=structuredClone(c||list.find(c=>c.id==='london')||blank());base.id='custom-'+crypto.randomUUID();base.title=base.title+' (New)';base.status='draft';base.publishDate=null;base.builtIn=false;setDraft(base);setTab(0);setSuccess('Template copied — edit every clue, answer and location, then save.')};
  const save=async()=>{
    if(!draft)return;setSaving(true);setError('');setSuccess('');
    try{const response=await fetch('/api/admin/challenges',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
      const body=await response.json();if(!response.ok)throw new Error(body.details?.join('\n')||body.error||'Save failed');
      setSuccess('Saved successfully. '+(draft.status==='published'?'Published challenge updated in Supabase and available for future daily rotation.':'Draft saved privately.'));
      const id=body.id;setDraft(p=>p?{...p,id}:p);await getLibrary();
    }catch(e){setError(e instanceof Error?e.message:'Save failed')}
    finally{setSaving(false)}
  };
  const deleteDraft=async()=>{if(!draft||!confirm('Permanently delete this challenge?'))return;
    setError('');const response=await fetch('/api/admin/challenges?id='+encodeURIComponent(draft.id),{method:'DELETE'});const data=await response.json();if(!response.ok){setError(data.error||'Delete failed');return;}setDraft(null);await getLibrary();};
  const exportJSON=()=>{if(!draft)return;const blob=new Blob([JSON.stringify(draft,null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`where7-${draft.id}.json`;link.click();URL.revokeObjectURL(link.href)};
  const importJSON=async(file?:File)=>{if(!file)return;try{const parsed=JSON.parse(await file.text()) as Challenge;if(!Array.isArray(parsed.stages)||parsed.stages.length!==7)throw new Error('An imported challenge must have seven stages.');parsed.id='custom-'+crypto.randomUUID();parsed.status='draft';parsed.publishDate=null;setDraft(parsed);setTab(0);setSuccess('Imported as a new draft. Verify every stage before publishing.')}catch(e){setError(e instanceof Error?e.message:'Invalid JSON')}if(importFile.current)importFile.current.value=''};
  const parseChoices=()=>{
    if(!draft||tab===0)return;
    const lines=choiceText.split('\n').map(l=>l.trim()).filter(Boolean);let failed=false;
    const choices=lines.map((line,i)=>{const fields=line.split('|').map(v=>v.trim());const lat=Number(fields[1]),lng=Number(fields[2]);if(fields.length!==3||!fields[0]||!Number.isFinite(lat)||!Number.isFinite(lng)){failed=true;return null;}
      return {id:'choice-'+i,name:fields[0],lat,lng,kind:tab===6?'landmark':'place'} as Choice;
    }).filter(Boolean) as Choice[];
    if(failed){setError('Choices must use one line per place: Name | latitude | longitude.');return;}
    modifyStage('choices',choices);setError('');setSuccess(`${choices.length} selectable map positions applied.`);
  };
  const onMapPick=(lat:number,lng:number)=>{
    if(!draft)return;
    const current=draft.stages[tab];const answer=current.answer;
    const existing=current.choices.findIndex(o=>o.name.toLowerCase()===answer.toLowerCase());
    const choices=[...current.choices];if(tab>0){if(existing>=0)choices[existing]={...choices[existing],lat,lng};else choices.unshift({id:'correct-'+tab,name:answer,lat,lng});}
    const stages=draft.stages.map((s,i)=>i===tab?{...s,center:[lng,lat] as [number,number],choices}:s);
    setDraft({...draft,stages});setChoiceText(choices.map(v=>`${v.name} | ${v.lat} | ${v.lng}`).join('\n'));setPick(false);setSuccess(`Position saved: ${lat.toFixed(5)}, ${lng.toFixed(5)}.`);
  };
  if(!envReady)return <main className="studio-page"><div className="studio-header"><div className="heading"><Settings2/><h1>WHERE7 · Challenge Studio</h1></div><Link href="/">← Game</Link></div><div className="studio-login"><Lock size={40} color="#59dfcf"/><h1>Connect Supabase to activate Studio</h1><p>The editor is deliberately protected. Add <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>, and <code>ADMIN_EMAILS</code> to your <code>.env.local</code>, then run the SQL migration and create your admin user.</p><p>Without these credentials, the game remains playable in local demo mode.</p><Link className="primary-action" href="/">Return to WHERE7</Link></div></main>;
  if(!user)return <main className="studio-page"><div className="studio-header"><div className="heading"><Settings2/><h1>WHERE7 · Challenge Studio</h1></div><Link href="/">← Game</Link></div><div className="studio-login"><ShieldCheck size={42} color="#55dec9"/><h1>Authorised access only</h1><p>Sign in with your Supabase Auth account. Your email must also be listed in the server's <code>ADMIN_EMAILS</code> setting.</p><form onSubmit={login}><div className="studio-field"><label>Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="studio-field"><label>Password</label><input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></div>{error&&<div role="alert" className="studio-error">{error}</div>}<button className="primary-action" type="submit" disabled={busy}><LogIn size={17}/> Sign in to Studio</button></form></div></main>;
  return <main className="studio-page">
    <header className="studio-header"><div className="heading"><Settings2 size={29}/><div><h1>WHERE7 / Challenge Studio</h1><p>Curate challenges for the automatic daily rotation.</p></div></div><div className="studio-toolbar"><span className="studio-stat"><ShieldCheck size={13}/> AUTHORISED</span><Link href="/"><ArrowLeft size={15}/> Game</Link><button onClick={logout}><LogOut size={15}/> Sign out</button></div></header>
    <div className="studio-layout"><aside className="studio-sidebar">
      <div className="studio-eyebrow">CHALLENGE LIBRARY</div><div className="studio-list">{list.map(c=><button key={c.id} className={draft?.id===c.id?'active':''} onClick={()=>edit(c)}><span>{c.title}<br/><small>{c.status==='published'?'● Published':'○ Draft'} {c.publishDate?`· ${c.publishDate}`:''}</small></span><span>→</span></button>)}{!list.length&&<p className="studio-info">No saved challenges yet.</p>}</div>
      <button className="primary-action" onClick={()=>duplicate()}><Plus size={17}/> New from template</button>
      <button className="secondary-action" style={{width:'100%'}} onClick={()=>{setDraft(blank());setTab(0)}}><Plus size={17}/> Blank challenge</button>
      <p className="studio-info">Published challenges enter the daily pool automatically. Each puzzle appears once per cycle; repeats begin after the pool is exhausted. Author seven factual clues. Each stage requires a source, a correct answer, and at least three selectable locations (except the world stage). Save drafts and preview them before publication.</p>
    </aside><section className="studio-main">
      {!draft?<div className="studio-empty"><h2>Prepare the next expedition.</h2><p>Select a challenge on the left, or start from the London template to create your own.</p><button className="primary-action" onClick={()=>duplicate()}><Copy size={17}/> Create challenge</button></div>:<>
      <div className="studio-toolbar" style={{justifyContent:'space-between'}}><span className="studio-stat">{draft.id}</span><div className="studio-toolbar"><button onClick={exportJSON}><Download size={15}/> Export</button><button onClick={()=>importFile.current?.click()}><Upload size={15}/> Import</button><input ref={importFile} type="file" accept=".json,application/json" hidden onChange={e=>void importJSON(e.target.files?.[0])}/><button onClick={()=>duplicate(draft)}><Copy size={15}/> Duplicate</button></div></div>
      <h2 style={{marginTop:22}}>{draft.status==='published'?'Edit published challenge':'Edit your challenge'}</h2><p className="studio-subtitle">You can edit published challenges directly. Update the clue, hint, correct answer or map choices and click Save to update Supabase. Avoid changing an already-live challenge while players are completing it. Publishing adds new challenges to the random daily pool.</p>
      <div className="studio-grid">
        <div className="studio-field"><label>Challenge title</label><input value={draft.title} maxLength={120} onChange={e=>modify('title',e.target.value)}/></div>
        <div className="studio-field"><label>Country ISO3</label><input value={draft.countryIso3} maxLength={3} onChange={e=>modify('countryIso3',e.target.value.toUpperCase())} placeholder="GBR or USA"/></div>
        <div className="studio-field"><label>Legacy publish date (optional; not used by random rotation)</label><input type="date" value={draft.publishDate||''} onChange={e=>modify('publishDate',e.target.value||null)}/></div>
        <div className="studio-field"><label>Status</label><select value={draft.status} onChange={e=>modify('status',e.target.value)}><option value="draft">Private draft</option><option value="published">Published · Eligible for daily rotation</option></select></div>
      </div>
      <div className="studio-field"><label>Description</label><input value={draft.description||''} onChange={e=>modify('description',e.target.value)}/></div>
      <div className="studio-eyebrow" style={{marginTop:25}}>THE SEVEN STAGES</div><div className="stage-tabs">{draft.stages.map((v,i)=><button title={v.label} key={i} className={tab===i?'active':''} onClick={()=>setTab(i)}>{String(i+1).padStart(2,'0')}</button>)}</div>
      <div className="studio-stage" key={tab}><h3>Stage {tab+1}: {draft.stages[tab].label}</h3><p className="studio-subtitle">Select an appropriate geographic level. Players must identify the place from the statement, not from the map camera.</p>
        <div className="studio-field"><label>Correct answer</label><input value={draft.stages[tab].answer} onChange={e=>modifyStage('answer',e.target.value)}/></div>
        <div className="studio-field"><label>Player-facing clue — never reveal the answer</label><textarea rows={3} value={draft.stages[tab].clue} onChange={e=>modifyStage('clue',e.target.value)}/></div>
        <div className="studio-field"><label>Optional hint — give a nudge, not the answer</label><input value={draft.stages[tab].hint} onChange={e=>modifyStage('hint',e.target.value)}/></div>
        <div className="studio-field"><label>HTTPS evidence / source link</label><input type="url" value={draft.stages[tab].source} onChange={e=>modifyStage('source',e.target.value)}/></div>
        <div className="studio-grid"><div className="studio-field"><label>Camera longitude</label><input type="number" step="any" value={draft.stages[tab].center[0]} onChange={e=>modifyStage('center',[Number(e.target.value),draft.stages[tab].center[1]])}/></div>
          <div className="studio-field"><label>Camera latitude</label><input type="number" step="any" value={draft.stages[tab].center[1]} onChange={e=>modifyStage('center',[draft.stages[tab].center[0],Number(e.target.value)])}/></div></div>
        <div className="studio-field"><label>Camera zoom (1–20)</label><input type="number" step="0.5" min="1" max="20" value={draft.stages[tab].zoom} onChange={e=>modifyStage('zoom',Number(e.target.value))}/></div>
        {tab>0&&<><div className="studio-field"><label>Selectable locations — one per line: Name | latitude | longitude</label><textarea rows={6} spellCheck={false} value={choiceText} onChange={e=>setChoiceText(e.target.value)} onBlur={parseChoices}/></div><button className="secondary-action" onClick={parseChoices}><Check size={15}/> Apply map choices</button></>}
        <div className="studio-toolbar" style={{marginTop:16}}><button onClick={()=>{setPreview(v=>!v);setPick(false)}}><Eye size={15}/> {preview?'Hide preview':'Preview map'}</button><button onClick={()=>{setPick(v=>!v);setPreview(true)}}><MapPin size={15}/> {pick?'Cancel picking':'Pick correct place on map'}</button></div>
        {preview&&<><div className="studio-map-pick"><MapCanvas key={`${draft.id}-${tab}`} stage={toPublic(draft.stages[tab],draft.countryIso3)} pickMode={pick} onPick={onMapPick} disabled={!pick} onSelect={name=>setHoverResult('Selected: '+name)}/></div><p className="studio-subtitle">{pick?'Click any point to update the correct answer location and camera.':'Preview only — toggle Pick to set the correct answer coordinate.'} {hoverResult}</p></>}
      </div>
      {error&&<div className="studio-error" role="alert"><AlertTriangle size={15}/> {error}</div>}{success&&<div className="studio-success" role="status"><CheckCircle2 size={15}/> {success}</div>}
      <div className="studio-footer"><div className="studio-toolbar">{draft.id.startsWith('custom-')&&<button className="studio-delete" onClick={()=>void deleteDraft()}><Trash2 size={15}/> Delete</button>}</div><button className="primary-action" disabled={saving} onClick={()=>void save()}><Save size={16}/>{saving?'Saving…':'Save challenge'}</button></div>
      </>}
    </section></div>
  </main>
}
