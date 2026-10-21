import {NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '@/lib/supabase';
import {validateImportedPlace,type ImportedPlace} from '@/lib/studio';
export const dynamic='force-dynamic';
const denied=()=>NextResponse.json({error:'Administrator access required.'},{status:403});
export async function POST(req:Request){
 if(!(await requireAdmin()))return denied();
 const origin=req.headers.get('origin');
 if(origin&&new URL(origin).host!==new URL(req.url).host)return NextResponse.json({error:'Invalid origin.'},{status:403});
 if(Number(req.headers.get('content-length')||0)>800_000)return NextResponse.json({error:'Import limit is 750 KB.'},{status:413});
 const db=serviceDb();if(!db)return NextResponse.json({error:'Database unavailable.'},{status:503});
 try{
 const body=await req.json() as {rows?:Record<string,string>[];dryRun?:boolean};
 const rows=body.rows;
 if(!Array.isArray(rows)||!rows.length||rows.length>100)return NextResponse.json({error:'Import between 1 and 100 rows.'},{status:400});
 const validations=rows.map((row,i)=>validateImportedPlace(row,i));
 const errors=validations.flatMap(v=>v.errors);
 if(errors.length)return NextResponse.json({error:'Some import rows need corrections.',details:errors.slice(0,100)},{status:422});
 const imported=validations.map(v=>v.place!).filter(Boolean);
 const existing=await db.from('geography_nodes').select('id,level,name,parent_id,iso3').limit(15000);
 if(existing.error)throw existing.error;
 const places=existing.data||[],ids=new Map(places.map(v=>[v.id,v]));
 const names=new Set(places.map(x=>(x.parent_id||'root')+':'+x.name.trim().toLocaleLowerCase()));
 for(let i=0;i<imported.length;i++){
  const p=imported[i];
  if(p.level>0){const parent=ids.get(p.parent_id||'');if(!parent||parent.level!==p.level-1)errors.push('Row '+(i+2)+': parent must be an existing place exactly one level above.');}
  if(p.level===0&&places.some(x=>x.level===0&&x.iso3===p.iso3))errors.push('Row '+(i+2)+': country ISO3 already exists.');
  const key=(p.parent_id||'root')+':'+p.name.trim().toLocaleLowerCase();
  if(names.has(key))errors.push('Row '+(i+2)+': a location with this name already exists under the selected parent.');
  names.add(key);
 }
 if(errors.length)return NextResponse.json({error:'Import conflicts with existing geography.',details:errors.slice(0,100)},{status:422});
 if(body.dryRun!==false)return NextResponse.json({valid:true,count:imported.length,preview:imported.slice(0,8)},{headers:{'Cache-Control':'no-store'}});
 // One PostgREST insert statement: the batch is atomic rather than partially applied.
 const {data,error}=await db.from('geography_nodes').insert(imported as ImportedPlace[]).select('id');
 if(error)throw error;
 return NextResponse.json({valid:true,inserted:data?.length||0},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('[Studio import]',e);return NextResponse.json({error:'Unable to import geography. No rows were added.'},{status:503})}
}
