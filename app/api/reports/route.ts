import {NextResponse} from 'next/server';
import {playerKey} from '@/lib/player';
import {getGameState,storedChallengeId} from '@/lib/store';
import {serviceDb} from '@/lib/supabase';
import {REPORT_CATEGORIES} from '@/lib/content-types';
import {utcDay} from '@/lib/game-request';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(req:Request){
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return NextResponse.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const raw=await req.text();if(raw.length>3000)return NextResponse.json({error:'Report too large.'},{status:413,headers});
  const body=JSON.parse(raw),mode=body.mode==='practice'?'practice':'daily',day=utcDay();
  if(!REPORT_CATEGORIES.includes(body.category)||typeof body.notes!=='string'||body.notes.length>600||!Number.isInteger(body.stage)||body.stage<0||body.stage>6)return NextResponse.json({error:'Choose a category and a reached clue; notes must be at most 600 characters.'},{status:400,headers});
  if(mode==='daily'&&body.dailyDate!==day)return NextResponse.json({error:'This daily expedition has ended.'},{status:409,headers});
  const db=serviceDb();if(!db)return NextResponse.json({error:'Reports are available in the connected game. This preview is in demo mode.'},{status:503,headers});
  const guest=await playerKey(),{challenge,session}=await getGameState(guest,String(body.practiceKey||body.challengeId||''),mode,day);
  if(challenge.id!==body.challengeId||challenge.revision!==body.revision||body.stage>Math.min(session.stage,6))return NextResponse.json({error:'Report only a clue you have reached in this revision.'},{status:409,headers});
  const {error}=await db.rpc('where7_report_clue',{reporter:guest,session_id:session.storageId||storedChallengeId(challenge.id,mode,day),game_mode:mode,content_revision:challenge.revision,stage_index:body.stage,report_category:body.category,report_notes:body.notes.trim()});
  if(error)return NextResponse.json({error:error.message.includes('limit')?'Daily report limit reached.':'This report could not be saved. Try again.'},{status:error.message.includes('limit')?429:400,headers});
  // No answers, future clues, moderation notes or reporter identity are returned.
  return NextResponse.json({accepted:true},{headers});
 }catch{return NextResponse.json({error:'Unable to save this report.'},{status:400,headers});}
}
