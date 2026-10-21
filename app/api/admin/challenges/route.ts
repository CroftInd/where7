import {NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '@/lib/supabase';
import {listChallenges} from '@/lib/store';
import {validateChallenge,publicationChoiceErrors} from '@/lib/engine';
export const dynamic='force-dynamic';
const reject=()=>NextResponse.json({error:'Admin login required.'},{status:403});
export async function GET(){
  if(!(await requireAdmin()))return reject();
  try{return NextResponse.json({challenges:await listChallenges(true)},{headers:{'Cache-Control':'no-store'}})}
  catch(e){return NextResponse.json({error:String(e)},{status:500})}
}
export async function POST(req:Request){
  if(!(await requireAdmin()))return reject();
  const db=serviceDb();if(!db)return NextResponse.json({error:'Supabase credentials required.'},{status:503});
  if(Number(req.headers.get('content-length')||0)>90000)return NextResponse.json({error:'Challenge payload too large.'},{status:413});
  let body:unknown;
  try{body=await req.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
  if(JSON.stringify(body).length>90000)return NextResponse.json({error:'Challenge payload too large.'},{status:413});
  const parsed=validateChallenge(body);if(!parsed.valid)return NextResponse.json({error:'Invalid challenge',details:parsed.errors},{status:400});
  const v=parsed.value;
  const id=v.id&&/^[-a-z0-9]{3,64}$/.test(v.id)?v.id:`custom-${crypto.randomUUID()}`;
  // Published challenges without a date join the random daily rotation pool.
  const publicationErrors=publicationChoiceErrors(v.stages);
  if(v.status==='published'&&publicationErrors.length)return NextResponse.json({error:'Published challenges require exactly five distinct, real places at each stage after Country.',details:publicationErrors},{status:400});
  const {error}=await db.from('challenges').upsert({id,title:v.title,description:v.description||'',country_iso3:v.countryIso3,
    status:v.status,difficulty:v.difficulty||'standard',publish_date:v.publishDate||null,stages:v.stages,updated_at:new Date().toISOString()});
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({id,success:true});
}
export async function DELETE(req:Request){
  if(!(await requireAdmin()))return reject();
  const db=serviceDb();if(!db)return NextResponse.json({error:'Database not configured'},{status:503});
  const id=new URL(req.url).searchParams.get('id')||'';
  if(!/^custom-[0-9a-f-]{36}$/.test(id))return NextResponse.json({error:'Only custom challenges can be deleted.'},{status:400});
  const {error}=await db.from('challenges').delete().eq('id',id);
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({success:true});
}
