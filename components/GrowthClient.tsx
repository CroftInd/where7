'use client';
import {useEffect,useState} from 'react';import Link from 'next/link';
import {Compass,ChartNoAxesColumnIncreasing,Users,RefreshCw} from 'lucide-react';
type Metric={date:string;players:number};
type Data={last30Days:{uniquePlayers:number;completedDailyResults:number;averageScore:number;perfectResults:number;chart:Metric[]};registeredAccounts:number;rewardClaims:number;notice:string;error?:string};
export default function GrowthClient(){
 const [stats,setStats]=useState<Data|null>(null),[error,setError]=useState('');
 const refresh=async()=>{try{const res=await fetch('/api/admin/growth',{cache:'no-store'});const d=await res.json() as Data;if(!res.ok)throw Error(d.error||'Failed to load metrics');setStats(d);setError('')}catch(e){setError(String(e))}};
 useEffect(()=>{void refresh()},[]);
 const d=stats?.last30Days;const max=Math.max(1,...(d?.chart||[]).map(x=>x.players));
 return <main className="studio-page"><header className="studio-header"><div className="heading"><Compass size={27}/><div><h1>WHERE7 / Growth analytics</h1><p>Aggregate engagement and competitive activity</p></div></div><Link href="/admin">← Challenge Studio</Link></header><section style={{maxWidth:1040,margin:'36px auto',padding:20}}>
 <h2><ChartNoAxesColumnIncreasing size={22}/> Last 30 days</h2>
 {error&&<p className="studio-error" role="alert">{error}</p>}
 {!stats&&!error&&<p>Loading statistics…</p>}
 {stats&&<><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:14,margin:'20px 0'}}>
 {([['Daily players',d?.uniquePlayers],['Completed expeditions',d?.completedDailyResults],['Mean score',d?.averageScore],['Perfect runs',d?.perfectResults],['Registered accounts',stats.registeredAccounts],['Rewards claimed',stats.rewardClaims]] as [string,number|undefined][]).map(([title,value])=><div className="studio-panel" key={title} style={{padding:20}}><div style={{color:'#a9cad0',fontSize:12}}>{title}</div><strong style={{fontSize:28}}>{Number(value||0).toLocaleString()}</strong></div>)}
 </div>
 <div className="studio-panel" style={{padding:20,marginBottom:18}}><h3><Users size={18}/> Players completing a daily challenge</h3><div role="img" aria-label="Daily completed players over the last month" style={{height:210,display:'flex',alignItems:'end',gap:4,overflowX:'auto'}}>
 {d?.chart.map(point=><div title={point.date+': '+point.players+' players'} key={point.date} style={{height:Math.max(4,point.players/max*190)+'px',background:'#56cdb8',borderRadius:5,minWidth:18,flex:1}}/>)}</div></div>
 <p style={{color:'#b6ccd1'}}>{stats.notice}</p></>}
 <button className="secondary-action" onClick={()=>void refresh()}><RefreshCw size={16}/> Refresh report</button><div style={{display:'flex',gap:20,marginTop:25}}><Link href="/admin/partners">Sponsor manager →</Link><Link href="/plus">Public Plus page →</Link></div></section></main>;
}
