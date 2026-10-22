import {NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '@/lib/supabase';
import {currentAccount} from '@/lib/player';
import {listChallenges} from '@/lib/store';
import {planBuffer,contentIssues,duplicateDestinations,reviewCandidates} from '@/lib/content-quality';
import {utcDay} from '@/lib/game-request';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){
 if(!(await requireAdmin()))return NextResponse.json({error:'Admin required.'},{status:403,headers});
 const db=serviceDb();if(!db)return NextResponse.json({error:'Database unavailable.'},{status:503,headers});
 try{
  const reportId=new URL(req.url).searchParams.get('reportId');
  if(reportId){
   if(!/^[0-9a-f-]{36}$/i.test(reportId))return NextResponse.json({error:'Invalid report.'},{status:400,headers});
   const report=await db.from('clue_reports').select('challenge_id,revision,stage').eq('id',reportId).single();
   if(report.error)throw Error('Report unavailable');
   const revision=await db.from('challenge_revisions').select('snapshot').eq('challenge_id',report.data.challenge_id).eq('revision',report.data.revision).single();
   if(revision.error)throw Error('Revision unavailable');
   const s=revision.data.snapshot.stages[report.data.stage];
   return NextResponse.json({reportedStage:{revision:report.data.revision,stage:report.data.stage,clue:s.clue,answer:s.answer,source:s.source,choices:s.choices}},{headers});
  }
  const today=utcDay(),start=new Date(Date.parse(today)+86400000).toISOString().slice(0,10);
  const [challenges,schedule,reports,settings,assigned,metrics]=await Promise.all([
   listChallenges(true),db.from('challenge_schedule').select('challenge_date,challenge_id,revision').gte('challenge_date',today).order('challenge_date').limit(90),
   db.from('clue_reports').select('id,challenge_id,revision,stage,category,notes,status,created_at,resolution').order('created_at',{ascending:false}).limit(100),
   db.from('content_settings').select('reviews_required').eq('singleton',true).single(),
   db.from('daily_challenge_assignments').select('challenge_id,challenge_snapshot').eq('challenge_date',today).maybeSingle(),db.rpc('where7_editorial_metrics')
  ]);
  if(schedule.error||reports.error||settings.error||assigned.error||metrics.error)throw Error('Migration required');
  const revisions=await db.from('challenge_revisions').select('challenge_id,revision,review_status').eq('review_status','approved');
  if(revisions.error)throw Error('Revision data unavailable');
  const approved=new Set((revisions.data||[]).map(r=>r.challenge_id+':'+r.revision));
  const covered=new Set((schedule.data||[]).filter(s=>approved.has(s.challenge_id+':'+s.revision)).map(s=>s.challenge_date));
  const gaps=Array.from({length:30},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10)).filter(day=>!covered.has(day));
  return NextResponse.json({metrics:metrics.data,schedule:schedule.data,reports:reports.data,reviewsRequired:settings.data.reviews_required,
   todayAssignment:assigned.data?{id:assigned.data.challenge_id,revision:assigned.data.challenge_snapshot?.revision}:null,
   reviewBatch:reviewCandidates(challenges).map(c=>c.id),coverage:30-gaps.length,gaps,proposal:planBuffer(challenges,start),duplicates:duplicateDestinations(challenges),
   reviewQueue:challenges.filter(c=>c.reviewStatus!=='approved').map(c=>({id:c.id,countryIso3:c.countryIso3,issues:contentIssues(c)}))},{headers});
 }catch{return NextResponse.json({error:'Editorial data unavailable. Apply the Phase 2 content migration.'},{status:503,headers});}
}
export async function POST(req:Request){
 if(!(await requireAdmin()))return NextResponse.json({error:'Admin required.'},{status:403,headers});
 const editor=await currentAccount(),db=serviceDb();if(!editor||!db)return NextResponse.json({error:'Database unavailable.'},{status:503,headers});
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return NextResponse.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const text=await req.text();if(text.length>20000)return NextResponse.json({error:'Request too large.'},{status:413,headers});
  const body=JSON.parse(text);let result;
  if(body.action==='schedule'){
   if(!Array.isArray(body.entries)||body.entries.length<1||body.entries.length>60||body.entries.some((e:Record<string,unknown>)=>!/^\d{4}-\d{2}-\d{2}$/.test(String(e.day))||typeof e.challengeId!=='string'||!Number.isSafeInteger(e.revision)))throw Error('Invalid schedule entries.');
   result=await db.rpc('where7_schedule_content',{entries:body.entries,editor:editor.id});
  }else if(body.action==='activate')result=await db.rpc('where7_activate_quality',{editor:editor.id});
  else if(body.action==='replace'){
   if(body.confirmation!=='REPLACE'||typeof body.reason!=='string'||body.reason.trim().length<15)throw Error('Type REPLACE and explain the replacement.');
   result=await db.rpc('where7_replace_daily',{target_day:utcDay(),expected_id:body.expectedId,replacement_id:body.challengeId,replacement_revision:body.revision,reason:body.reason.trim(),editor:editor.id});
  }else if(body.action==='report_status'){
   if(!/^[0-9a-f-]{36}$/i.test(body.id)||!['open','reviewing','resolved','dismissed'].includes(body.status)||typeof body.resolution!=='string'||body.resolution.length>1000||['resolved','dismissed'].includes(body.status)&&body.resolution.trim().length<10)throw Error('Choose a report and record a specific resolution.');
   result=await db.from('clue_reports').update({status:body.status,resolution:body.resolution,resolved_by:editor.id,updated_at:new Date().toISOString()}).eq('id',body.id).select('id').single();
  }else throw Error('Unknown editorial action.');
  if(result.error)throw Error(result.error.message);
  return NextResponse.json({success:true},{headers});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Editorial action failed.'},{status:422,headers});}
}
