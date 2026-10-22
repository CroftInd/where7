'use client';
import {useMemo,useState} from 'react';
import type {Challenge} from '@/lib/types';
import {contentIssues} from '@/lib/content-quality';
import {checklistComplete} from '@/lib/content-quality';
import ContentWorkbench from './ContentWorkbench';

type Props={challenges:Challenge[];places:Parameters<typeof ContentWorkbench>[0]['places'];selectedId:string;onSelect:(id:string,published?:boolean)=>void;onDirtyChange:(dirty:boolean)=>void;onSaved:()=>Promise<void>};
export default function QualityRepair({challenges,places,selectedId,onSelect,onDirtyChange,onSaved}:Props){
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('needs-review'),[notice,setNotice]=useState('');
 const rows=useMemo(()=>challenges.map(challenge=>({challenge,issues:contentIssues(challenge)})),[challenges]);
 const needsReview=(c:Challenge)=>c.status!=='published'||c.reviewStatus!=='approved';
 const pending=rows.filter(r=>r.issues.some(i=>i.severity==='error')||needsReview(r.challenge));
 const filtered=rows.filter(({challenge:c,issues})=>(c.title+' '+c.countryIso3).toLowerCase().includes(query.toLowerCase())&&(filter==='all'||filter==='errors'&&issues.some(i=>i.severity==='error')||filter==='published'&&c.status==='published'&&c.reviewStatus==='approved'||filter==='needs-review'&&(needsReview(c)||issues.some(i=>i.severity==='error'))));
 const selected=challenges.find(c=>c.id===selectedId);
 const published=(c:Challenge)=>{const next=pending.find(r=>r.challenge.id!==c.id)?.challenge;setNotice(`Published ${c.title} · revision ${c.revision}.${next?' The next puzzle is open below.':' No more puzzles await correction or review.'}`);onSelect(next?.id||'',true);};
 return <section className="quality-repair" aria-label="Audit correction queue">
 <section className="studio-panel editorial-section"><h2>Correct and publish puzzles</h2><p>Open a puzzle, follow its error links, correct the content, then complete editorial sign-off. Publish and move straight to the next item. Active player runs keep their saved revision.</p>
 {notice&&<p role="status" className="studio-success">{notice}</p>}
 <div className="editorial-fields"><label>Search audit queue<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Puzzle title or country"/></label><label>Show puzzles<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="needs-review">Needs correction or review ({pending.length})</option><option value="errors">Automated errors</option><option value="published">Published and approved</option><option value="all">All puzzles</option></select></label></div>
 <div className="editorial-table-wrap quality-repair-list"><table><thead><tr><th>Puzzle</th><th>Checks</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(({challenge:c,issues})=><tr key={c.id} aria-selected={selectedId===c.id}><td><b>{c.title}</b><br/>{c.countryIso3} · r{c.revision||1}</td><td>{issues.filter(i=>i.severity==='error').length} errors · {issues.filter(i=>i.severity==='warning').length} warnings{!checklistComplete(c.checklist)&&<small>Editorial sign-off needed</small>}</td><td>{c.status} · {c.reviewStatus||'unreviewed'}</td><td><button type="button" onClick={()=>onSelect(c.id)}>{selectedId===c.id?'Editing':'Edit and correct'}</button></td></tr>)}</tbody></table>{!filtered.length&&<p>No puzzles match this filter.</p>}</div></section>
 {selected?<ContentWorkbench key={selected.id} challenges={challenges} places={places} initialChallenge={selected} initialStage={rows.find(r=>r.challenge.id===selected.id)?.issues.find(i=>i.stage!==null&&i.severity==='error')?.stage??0} repairMode onDirtyChange={onDirtyChange} onSaved={onSaved} onPublished={published}/>:<p className="editorial-notice">Select “Edit and correct” to open a puzzle here.</p>}
 </section>;
}
