'use client';
import {useEffect,useState} from 'react';
import {ExpeditionSeal} from '@/components/AtlasArtwork';
import Link from 'next/link';
import {Trophy,CircleHelp,Flame,ArrowLeft,Medal,ShieldCheck} from 'lucide-react';
type Entry={rank:number;name:string;score:number;stages:number;guesses:number;perfect:boolean;level:number;rankName:string};
export default function Leaderboard(){
  const [entries,setEntries]=useState<Entry[]>([]),[demo,setDemo]=useState(false),[title,setTitle]=useState('Daily mystery'),[error,setError]=useState('');
  useEffect(()=>{fetch('/api/leaderboard').then(r=>r.json()).then(d=>{if(d.error)throw new Error(d.error);setEntries(d.entries||[]);setDemo(Boolean(d.demo));setTitle(d.title||'Daily mystery')}).catch(e=>setError(e.message))},[]);
  return <main className="studio-page"><header className="studio-header"><div className="heading"><Trophy size={29}/><div><h1>WHERE7 / Daily leaderboard</h1><p>Find the destination. Earn your place.</p></div></div><Link href="/"><ArrowLeft size={15}/> Back to map</Link></header>
    <div className="leaderboard-content"><div className="leaderboard-intro"><div className="result-halo result-seal"><ExpeditionSeal/></div><p className="eyebrow">TODAY'S EXPLORERS</p><h2>{title}</h2><p>Seven clues. Seven chances. Every correct discovery counts. Perfect games rank above incomplete expeditions.</p></div>
      {error&&<div className="studio-error">{error}</div>}{demo&&<div className="studio-error">Leaderboard is disabled in local demo mode. Connect your Supabase project to enable shared scores.</div>}
      <div className="ranking-list"><div className="ranking-header"><span>RANK / PLAYER</span><span>LOCATIONS</span><span>PTS</span></div>
      {entries.map(v=><div key={v.rank} className="ranking-row"><div className="ranking-name"><span className={`ranking-place rank-${v.rank}`}>{v.rank<=3?<Medal size={20}/>:String(v.rank).padStart(2,'0')}</span><div><b>{v.name}</b><small>Level {v.level} · {v.rankName}{v.perfect?' · ✦ Perfect seven':''}</small></div></div><span className="ranking-hearts"><CircleHelp/>{v.stages}/7</span><strong>{v.score.toLocaleString()}</strong></div>)}
      {!entries.length&&<div className="studio-empty">No verified results have been submitted for this daily challenge yet. Be the first to finish.</div>}
      </div><p className="ranking-footnote"><ShieldCheck size={15}/> Scores are calculated by the server. Guest-cookie identities are not a substitute for verified user accounts; account-based anti-cheat protection is planned before competitive launch.</p>
    </div>
  </main>
}
