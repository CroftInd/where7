import {NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '@/lib/supabase';
import {currentAccount} from '@/lib/player';
import {listChallenges} from '@/lib/store';
import {validateChallenge} from '@/lib/engine';
import {contentIssues,checklistComplete,destinationKey} from '@/lib/content-quality';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const reject=()=>NextResponse.json({error:'Admin login required.'},{status:403,headers});
export async function GET(){
 if(!(await requireAdmin()))return reject();
 try{return NextResponse.json({challenges:await listChallenges(true)},{headers});}
 catch{return NextResponse.json({error:'Content library unavailable. Apply the Phase 2 migration.'},{status:503,headers});}
}
export async function POST(req:Request){
 if(!(await requireAdmin()))return reject();
 const editor=await currentAccount();if(!editor)return reject();
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return reject();
 const db=serviceDb();if(!db)return NextResponse.json({error:'Database unavailable.'},{status:503,headers});
 try{
  const raw=await req.text();if(raw.length>500000)return NextResponse.json({error:'Content limit is 500 KB.'},{status:413,headers});
  const body=JSON.parse(raw);
  const parsed=validateChallenge(body,{draft:body.intent!=='approve'});if(!parsed.valid)return NextResponse.json({error:'Invalid challenge',details:parsed.errors},{status:422,headers});
  const value=parsed.value;
  const intent=body.intent;
  if(!['draft','in_review','approve'].includes(intent))return NextResponse.json({error:'Choose save draft, submit for review or approve.'},{status:400,headers});
  const expected=body.expectedRevision;
  if(!Number.isSafeInteger(expected)||expected<0)return NextResponse.json({error:'A saved revision is required.'},{status:409,headers});
  const id=value.id&&/^[-a-z0-9]{3,100}$/.test(value.id)?value.id:`custom-${crypto.randomUUID()}`;
  const issues=contentIssues(value);
  if(intent==='approve'){
   if(issues.some(i=>i.severity==='error')||!checklistComplete(body.checklist))return NextResponse.json({error:'Complete the editorial checklist and correct publication errors.',details:issues.filter(i=>i.severity==='error').map(i=>i.message)},{status:422,headers});
   const duplicate=(await listChallenges(true)).find(c=>c.id!==id&&c.status==='published'&&c.reviewStatus==='approved'&&destinationKey(c)===destinationKey(value));
   if(duplicate)return NextResponse.json({error:'An approved challenge already uses this destination. Archive or revise the duplicate.'},{status:422,headers});
  }
  const payload={id,title:value.title,description:value.description||'',countryIso3:value.countryIso3,difficulty:value.difficulty||'standard',stages:value.stages,checklist:body.checklist||{},reserve:body.reserve===true};
  const {data,error}=await db.rpc('where7_save_content',{payload,expected_revision:expected,editor:editor.id,intent});
  if(error)return NextResponse.json({error:error.message},{status:error.message.includes('CONTENT_CONFLICT')?409:422,headers});
  return NextResponse.json({challenge:data,issues,success:true},{headers});
 }catch{return NextResponse.json({error:'Unable to save content. Check the payload and migration.'},{status:400,headers});}
}
