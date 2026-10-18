import {cookies} from 'next/headers';
import {authClient,serviceDb} from './supabase';
/** Signed-in users are keyed by their verified auth UUID, not a spoofable browser value. */
export async function playerKey(){
  const auth=await authClient();
  if(auth){const {data:{user}}=await auth.auth.getUser();if(user)return user.id;}
  const jar=await cookies();let guest=jar.get('where7_guest')?.value;
  if(!guest||!/^[0-9a-f-]{36}$/.test(guest)){
    guest=crypto.randomUUID();jar.set('where7_guest',guest,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:31536000});
  }
  return guest;
}
export async function currentAccount(){
  const auth=await authClient();if(!auth)return null;
  const {data:{user}}=await auth.auth.getUser();return user||null;
}
export async function ensureProfile(id:string,email?:string){
  const db=serviceDb();if(!db)return;
  const name=(email?.split('@')[0]||'Explorer').slice(0,24);
  await db.from('player_profiles').upsert({id,display_name:name},{onConflict:'id',ignoreDuplicates:true});
}
