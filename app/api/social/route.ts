import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {currentAccount,ensureProfile} from '@/lib/player';
import {serviceDb} from '@/lib/supabase';
import {isValidHandle,sanitizeHandle,sortPair,validInvite,type SocialWindow} from '@/lib/social';
import {readSocial} from '@/lib/social-server';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const failed=(e:unknown)=>{console.error('[WHERE7 social]',e);return json({error:'Social features are temporarily unavailable.'},503)};
async function auth(){
 const account=await currentAccount(),db=serviceDb();
 if(!db)throw new Error('Social database unavailable');
 if(account)await ensureProfile(account.id,account.email);
 return {account,db};
}
export async function GET(req:Request){
 try{
  const {account,db}=await auth();
  if(!account)return json({signedIn:false,onboarded:false});
  const url=new URL(req.url),window=['daily','weekly','monthly'].includes(url.searchParams.get('window')||'')?url.searchParams.get('window') as SocialWindow:'monthly';
  const group=url.searchParams.get('group')||'friends',q=(url.searchParams.get('q')||'').slice(0,18);
  return json(await readSocial(account.id,db,q,window,group));
 }catch(e){return failed(e)}
}

export {POST} from './actions';
