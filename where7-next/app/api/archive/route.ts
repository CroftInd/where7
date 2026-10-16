import {NextResponse} from 'next/server';
import {listChallenges} from '@/lib/store';
export const dynamic='force-dynamic';
export async function GET(){
  try{
    const catalog=await listChallenges();
    const now=new Date().toISOString().slice(0,10);
    const challenges=catalog.filter(c=>c.status==='published'&&c.publishDate&&c.publishDate<=now)
      .sort((a,b)=>(b.publishDate||'').localeCompare(a.publishDate||''))
      .map(c=>({id:c.id,title:c.title,date:c.publishDate,difficulty:c.difficulty}));
    return NextResponse.json({challenges},{headers:{'Cache-Control':'public, max-age=60'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Archive unavailable'},{status:500})}
}
