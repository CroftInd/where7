import {NextResponse} from 'next/server';
import {serviceDb} from '@/lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){
  try{
    const db=serviceDb();
    const today=new Date().toISOString().slice(0,10);
    if(!db)return NextResponse.json({challenges:[],note:'Archive history requires Supabase.'},{headers:{'Cache-Control':'no-store'}});
    // Only show challenges already played on a previous date, not unpublished
    // puzzles or future random rotation entries. Never spoil today's mystery.
    const {data,error}=await db.from('daily_challenge_assignments')
      .select('challenge_date,challenge_snapshot').lt('challenge_date',today)
      .order('challenge_date',{ascending:false}).limit(365);
    if(error)throw new Error(error.message);
    const challenges=(data||[]).filter(a=>a.challenge_snapshot).map(a=>({date:a.challenge_date}));
    return NextResponse.json({challenges},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Archive unavailable'},{status:500})}
}
