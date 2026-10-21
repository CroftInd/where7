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
export async function POST(req:Request){
 try{
  const origin=req.headers.get('origin');
  if(origin&&new URL(origin).host!==new URL(req.url).host)return json({error:'Invalid request origin.'},403);
  if(Number(req.headers.get('content-length')||0)>4000)return json({error:'Request is too large.'},413);
  const {account,db}=await auth();
  if(!account)return json({error:'Sign in to access friends and groups.'},401);
  const input=await req.json() as Record<string,unknown>;
  if(!input||typeof input.action!=='string')return json({error:'Choose a social action.'},400);
  const action=input.action;
  if(action==='profile'){
    const handle=sanitizeHandle(input.handle);
    if(!isValidHandle(handle))return json({error:'Choose a unique handle with 3–18 lowercase letters, numbers or underscores.'},400);
    const {error}=await db.from('social_profiles').upsert({
      user_id:account.id,handle,
      discoverable:input.discoverable===true,show_on_public_boards:input.publicBoard===true,
      updated_at:new Date().toISOString()
    },{onConflict:'user_id'});
    if(error?.code==='23505')return json({error:'That username is taken.'},409);
    if(error)throw error;
    return json({success:true});
  }
  const mine=await db.from('social_profiles').select('handle').eq('user_id',account.id).maybeSingle();
  if(mine.error)throw mine.error;
  if(!mine.data)return json({error:'Create your Explorer handle first.'},409);
  if(action==='request_friend'){
    const handle=sanitizeHandle(input.handle);
    if(!isValidHandle(handle)||handle===mine.data.handle)return json({error:'Choose a different valid username.'},400);
    const target=await db.from('social_profiles').select('user_id').eq('handle',handle).eq('discoverable',true).maybeSingle();
    if(target.error)throw target.error;
    if(!target.data)return json({error:'No discoverable player with that username.'},404);
    const [a,b]=sortPair(account.id,target.data.user_id);
    const found=await db.from('social_connections').select('requester,status').eq('a',a).eq('b',b).maybeSingle();
    if(found.error)throw found.error;
    if(found.data){
      if(found.data.status==='accepted')return json({error:'Already friends.'},409);
      if(found.data.requester===account.id)return json({error:'Request already sent.'},409);
      const {error}=await db.from('social_connections').update({status:'accepted',updated_at:new Date().toISOString()}).eq('a',a).eq('b',b).eq('status','pending');
      if(error)throw error;
    }else{
      const {error}=await db.from('social_connections').insert({a,b,requester:account.id,status:'pending'});
      if(error?.code==='23505')return json({error:'A request was just sent. Refresh and check again.'},409);
      if(error)throw error;
    }
    return json({success:true});
  }
  if(action==='accept_friend'||action==='decline_friend'||action==='remove_friend'){
    const other=String(input.userId||'');
    if(!/^[0-9a-f-]{36}$/.test(other)||other===account.id)return json({error:'Invalid player.'},400);
    const [a,b]=sortPair(account.id,other);
    if(action==='remove_friend'){
      const {error}=await db.from('social_connections').delete().eq('a',a).eq('b',b);
      if(error)throw error;
    }else{
      const existing=await db.from('social_connections').select('requester,status').eq('a',a).eq('b',b).maybeSingle();
      if(existing.error)throw existing.error;
      if(!existing.data||existing.data.status!=='pending'||existing.data.requester===account.id)return json({error:'No incoming request found.'},409);
      const res=action==='accept_friend'
        ?await db.from('social_connections').update({status:'accepted',updated_at:new Date().toISOString()}).eq('a',a).eq('b',b).eq('status','pending')
        :await db.from('social_connections').delete().eq('a',a).eq('b',b);
      if(res.error)throw res.error;
    }
    return json({success:true});
  }
  if(action==='create_group'){
    const name=String(input.name||'').trim().replace(/\s+/g,' ');
    if(name.length<3||name.length>48||!(/^[\p{L}\p{N} _'-]+$/u.test(name)))return json({error:'Use a group name of 3–48 characters.'},400);
    const current=await db.from('social_groups').select('id',{count:'exact',head:true}).eq('owner_id',account.id);
    if(current.error)throw current.error;
    if((current.count||0)>=5)return json({error:'You can host at most five groups.'},409);
    const inviteCode=randomBytes(5).toString('hex').toUpperCase();
    const {data,error}=await db.from('social_groups').insert({owner_id:account.id,name,invite_code:inviteCode}).select('id').single();
    if(error)throw error;
    const join=await db.from('social_group_members').insert({group_id:data.id,user_id:account.id});
    if(join.error){await db.from('social_groups').delete().eq('id',data.id).eq('owner_id',account.id);throw join.error}
    return json({success:true,inviteCode});
  }
  if(action==='join_group'){
    const code=String(input.code||'').trim().toUpperCase();
    if(!validInvite(code))return json({error:'Enter a 10-character group invite code.'},400);
    const group=await db.from('social_groups').select('id').eq('invite_code',code).maybeSingle();
    if(group.error)throw group.error;
    if(!group.data)return json({error:'Group not found. Check the invite code.'},404);
    const memberships=await db.from('social_group_members').select('group_id',{count:'exact',head:true}).eq('user_id',account.id);
    if(memberships.error)throw memberships.error;
    if((memberships.count||0)>=10)return json({error:'You can belong to at most ten groups.'},409);
    const members=await db.from('social_group_members').select('user_id',{count:'exact',head:true}).eq('group_id',group.data.id);
    if(members.error)throw members.error;
    if((members.count||0)>=30)return json({error:'This group is full.'},409);
    const {error}=await db.from('social_group_members').upsert({group_id:group.data.id,user_id:account.id},{onConflict:'group_id,user_id',ignoreDuplicates:true});
    if(error)throw error;
    return json({success:true});
  }
  if(action==='leave_group'||action==='delete_group'){
    const groupId=String(input.groupId||'');
    if(!/^[0-9a-f-]{36}$/.test(groupId))return json({error:'Invalid group.'},400);
    const group=await db.from('social_groups').select('owner_id').eq('id',groupId).maybeSingle();
    if(group.error)throw group.error;
    if(!group.data)return json({error:'Group does not exist.'},404);
    if(action==='delete_group'){
      if(group.data.owner_id!==account.id)return json({error:'Only the group owner can delete this group.'},403);
      const {error}=await db.from('social_groups').delete().eq('id',groupId).eq('owner_id',account.id);
      if(error)throw error;
    }else{
      if(group.data.owner_id===account.id)return json({error:'The owner must delete the group, not leave it.'},409);
      const {error}=await db.from('social_group_members').delete().eq('group_id',groupId).eq('user_id',account.id);
      if(error)throw error;
    }
    return json({success:true});
  }
  return json({error:'Unknown social action.'},400);
 }catch(e){return failed(e)}
}
