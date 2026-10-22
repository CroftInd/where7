'use client';
import {useState} from 'react';
import type {PublicGame} from '@/lib/types';
export default function ClueReportForm({game}:{game:PublicGame}){
 const [category,setCategory]=useState('inaccurate'),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[sent,setSent]=useState(false);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(busy||sent)return;setBusy(true);setStatus('');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await fetch('/api/reports',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId:game.challengeId,revision:game.contentRevision,practiceKey:game.practiceKey,stage:Math.min(game.stage,6),dailyDate:game.dailyDate,mode:game.mode,category,notes})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Report could not be saved.');
   setSent(true);setStatus('Thank you. This clue and its revision have been sent for review.');
  }catch(e){setStatus(e instanceof Error&&e.name!=='AbortError'?e.message:'The connection timed out. Try again; duplicate reports are safe.');}
  finally{clearTimeout(timer);setBusy(false);}
 };
 return <details className="clue-report"><summary>Report a problem with this clue</summary><p>Your report refers to stage {Math.min(game.stage+1,7)}, revision {game.contentRevision||1}. It will not reveal later places or spend a chance.</p>
  {!sent&&<form onSubmit={submit}><label>What needs attention?<select value={category} disabled={busy} onChange={e=>setCategory(e.target.value)}><option value="inaccurate">Incorrect fact</option><option value="ambiguous">More than one answer fits</option><option value="map">Map or location issue</option><option value="spelling">Name or spelling issue</option><option value="other">Something else</option></select></label><label>Details (optional)<textarea rows={3} maxLength={600} value={notes} disabled={busy} onChange={e=>setNotes(e.target.value)} placeholder="Explain the issue without personal information."/></label><button type="submit" disabled={busy}>{busy?'Sending…':'Send clue report'}</button></form>}
  {status&&<p role="status">{status}</p>}
 </details>;
}
