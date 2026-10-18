'use client';
import {useEffect,useState} from 'react';
import {createBrowserClient} from '@supabase/ssr';
import Link from 'next/link';
import {Compass,LogIn,LogOut,UserPlus,ArrowLeft} from 'lucide-react';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase=url&&key?createBrowserClient(url,key):null;
export default function Account(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[signedIn,setSignedIn]=useState(''),[recovering,setRecovering]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(!supabase)return;void supabase.auth.getUser().then(({data})=>setSignedIn(data.user?.email||''));const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{setSignedIn(session?.user.email||'');if(event==='PASSWORD_RECOVERY')setRecovering(true)});return()=>subscription.unsubscribe()},[]);
 const submit=async(kind:'login'|'signup')=>{if(!supabase)return;setBusy(true);setMessage('');setError('');try{
   const result=kind==='login'?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+'/account'}});
   if(result.error)throw result.error;
   setMessage(kind==='signup'?'Account created. Check your email for a confirmation link if required.':'Signed in. Your future daily scores will be saved to this account.');setPassword('');
 }catch(e){setError(e instanceof Error?e.message:'Authentication failed')}finally{setBusy(false)}};
 const reset=async()=>{if(!supabase||!email.trim())return;setBusy(true);setError('');const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/account'});if(error)setError(error.message);else setMessage('Check your email for a password-reset link.');setBusy(false)};
 const updatePassword=async()=>{if(!supabase||password.length<6)return;setBusy(true);const {error}=await supabase.auth.updateUser({password});if(error)setError(error.message);else{setRecovering(false);setPassword('');setMessage('Password updated.')}setBusy(false)};
 const logout=async()=>{await supabase?.auth.signOut();setMessage('Signed out.');setSignedIn('')};
 return <main className="studio-page"><header className="studio-header"><div className="heading"><Compass size={28}/><div><h1>WHERE7 / Explorer account</h1><p>One identity. Every expedition.</p></div></div><Link href="/"><ArrowLeft size={16}/> Back to map</Link></header><section className="leaderboard-content" style={{maxWidth:520,margin:'60px auto'}}>
 {!supabase?<p className="studio-error">Supabase browser credentials are missing.</p>:recovering?<div className="studio-panel" style={{padding:28,display:'grid',gap:14}}><h2>Choose a new password</h2><input type="password" minLength={6} placeholder="New password" value={password} onChange={e=>setPassword(e.target.value)}/><button className="primary-action" disabled={busy||password.length<6} onClick={()=>void updatePassword()}>Update password</button></div>:signedIn?<div className="studio-panel" style={{padding:28}}><h2>Welcome back</h2><p>{signedIn}</p><p>Daily scores, XP, rank and achievements are now linked to your account on this device.</p><p><Link href="/stats">View my statistics →</Link></p><button className="secondary-action" onClick={()=>void logout()}><LogOut size={16}/> Sign out</button></div>:<form className="studio-panel" style={{padding:28,display:'grid',gap:15}} onSubmit={e=>{e.preventDefault();void submit('login')}}><h2>Sign in or create an account</h2><label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input required minLength={6} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy} className="primary-action" type="submit"><LogIn size={16}/> Sign in</button><button disabled={busy} className="secondary-action" type="button" onClick={()=>void submit('signup')}><UserPlus size={16}/> Create account</button><button disabled={busy||!email.trim()} className="secondary-action" type="button" onClick={()=>void reset()}>Forgot password?</button><small>Account creation uses Supabase Auth. If email confirmation is enabled, verify your address before signing in.</small></form>}
 {error&&<p className="studio-error" role="alert">{error}</p>}{message&&<p className="studio-success" role="status">{message}</p>}
 </section></main>
}
