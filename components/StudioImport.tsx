'use client';
import {useState} from 'react';
import {Upload,CheckCircle2,FileSpreadsheet,ShieldCheck} from 'lucide-react';
import {parseCsv,validateImportedPlace,CSV_COLUMNS} from '@/lib/studio';
type Result={valid?:boolean;count?:number;inserted?:number;preview?:unknown[];error?:string;details?:string[]};
export default function StudioImport({onImported}:{onImported:()=>Promise<void>}){
 const [rows,setRows]=useState<Record<string,string>[]>([]),[filename,setFilename]=useState(''),[error,setError]=useState(''),[server,setServer]=useState<Result|null>(null),[busy,setBusy]=useState(false);
 const select=async(file:File|null)=>{
  setServer(null);setError('');setFilename(file?.name||'');
  if(!file){setRows([]);return}
  try{const values=parseCsv(await file.text());if(!values.length)throw Error('CSV contains no import rows.');
   const issues=values.flatMap((r,i)=>validateImportedPlace(r,i).errors);
   if(issues.length)throw Error(issues.slice(0,10).join('\n'));
   setRows(values)
  }catch(e){setRows([]);setError(e instanceof Error?e.message:'Unable to parse CSV')}
 };
 const submit=async(dryRun:boolean)=>{
  if(!rows.length||busy)return;setBusy(true);setError('');
  try{const response=await fetch('/api/admin/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rows,dryRun})});const answer=await response.json() as Result;if(!response.ok)throw Error([answer.error,...(answer.details||[])].filter(Boolean).join('\n'));setServer(answer);if(!dryRun){setRows([]);setFilename('');await onImported()}}
  catch(e){setError(e instanceof Error?e.message:'Import failed')}finally{setBusy(false)}
 };
 const sample='level,name,parent_id,lat,lng,clue,hint,source,iso3,published\n0,Sample Country,,50,10,"An example clue describing geographic history.",A hint,https://www.openstreetmap.org/,TST,false\n';
 return <section className="studio-panel studio-import-panel">
  <div className="studio-import-title"><FileSpreadsheet size={27}/><div><h2>Geography CSV importer</h2><p>Import up to 100 locations per batch, with explicit dry-run validation before any database write.</p></div></div>
  <p>Each row needs an existing parent UUID, except countries. For new multi-level paths, import parent levels first, then use their generated IDs. Newly imported places default to draft.</p>
  <div className="studio-csv-columns"><b>CSV headers:</b> {CSV_COLUMNS.join(', ')}</div>
  <button className="secondary-action" onClick={()=>{const blob=new Blob([sample],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='where7-geography-template.csv';a.click();URL.revokeObjectURL(url)}}>Download sample CSV</button>
  <label>Choose CSV<input type="file" accept=".csv,text/csv" onChange={e=>void select(e.currentTarget.files?.[0]||null)}/></label>
  {!!rows.length&&<><div className="studio-import-ready"><CheckCircle2 size={18}/> {rows.length} locally validated rows · {filename}</div>
   <div className="studio-import-preview">{rows.slice(0,8).map((r,i)=><div key={i}><strong>{r.name}</strong><span>Stage {r.level} · {r.lat}, {r.lng} · {r.published||'draft'}</span></div>)}</div>
   <button disabled={busy} className="secondary-action" onClick={()=>void submit(true)}><ShieldCheck size={16}/> Validate against existing database</button>
   <button disabled={busy||!server?.valid||server?.inserted!==undefined} className="primary-action" onClick={()=>void submit(false)}><Upload size={16}/> Import {rows.length} validated locations</button>
  </>}
  {error&&<p className="studio-error" role="alert" style={{whiteSpace:'pre-wrap'}}>{error}</p>}
  {server?.valid&&<p className="studio-import-ready"><CheckCircle2 size={17}/> {server.inserted!==undefined?server.inserted+' locations imported.':server.count+' rows pass all server validation checks. Review, then import.'}</p>}
 </section>;
}
