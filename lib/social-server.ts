import {serviceDb} from './supabase';
import {isValidHandle,sanitizeHandle,utcDay,rankings,type SocialPlayer,type SocialResult,type SocialWindow} from './social';

const allProfiles=async(db:NonNullable<ReturnType<typeof serviceDb>>,ids:string[])=>{
 if(!ids.length)return [] as SocialPlayer[];
 const {data,error}=await db.from('social_profiles').select('user_id,handle,discoverable,show_on_public_boards').in('user_id',[...new Set(ids)]);
 if(error)throw error;
 return (data||[]) as SocialPlayer[];
};
export async function readSocial(accountId:string,db:NonNullable<ReturnType<typeof serviceDb>>,term:string,window:SocialWindow,selectedGroup:string){
 const [profileRes,connRes,membershipRes,globalRes]=await Promise.all([
   db.from('social_profiles').select('*').eq('user_id',accountId).maybeSingle(),
   db.from('social_connections').select('a,b,requester,status').or('a.eq.'+accountId+',b.eq.'+accountId).limit(300),
   db.from('social_group_members').select('group_id').eq('user_id',accountId).limit(10),
   db.from('social_profiles').select('user_id,handle,discoverable,show_on_public_boards').eq('show_on_public_boards',true).order('handle').limit(100)
 ]);
 for(const res of [profileRes,connRes,membershipRes,globalRes])if(res.error)throw res.error;
 const profile=profileRes.data as SocialPlayer|null;
 if(!profile)return {signedIn:true,onboarded:false};
 const connections=connRes.data||[];
 const friends=connections.filter(x=>x.status==='accepted').map(x=>x.a===accountId?x.b:x.a);
 const groupIds=(membershipRes.data||[]).map(x=>x.group_id as string);
 const [groupRes,memberRes]=await Promise.all([
  groupIds.length?db.from('social_groups').select('id,name,owner_id,invite_code,created_at').in('id',groupIds):Promise.resolve({data:[],error:null}),
  groupIds.length?db.from('social_group_members').select('group_id,user_id').in('group_id',groupIds):Promise.resolve({data:[],error:null})
 ]);
 if(groupRes.error||memberRes.error)throw new Error('Cannot read private groups');
 const groupMembers=memberRes.data||[];
 const allIds=[...new Set([accountId,...friends,...connections.map(c=>c.a===accountId?c.b:c.a),...groupMembers.map(x=>x.user_id)])];
 const profiles=await allProfiles(db,allIds);
 const handles=new Map(profiles.map(x=>[x.user_id,x.handle]));
 const groups=(groupRes.data||[]).map(g=>({
   id:g.id,name:g.name,owner:g.owner_id===accountId,
   inviteCode:g.invite_code,memberCount:groupMembers.filter(m=>m.group_id===g.id).length
 }));
 const incoming=connections.filter(x=>x.status==='pending'&&x.requester!==accountId).map(x=>({id:x.a===accountId?x.b:x.a,handle:handles.get(x.a===accountId?x.b:x.a)||'Explorer'}));
 const outgoing=connections.filter(x=>x.status==='pending'&&x.requester===accountId).map(x=>({id:x.a===accountId?x.b:x.a,handle:handles.get(x.a===accountId?x.b:x.a)||'Explorer'}));
 const accepted=friends.map(id=>({id,handle:handles.get(id)||'Explorer'}));
 const q=sanitizeHandle(term);
 const search=q.length>=3&&q.length<=18&&isValidHandle(q.replace(/[^a-z0-9_]/g,''))?
   await db.from('social_profiles').select('user_id,handle').eq('discoverable',true).ilike('handle',q+'%').neq('user_id',accountId).limit(12):
   {data:[],error:null};
 if(search.error)throw search.error;
 const wantedGroup=selectedGroup!=='friends'&&selectedGroup!=='global'?groups.find(g=>g.id===selectedGroup):undefined;
 const boardIds=selectedGroup==='global'?[accountId,...(globalRes.data||[]).map(x=>x.user_id)]:wantedGroup?groupMembers.filter(m=>m.group_id===wantedGroup.id).map(m=>m.user_id):[accountId,...friends];
 const boardPlayers=selectedGroup==='global'
   ?[{user_id:accountId,handle:profile.handle,discoverable:profile.discoverable,show_on_public_boards:profile.show_on_public_boards},...(globalRes.data||[])].filter((v,i,a)=>a.findIndex(x=>x.user_id===v.user_id)===i)
   :await allProfiles(db,boardIds);
 const ids=boardPlayers.map(p=>p.user_id);
 const {data:results,error:resultError}=ids.length?await db.from('results')
    .select('guest_key,challenge_id,mode,score,guesses,stage,perfect,finished_at')
    .in('guest_key',ids).eq('mode','daily').not('finished_at','is',null)
    .order('finished_at',{ascending:false}).limit(5000):{data:[],error:null};
 if(resultError)throw resultError;
 const today=utcDay(),standings=rankings((results||[]) as SocialResult[],boardPlayers,window,today);
 return {
  signedIn:true,onboarded:true,
  profile:{handle:profile.handle,discoverable:profile.discoverable,showOnPublicBoards:profile.show_on_public_boards},
  friends:accepted,incoming,outgoing,groups,
  search:(search.data||[]).map(x=>({id:x.user_id,handle:x.handle})),
  leaderboard:{window,scope:selectedGroup==='global'?'global':wantedGroup?'group':'friends',groupId:wantedGroup?.id||null,entries:standings,season:today.slice(0,7)},
  season:{month:today.slice(0,7),position:standings.find(p=>p.userId===accountId)?.rank||null,division:standings.find(p=>p.userId===accountId)?.tier||'Bronze'},
  help:'Only completed official daily games count. Scores are taken from saved server results; practice never contributes.'
 };
}
