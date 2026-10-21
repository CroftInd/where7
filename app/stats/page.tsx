'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';

import {ArrowLeft,BarChart3,Flame,Trophy,MapPin,Star,Medal,Zap,ArrowUpRight,Gift,ShieldCheck} from 'lucide-react';
type Stats={completed:number;dailyCompleted:number;practiceCompleted:number;perfect:number;bestScore:number;totalPoints:number;averageScore:number;currentStreak:number;longestStreak:number;locationsFound:number};
type Achievement={id:string;name:string;description:string;earned:boolean};
type Profile={signedIn:boolean;name:string;xp:number;level:number;rankName:string};
type Recent={challengeId:string;mode:string;score:number;stage:number;perfect:boolean;finishedAt:string};
export default function StatsPage(){
  const [data,setData]=useState<{stats:Stats;profile:Profile;achievements:Achievement[];recent:Recent[]}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{fetch('/api/stats',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load statistics');setData(d)}).catch(e=>setError(e.message))},[]);
  const stats=data?.stats;
  const xp=data?.profile.xp??0;
  const level=data?.profile.level??1;
  const currentLevelXp=level>=100?0:10*(level-1)*(level-1);
  const nextLevelXp=level>=100?xp:10*level*level;
  const xpProgress=level>=100?100:Math.min(100,Math.max(0,(xp-currentLevelXp)/(nextLevelXp-currentLevelXp)*100));
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
      <div className="explorer-hero"><div className="explorer-avatar"><Zap size={34}/></div><div className="explorer-identity"><span className="eyebrow">YOUR EXPLORER PASSPORT</span><h2>{data.profile.name}</h2><p>Level {level} · <strong>{data.profile.rankName}</strong></p></div><div className="explorer-xp"><strong>{xp.toLocaleString()} XP</strong><span>{level===100?"MAX LEVEL":`${(nextLevelXp-xp).toLocaleString()} XP to next level`}</span></div><div className="explorer-progress"><div style={{width:`${xpProgress}%`}}/></div>{!data.profile.signedIn&&<Link className="explorer-signin" href="/account">Save progress with an account <ArrowUpRight size={15}/></Link>}</div><div className="streak-banner"><Flame size={24}/><div><b>{stats?.currentStreak??0}-day streak</b><span>{stats?.currentStreak?"Keep the journey alive by playing each day.":"Play today to begin your daily streak."}</span></div><Link href="/">Play today <ArrowUpRight size={15}/></Link></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))',gap:14,marginBottom:32}}>
        {metrics.map(([name,value,Icon])=><div key={name} style={{border:'1px solid rgba(155,188,212,.22)',borderRadius:15,padding:20,background:'rgba(20,38,52,.72)'}}><Icon size={20}/><p style={{opacity:.7,margin:'12px 0 5px'}}>{name}</p><strong style={{fontSize:27}}>{value}</strong></div>)}
      </div>
      <Link href="/rewards" className="stats-reward-link"><div><Gift size={24}/><span><strong>Explorer Passport & field rewards</strong><small>Daily missions · Weekly quests · Streak shields · Collectible badges</small></span></div><span>Open your passport →</span></Link>
      <h2 style={{marginBottom:15}}>Achievement collection <span className="achievement-total">{data.achievements.filter(a=>a.earned).length}/{data.achievements.length} unlocked</span></h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,marginBottom:32}}>
        {data.achievements.map(a=><div key={a.id} style={{padding:18,borderRadius:14,border:'1px solid rgba(155,188,212,.2)',opacity:a.earned?1:.45}}><strong>{a.earned?'🏅':'🔒'} {a.name}</strong><p style={{margin:'8px 0 0',opacity:.8}}>{a.description}</p></div>)}
      </div>
      <h2 style={{marginBottom:15}}>Recent expeditions</h2>
      <div className="ranking-list">{data.recent.map((r,i)=><div className="ranking-row" key={`${r.challengeId}-${r.mode}-${i}`}><div className="ranking-name"><span className="ranking-place">{r.perfect?'★':'•'}</span><div><b>{r.challengeId}</b><small>{r.mode} · {new Date(r.finishedAt).toLocaleDateString('en-GB')}</small></div></div><span>{r.stage}/7</span><strong>{r.score.toLocaleString()} pts</strong></div>)}
      {!data.recent.length&&<p className="studio-empty">Complete your first expedition to start tracking your progress.</p>}</div>
      <p style={{marginTop:20,opacity:.65}}>Signed-in player progress is linked to your account. Guest sessions remain browser-specific and are not automatically imported when you register.</p>
    </>}
  </div></main>
}
