'use client';
import {useEffect} from 'react';
import Link from 'next/link';
import {AlertTriangle,RefreshCw,Home} from 'lucide-react';
export default function Error({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('[WHERE7 route error]',error)},[error]);
 return <main className="recovery-page"><section className="recovery-card" role="alert">
  <AlertTriangle size={35} aria-hidden="true"/>
  <h1>We lost the trail.</h1>
  <p>An unexpected problem interrupted the expedition. Your daily session is protected on the server; retrying this page will not reset your guesses.</p>
  <div className="recovery-actions"><button type="button" onClick={reset}><RefreshCw size={17}/> Try again</button><Link href="/"><Home size={17}/> Return to map</Link></div>
 </section></main>;
}
