import {NextResponse} from 'next/server';
import {currentAccount,ensureProfile} from '@/lib/player';
import {serviceDb} from '@/lib/supabase';
import {activeSubscription,allowedFrame,allowedTheme,planReady} from '@/lib/plus';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const send=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
export async function GET(){
 try{
  const db=serviceDb(),user=await currentAccount();
  const {data:sponsors,error:se}=db?await db.from('sponsored_journeys').select('id,sponsor_name,headline,description,destination_url').eq('enabled',true).lte('starts_at',new Date().toISOString()).gte('ends_at',new Date().toISOString()).limit(5):{data:[],error:null};
  if(se)throw se;
  if(!user)return send({signedIn:false,plus:false,checkoutReady:planReady(),cosmetics:{theme:'ocean',frame:'classic'},sponsors:sponsors||[]});
  await ensureProfile(user.id,user.email);
  if(!db)return send({error:'Database unavailable'},503);
  const [a,b]=await Promise.all([db.from('player_entitlements').select('status').eq('user_id',user.id).maybeSingle(),db.from('player_cosmetics').select('theme,frame').eq('user_id',user.id).maybeSingle()]);
  if(a.error||b.error)throw a.error||b.error;
  const plus=activeSubscription(a.data?.status||'inactive');
  const theme=allowedTheme(b.data?.theme||'ocean',plus)?b.data?.theme:'ocean';
  const frame=allowedFrame(b.data?.frame||'classic',plus)?b.data?.frame:'classic';
  return send({signedIn:true,plus,checkoutReady:planReady(),cosmetics:{theme,frame},sponsors:sponsors||[]});
 }catch(e){console.error('[WHERE7 plus]',e);return send({error:'Cannot load cosmetics right now.'},503)}
}
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');
  if(origin&&new URL(origin).host!==new URL(req.url).host)return send({error:'Invalid origin'},403);
  const user=await currentAccount();if(!user)return send({error:'Sign in to customise your account.'},401);
  const db=serviceDb();if(!db)return send({error:'Database unavailable'},503);
  const body=await req.json() as {theme?:unknown;frame?:unknown};
  if(typeof body.theme!=='string'||typeof body.frame!=='string')return send({error:'Choose a theme and a frame.'},400);
  const {data:entitlement,error:e}=await db.from('player_entitlements').select('status').eq('user_id',user.id).maybeSingle();
  if(e)throw e;
  const plus=activeSubscription(entitlement?.status||'inactive');
  if(!allowedTheme(body.theme,plus)||!allowedFrame(body.frame,plus))return send({error:'This style requires an active WHERE7 Plus subscription.'},403);
  const {error}=await db.from('player_cosmetics').upsert({user_id:user.id,theme:body.theme,frame:body.frame,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)throw error;
  return send({saved:true,cosmetics:{theme:body.theme,frame:body.frame}});
 }catch(e){console.error('[WHERE7 cosmetics]',e);return send({error:'Unable to save your appearance.'},503)}
}
