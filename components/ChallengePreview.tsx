'use client';
import {useState} from 'react';
import {Eye,EyeOff,ChevronLeft,ChevronRight,ShieldAlert,CheckCircle2} from 'lucide-react';
import type {Challenge} from '@/lib/types';
import {inspectChallenge} from '@/lib/studio';
export default function ChallengePreview({challenge}:{challenge:Challenge}){
 const [index,setIndex]=useState(0),[reveal,setReveal]=useState(false),[selected,setSelected]=useState('');
 const stage=challenge.stages[Math.min(index,challenge.stages.length-1)];
 const problems=inspectChallenge(challenge);
 if(!stage)return <p>Seven stage entries are required before this challenge can be previewed.</p>;
 return <section className="studio-quality-preview">
  <header><Eye size={19}/><h3>Player view preview</h3><span>{index+1} / {challenge.stages.length}</span></header>
  <div className="studio-preview-clue"><span>{stage.label.toUpperCase()} · STAGE {index+1}</span><p>{stage.clue||'Add a clue to preview this stage.'}</p></div>
  {stage.choices.length>0?<div className="studio-preview-options">{stage.choices.map(v=><button type="button" key={v.id+v.name} className={selected===v.name?'selected':''} onClick={()=>setSelected(v.name)}>{v.name}</button>)}</div>:<p>Players choose the country directly on the world map.</p>}
  <div className="studio-preview-tools"><button type="button" onClick={()=>{setIndex(n=>Math.max(0,n-1));setSelected('');setReveal(false)}} disabled={index===0}><ChevronLeft size={16}/> Previous</button><button type="button" onClick={()=>setReveal(x=>!x)}>{reveal?<EyeOff size={16}/>:<Eye size={16}/>} {reveal?'Hide correct answer':'Reveal answer'}</button><button type="button" onClick={()=>{setIndex(n=>Math.min(challenge.stages.length-1,n+1));setSelected('');setReveal(false)}} disabled={index===challenge.stages.length-1}>Next <ChevronRight size={16}/></button></div>
  {reveal&&<p className="studio-preview-answer"><CheckCircle2 size={16}/> Correct: {stage.answer}. {selected&&('Your preview selection: '+selected+'.')}</p>}
  <div className="studio-preflight"><h4>{problems.length?<ShieldAlert size={17}/>:<CheckCircle2 size={17}/>} Publication preflight · {problems.length?'Needs attention':'Passed'}</h4>
   {problems.length? <ul>{problems.slice(0,18).map((problem,i)=><li key={i}>{problem}</li>)}</ul>:<p>All seven stages have valid coordinates, sourced clues and five distinct, selectable answers at each non-country level.</p>}
  </div>
 </section>
}
