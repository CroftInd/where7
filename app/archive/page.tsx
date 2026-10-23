'use client';
import {useEffect,useState} from 'react';
import {ExpeditionSeal} from '@/components/AtlasArtwork';
import Link from 'next/link';
import {ArrowLeft,BookOpen} from 'lucide-react';
type Challenge={date:string};
export default function Archive(){
  const [items,setItems]=useState<Challenge[]>([]),[error,setError]=useState('');
  useEffect(()=>{fetch('/api/archive').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setItems(d.challenges||[])}).catch(e=>setError(e.message))},[]);
  return <main className="studio-page"><header className="studio-header"><div className="heading"><BookOpen size={29}/><div><h1>WHERE7 / Challenge archive</h1><p>Replay previous expeditions without revealing their destinations.</p></div></div><Link href="/"><ArrowLeft size={15}/> Back to map</Link></header><div className="leaderboard-content"><section className="archive-masthead"><ExpeditionSeal/><div><p className="eyebrow">THE FIELD JOURNAL</p><h2>Every day, a new horizon.</h2><p>Revisit a past expedition. Follow its seven clues, and discover where the journey leads.</p></div></section>{error&&<div className="studio-error">{error}</div>}{items.map(c=><div className="ranking-row" key={c.date}><div className="ranking-name"><BookOpen size={18}/><div><b>Daily expedition</b><small>{new Date(`${c.date}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}</small></div></div><Link href={`/?mode=practice&challenge=${encodeURIComponent(`archive:${c.date}`)}`}>Practice →</Link></div>)}{!items.length&&!error&&<p className="studio-empty">No past daily expeditions yet. The archive fills after a daily challenge has finished (UTC), provided it was assigned through the random rotation system.</p>}</div></main>
}
