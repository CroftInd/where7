'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Compass,Plus,ExternalLink,RefreshCw,Trash2,Check,Shield} from 'lucide-react';
type Sponsor={id:string;sponsor_name:string;headline:string;description:string;destination_url:string;starts_at:string;ends_at:string;enabled:boolean};
const localInput=(date:Date)=>new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
export default function SponsorsAdmin(){
 const [sponsors,setSponsors]=useState<Sponsor[]>([]),[error,setError]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 const [sponsorName,setSponsorName]=useState(''),[headline,setHeadline]=useState(''),[description,setDescription]=useState(''),[url,setUrl]=useState('');
 const [from,setFrom]=useState(localInput(new Date())),[to,setTo]=useState(localInput(new Date(Date.now()+30*86400000))),[enabled,setEnabled]=useState(false);
 const load=async()=>{const res=await fetch('/api/admin/sponsors',{cache:'no-store'});const d=await res.json();if(!res.ok)throw Error(d.error||'Unable to load campaigns');setSponsors(d.campaigns||[])};
 useEffect(()=>{void load().catch(e=>setError(String(e)))},[]);
 const action=async(method:'POST'|'PATCH'|'DELETE',data:object)=>{setBusy(true);setNote('');setError('');try{
  const res=await fetch('/api/admin/sponsors',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d=await res.json();
  if(!res.ok)throw Error(d.error||'Campaign save failed');
  await load();setNote('Campaign changes saved.');if(method==='POST'){setSponsorName('');setHeadline('');setDescription('');setUrl('')}
 }catch(e){setError(String(e))}finally{setBusy(false)}};
 return <main className="studio-page"><header className="studio-header"><div className="heading"><Compass size={26}/><div><h1>WHERE7 / Partner campaigns</h1><p>Manage clearly labelled sponsorships, separate from daily scores.</p></div></div><Link href="/admin">← Challenge Studio</Link></header>
 <div style={{maxWidth:1030,margin:'30px auto',padding:15,display:'grid',gap:20}}>
 {error&&<p className="studio-error" role="alert">{error}</p>}{note&&<p className="studio-success" role="status">{note}</p>}
 <section className="studio-panel" style={{padding:22,display:'grid',gap:14}}>
 <h2><Plus size={20}/> Create a sponsored journey</h2><p>Sponsored content appears only on the Plus page, never inside official ranked gameplay. Review all external URLs and disclosure wording before enabling.</p>
 <label>Sponsor name<input value={sponsorName} onChange={e=>setSponsorName(e.target.value)} maxLength={70} placeholder="Partner organisation" /></label>
 <label>Headline<input value={headline} onChange={e=>setHeadline(e.target.value)} maxLength={140} placeholder="Discover the geography of..." /></label>
 <label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={600} placeholder="Clearly describe the sponsored experience" rows={3}/></label>
 <label>Destination URL (HTTPS)<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://partner.example/" /></label>
 <div style={{display:'flex',gap:15,flexWrap:'wrap'}}><label>Starts<input type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Ends<input type="datetime-local" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
 <label style={{display:'flex',gap:9,alignItems:'center'}}><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} /> Enable immediately when within date window</label>
 <button className="primary-action" disabled={busy||!sponsorName||!headline||!url} onClick={()=>void action('POST',{sponsorName,headline,description,destinationUrl:url,startsAt:new Date(from).toISOString(),endsAt:new Date(to).toISOString(),enabled})}><Plus size={17}/> Create campaign</button>
 </section>
 <section className="studio-panel" style={{padding:22,display:'grid',gap:13}}><h2><Shield size={20}/> Existing campaigns</h2>
 {!sponsors.length&&<p>No partner promotions are published yet.</p>}
 {sponsors.map(s=><div key={s.id} style={{border:'1px solid #35566b',borderRadius:12,padding:15,display:'grid',gap:8}}>
 <div style={{display:'flex',gap:15,justifyContent:'space-between',flexWrap:'wrap'}}><b>{s.headline}</b><span>{s.enabled?'Enabled':'Disabled'}</span></div><p>{s.sponsor_name} · {s.description}</p><small>{new Date(s.starts_at).toLocaleString()} – {new Date(s.ends_at).toLocaleString()}</small>
 <a href={s.destination_url} target="_blank" rel="noopener noreferrer">{s.destination_url} <ExternalLink size={14}/></a>
 <div style={{display:'flex',gap:10}}><button className="secondary-action" disabled={busy} onClick={()=>void action('PATCH',{id:s.id,enabled:!s.enabled})}><Check size={15}/>{s.enabled?'Disable':'Enable'}</button><button className="secondary-action" disabled={busy} onClick={()=>{if(confirm('Permanently delete this sponsorship?'))void action('DELETE',{id:s.id})}}><Trash2 size={15}/> Delete</button></div></div>)}
 <button className="secondary-action" onClick={()=>void load().catch(e=>setError(String(e)))}><RefreshCw size={15}/> Refresh</button></section>
 <Link href="/plus">View public Plus page →</Link></div></main>;
}
