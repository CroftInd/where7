import Studio from '@/components/Studio';
import {authClient,requireAdmin} from '@/lib/supabase';
import Link from 'next/link';
export const dynamic='force-dynamic';
export default async function AdminPage(){
  const client=await authClient();
  const {data:{user}}=client?await client.auth.getUser():{data:{user:null}};
  if(user && !(await requireAdmin()))return <main className="studio-page"><section className="leaderboard-content" style={{maxWidth:560,margin:'80px auto'}}><h1>Restricted area</h1><p>This account does not have administrator access.</p><Link href="/">Back to WHERE7</Link></section></main>;
  // Signed-out users can see the sign-in form; protected APIs still enforce the admin check.
  return <Studio/>;
}
