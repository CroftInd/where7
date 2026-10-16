import {NextResponse} from 'next/server';
import {listChallenges} from '@/lib/store';
import {serviceDb} from '@/lib/supabase';
export const dynamic='force-dynamic';
export async function GET(){
  try{
    const catalog=await listChallenges();
    const db=serviceDb();
    const today=new Date().toISOString().slice(0,10);
    if(!db)return NextResponse.json({challenges:[],note:'Archive history requires Supabase.'},{headers:{'Cache-Control':'no-store'}});
    // Only show challenges already played on a previous date, not unpublished
    // puzzles or future random rotation entries. Never spoil today's mystery.
    const {data,error}=await db.from('daily_challenge_assignments')
      .select('challenge_date,challenge_id').lt('challenge_date',today)
      .order('challenge_date',{ascending:false}).limit(365);
    if(error)throw new Error(error.message);
    const published=new Map(catalog.filter(c=>c.status==='published').map(c=>[c.id,c]));
    const challenges=(data||[]).flatMap(a=>{
      const c=published.get(a.challenge_id);
      return c?[{id:c.id,title:c.title,date:a.challenge_date,difficulty:c.difficulty}]:[];
    });
    return NextResponse.json({challenges},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Archive unavailable'},{status:500})}
}
