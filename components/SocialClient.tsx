'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Compass,Users,UserPlus,UserCheck,Search,Shield,Copy,Lock,Globe2,Trophy,RefreshCw,Plus,Check,Trash2,LogIn,Star,CalendarDays,Share2} from 'lucide-react';

type Friend={id:string;handle:string};
type Group={id:string;name:string;owner:boolean;inviteCode:string;memberCount:number};
type Entry={userId:string;handle:string;score:number;days:number;perfect:number;stages:number;rank:number;tier:string};
type Social={signedIn:boolean;onboarded:boolean;profile?:{handle:string;discoverable:boolean;showOnPublicBoards:boolean};friends?:Friend[];incoming?:Friend[];outgoing?:Friend[];groups?:Group[];search?:Friend[];leaderboard?:{entries:Entry[];scope:string;season:string};season?:{month:string;division:string;position:number|null};help?:string;error?:string};
type Tab='league'|'friends'|'groups';
const tierIcon:Record<string,string>={Bronze:'🥉',Silver:'🥈',Gold:'🥇',Platinum:'💎',Diamond:'👑'};

export default function SocialClient(){
 const [data,setData]=useState<Social|null>(null),[tab,setTab]=useState<Tab>('league'),[handle,setHandle]=useState(''),[discoverable,setDiscoverable]=useState(false),[publicBoard,setPublicBoard]=useState(false);
 const [query,setQuery]=useState(''),[groupName,setGroupName]=useState(''),[invite,setInvite]=useState(''),[window,setWindow]=useState<'daily'|'weekly'|'monthly'>('monthly'),[group,setGroup]=useState('friends');
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const load=useCallback(async(q=query,scope=group,range=window,signal?:AbortSignal)=>{
   const p=new URLSearchParams({q,group:scope,window:range});
   const res=await fetch('/api/social?'+p,{cache:'no-store',signal});
   const info=await res.json() as Social;
   if(!res.ok)throw new Error(info.error||'Cannot load Social Hub');
   setData(info);setError('');
   return info;
 },[group,query,window]);
 useEffect(()=>{const controller=new AbortController();void load(query,group,window,controller.signal).catch(e=>{if(!controller.signal.aborted)setError(String(e))});return()=>controller.abort()},[group,window]);
 useEffect(()=>{if(!data?.profile)return;setHandle(data.profile.handle);setDiscoverable(data.profile.discoverable);setPublicBoard(data.profile.showOnPublicBoards)},[data?.profile?.handle,data?.profile?.discoverable,data?.profile?.showOnPublicBoards]);
 const act=async(action:string,params:Record<string,unknown>={})=>{
   if(busy)return;setBusy(true);setNotice('');setError('');
   try{
    const res=await fetch('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...params})});
    const result=await res.json() as {error?:string;inviteCode?:string};
    if(!res.ok)throw new Error(result.error||'Unable to save this change.');
    setNotice(result.inviteCode?'Group created! Invite code: '+result.inviteCode:'Your changes have been saved.');
    await load();
   }catch(e){setError(e instanceof Error?e.message:'Unable to complete social action')}finally{setBusy(false)}
 };
 const search=async()=>{try{await load(query)}catch(e){setError(String(e))}};
 if(!data&&!error)return <div className="social-status"><RefreshCw/> Loading your Explorer community…</div>;
 return <main className="social-page">
  <header className="social-header"><Link href="/" className="social-home"><Compass size={26}/> WHERE<span>7</span></Link><span>SOCIAL EXPEDITIONS</span><Link href="/"><ArrowLeft size={16}/> Back to map</Link></header>
  <div className="social-wrap">
   <div className="social-heading"><div><span className="social-eyebrow">THE EXPLORER COMMUNITY</span><h1>Explore further. Together.</h1><p>Build your crew, compare verified daily expeditions and rise through the seasonal leagues.</p></div><div className="social-orbit"><Users size={55}/></div></div>
   {error&&<div className="social-error" role="alert">{error} <button type="button" onClick={()=>void load().catch(e=>setError(String(e)))}>Retry</button></div>}
   {notice&&<p className="social-notice" role="status"><Check size={17}/>{notice}</p>}
   {!data?.signedIn?<section className="social-panel social-onboard"><LogIn size={30}/><h2>Join the expedition</h2><p>Sign in to follow friends and join private leaderboards. Your email address is never displayed.</p><Link className="social-primary" href="/account">Sign in or create an account</Link></section>:!data.onboarded?
   <section className="social-panel social-onboard"><UserPlus size={30}/><h2>Create your Explorer handle</h2><p>Choose a unique public username. Being discoverable and joining the global leaderboard are both optional.</p>
     <label>Username <input value={handle} onChange={e=>setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))} placeholder="map_explorer" maxLength={18} autoComplete="off"/></label>
     <label className="social-check"><input type="checkbox" checked={discoverable} onChange={e=>setDiscoverable(e.target.checked)}/> Let other players find me by username</label>
     <label className="social-check"><input type="checkbox" checked={publicBoard} onChange={e=>setPublicBoard(e.target.checked)}/> Include my verified scores in public rankings</label>
     <button className="social-primary" disabled={busy||handle.length<3} onClick={()=>void act('profile',{handle,discoverable,publicBoard})}>Create my Explorer profile</button>
    </section>:<>
    <div className="social-identity"><div className="social-avatar"><Compass size={25}/></div><div><small>YOUR EXPLORER HANDLE</small><strong>@{data.profile?.handle}</strong></div><div className="social-identity-meta"><Shield size={16}/> Private by default · {data.friends?.length||0} friends</div></div>
    <div className="social-tabs" role="tablist" aria-label="Social Hub"><button role="tab" aria-selected={tab==='league'} className={tab==='league'?'active':''} onClick={()=>setTab('league')}><Trophy size={17}/> Leagues</button><button role="tab" aria-selected={tab==='friends'} className={tab==='friends'?'active':''} onClick={()=>setTab('friends')}><UserCheck size={17}/> Friends {data.incoming?.length?('('+data.incoming.length+')'):''}</button><button role="tab" aria-selected={tab==='groups'} className={tab==='groups'?'active':''} onClick={()=>setTab('groups')}><Users size={17}/> Groups</button></div>
    {tab==='league'&&<div className="social-content"><section className="social-panel">
      <div className="social-panel-head"><div><span className="social-eyebrow">SEASON {data.season?.month||"CURRENT"}</span><h2><Trophy size={20}/> Seasonal league</h2></div><span className="social-division">{tierIcon[data.season?.division||'Bronze']} {data.season?.division||'Bronze'}</span></div>
      <p>Each calendar month starts a fresh season. Your position is calculated using saved daily scores only.</p>
      <div className="social-controls"><label>Time period<select value={window} onChange={e=>setWindow(e.target.value as 'daily'|'weekly'|'monthly')}><option value="daily">Today</option><option value="weekly">This week</option><option value="monthly">This season</option></select></label><label>Leaderboard<select value={group} onChange={e=>setGroup(e.target.value)}><option value="friends">My friends</option><option value="global">Opt-in public league</option>{data.groups?.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div>
      <div className="social-table"><div className="social-table-head"><span>RANK</span><span>EXPLORER</span><span>COMPLETIONS</span><span>POINTS</span></div>
        {data.leaderboard?.entries?.map(p=><div key={p.userId} className={'social-table-row '+(p.handle===data.profile?.handle?'me':'')}><span>#{p.rank}</span><span><b>{p.handle===data.profile?.handle?'You · ':''}@{p.handle}</b><small>{tierIcon[p.tier]} {p.tier} · {p.perfect} perfect</small></span><span>{p.days}</span><strong>{p.score.toLocaleString()}</strong></div>)}
      </div><p className="social-footnote">Seasonal tiers: Bronze · Silver · Gold · Platinum · Diamond. Practice and archived puzzles never contribute.</p>
     </section></div>}
    {tab==='friends'&&<div className="social-content">
      <section className="social-panel"><h2><Search size={19}/> Discover explorers</h2><p>Search exact usernames or their first few characters. Only people who opt into discovery appear.</p><div className="social-inline"><input value={query} onChange={e=>setQuery(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))} onKeyDown={e=>{if(e.key==='Enter')void search()}} maxLength={18} placeholder="Search by username"/><button disabled={busy||query.length<3} onClick={()=>void search()}><Search size={17}/> Find</button></div>
      {data.search?.map(p=><div className="social-person" key={p.id}><span><UserCheck size={16}/> @{p.handle}</span><button disabled={busy} onClick={()=>void act('request_friend',{handle:p.handle})}><UserPlus size={15}/> Request</button></div>)}
      </section>
      {!!data.incoming?.length&&<section className="social-panel"><h2>Incoming requests</h2>{data.incoming.map(p=><div className="social-person" key={p.id}><strong>@{p.handle}</strong><div><button disabled={busy} onClick={()=>void act('accept_friend',{userId:p.id})}><Check size={16}/> Accept</button><button className="social-muted-button" disabled={busy} onClick={()=>void act('decline_friend',{userId:p.id})}>Decline</button></div></div>)}</section>}
      <section className="social-panel"><h2><UserCheck size={19}/> Friends ({data.friends?.length||0})</h2>{!data.friends?.length&&<p>There are no friends here yet. Search for other explorers to start a friendly rivalry.</p>}{data.friends?.map(p=><div className="social-person" key={p.id}><strong>@{p.handle}</strong><button className="social-muted-button" disabled={busy} onClick={()=>{if(confirm('Remove @'+p.handle+' from friends?'))void act('remove_friend',{userId:p.id})}}>Remove</button></div>)}</section>
      {!!data.outgoing?.length&&<section className="social-panel"><h2>Waiting for a reply</h2>{data.outgoing.map(p=><div className="social-person" key={p.id}><span>@{p.handle}</span><button className="social-muted-button" disabled={busy} onClick={()=>void act('remove_friend',{userId:p.id})}>Cancel request</button></div>)}</section>}
      <section className="social-panel"><h2><Shield size={19}/> Privacy controls</h2><label className="social-check"><input type="checkbox" checked={discoverable} onChange={e=>setDiscoverable(e.target.checked)}/> Others can find my username</label><label className="social-check"><input type="checkbox" checked={publicBoard} onChange={e=>setPublicBoard(e.target.checked)}/> Show my score on the global leaderboard</label><button disabled={busy} className="social-primary" onClick={()=>void act('profile',{handle,discoverable,publicBoard})}>Save privacy preferences</button></section>
     </div>}
    {tab==='groups'&&<div className="social-content">
     <section className="social-panel"><h2><Plus size={19}/> Create a private group</h2><p>Host up to five private groups. Share their invitation codes with friends or family. Each group accommodates up to 30 members.</p><div className="social-inline"><input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Our world explorers" maxLength={48}/><button disabled={busy||groupName.trim().length<3} onClick={()=>void act('create_group',{name:groupName})}>Create group</button></div></section>
     <section className="social-panel"><h2><Lock size={19}/> Join with an invite</h2><div className="social-inline"><input value={invite} onChange={e=>setInvite(e.target.value.toUpperCase().replace(/[^A-F0-9]/g,''))} placeholder="10-digit invite code" maxLength={10}/><button disabled={busy||invite.length!==10} onClick={()=>void act('join_group',{code:invite})}>Join group</button></div></section>
     <section className="social-panel"><h2><Users size={19}/> Your groups ({data.groups?.length||0})</h2>{!data.groups?.length&&<p>You haven't joined a group yet.</p>}{data.groups?.map(g=><div className="social-group-row" key={g.id}><div><strong>{g.name}</strong><small>{g.memberCount}/30 members · {g.owner?'You are the owner':'Member'}</small><code>{g.inviteCode}</code></div><div><button onClick={()=>void navigator.clipboard.writeText(g.inviteCode)} title="Copy invite code"><Copy size={16}/> Copy</button><button onClick={()=>{setGroup(g.id);setTab('league')}}><Trophy size={16}/> Rankings</button>{g.owner?<button className="social-danger" onClick={()=>{if(confirm('Delete '+g.name+' and remove every member?'))void act('delete_group',{groupId:g.id})}}><Trash2 size={16}/></button>:<button className="social-muted-button" onClick={()=>{if(confirm('Leave '+g.name+'?'))void act('leave_group',{groupId:g.id})}}>Leave</button>}</div></div>)}</section>
    </div>}
    <p className="social-footer"><Shield size={14}/> No player emails or future challenge answers are shared. <Link href="/rewards">View your Explorer Passport →</Link></p>
    </>}
  </div>
 </main>;
}
