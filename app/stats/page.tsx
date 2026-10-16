'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,BarChart3,Flame,Trophy,MapPin,Star,Medal} from 'lucide-react';
type Stats={completed:number;dailyCompleted:number;practiceCompleted:number;perfect:number;bestScore:number;totalPoints:number;averageScore:number;currentStreak:number;longestStreak:number;locationsFound:number};
type Achievement={id:string;name:string;description:string;earned:boolean};
type Recent={challengeId:string;mode:string;score:number;stage:number;perfect:boolean;finishedAt:string};
export default function StatsPage(){
  const [data,setData]=useState<{stats:Stats;achievements:Achievement[];recent:Recent[]}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{fetch('/api/stats',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load statistics');setData(d)}).catch(e=>setError(e.message))},[]);
  const stats=data?.stats;
  const metrics=stats?[
    ['Expeditions',stats.completed,BarChart3],['Daily games',stats.dailyCompleted,MapPin],
    ['Perfect runs',stats.perfect,Star],['Current streak',`${stats.currentStreak} days`,Flame],
    ['Longest streak',`${stats.longestStreak} days`,Flame],['Best score',stats.bestScore.toLocaleString(),Trophy],
    ['Total points',stats.totalPoints.toLocaleString(),Medal],['Locations found',stats.locationsFound,MapPin]
  ] as const:[];
  return <main className="studio-page"><header className="studio-header"><div className="heading"><BarChart3 size={29}/><div><h1>WHERE7 / Explorer statistics</h1><p>Your journeys, streaks and achievements — saved securely in Supabase.</p></div></div><Link href="/"><ArrowLeft size={15}/> Back to map</Link></header>
  <div className="leaderboard-content">
    {error&&<div className="studio-error" role="alert">{error}</div>}
    {!data&&!error&&<p>Loading your explorer profile…</p>}
    {data&&<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:14,marginBottom:32}}>
        {metrics.map(([name,value,Icon])=><div key={name} style={{border:'1px solid rgba(155,188,212,.22)',borderRadius:15,padding:20,background:'rgba(20,38,52,.72)'}}><Icon size={20}/><p style={{opacity:.7,margin:'12px 0 5px'}}>{name}</p><strong style={{fontSize:27}}>{value}</strong></div>)}
      </div>
      <h2 style={{marginBottom:15}}>Achievements</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,marginBottom:32}}>
        {data.achievements.map(a=><div key={a.id} style={{padding:18,borderRadius:14,border:'1px solid rgba(155,188,212,.2)',opacity:a.earned?1:.45}}><strong>{a.earned?'🏅':'🔒'} {a.name}</strong><p style={{margin:'8px 0 0',opacity:.8}}>{a.description}</p></div>)}
      </div>
      <h2 style={{marginBottom:15}}>Recent expeditions</h2>
      <div className="ranking-list">{data.recent.map((r,i)=><div className="ranking-row" key={`${r.challengeId}-${r.mode}-${i}`}><div className="ranking-name"><span className="ranking-place">{r.perfect?'★':'•'}</span><div><b>{r.challengeId}</b><small>{r.mode} · {new Date(r.finishedAt).toLocaleDateString('en-GB')}</small></div></div><span>{r.stage}/7</span><strong>{r.score.toLocaleString()} pts</strong></div>)}
      {!data.recent.length&&<p className="studio-empty">Complete your first expedition to start tracking your progress.</p>}</div>
      <p style={{marginTop:20,opacity:.65}}>Statistics are linked to this browser’s guest cookie. Clearing cookies or changing devices will not transfer your progress until accounts are introduced.</p>
    </>}
  </div></main>
}
