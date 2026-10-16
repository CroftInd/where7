'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,BookOpen} from 'lucide-react';
type Challenge={id:string;title:string;date:string;difficulty:string};
export default function Archive(){
  const [items,setItems]=useState<Challenge[]>([]),[error,setError]=useState('');
  useEffect(()=>{fetch('/api/archive').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setItems(d.challenges||[])}).catch(e=>setError(e.message))},[]);
  return <main className="studio-page"><header className="studio-header"><div className="heading"><BookOpen size={29}/><div><h1>WHERE7 / Challenge archive</h1><p>Explore previously published expeditions in practice mode.</p></div></div><Link href="/"><ArrowLeft size={15}/> Back to map</Link></header><div className="leaderboard-content">{error&&<div className="studio-error">{error}</div>}{items.map(c=><div className="ranking-row" key={c.id}><div className="ranking-name"><BookOpen size={18}/><div><b>{c.title}</b><small>{c.date} · {c.difficulty}</small></div></div><Link href={`/?mode=practice&challenge=${encodeURIComponent(c.id)}`}>Practice →</Link></div>)}{!items.length&&!error&&<p className="studio-empty">No past daily expeditions yet. The archive fills after a daily challenge has finished (UTC), provided it was assigned through the random rotation system.</p>}</div></main>
}
