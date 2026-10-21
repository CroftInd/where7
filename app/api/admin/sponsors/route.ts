import {NextResponse} from 'next/server';
import {requireAdmin,serviceDb} from '@/lib/supabase';
export const dynamic='force-dynamic';
const send=(obj:unknown,status=200)=>NextResponse.json(obj,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 if(!(await requireAdmin()))return send({error:'Admin access required.'},403);
 const db=serviceDb();if(!db)return send({error:'Database unavailable.'},503);
 const {data,error}=await db.from('sponsored_journeys').select('id,sponsor_name,headline,description,destination_url,starts_at,ends_at,enabled,created_at').order('created_at',{ascending:false}).limit(100);
 if(error)return send({error:'Unable to read sponsor campaigns.'},503);
 return send({campaigns:data||[]});
}
export async function POST(req:Request){
 if(!(await requireAdmin()))return send({error:'Admin access required.'},403);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==new URL(req.url).host)return send({error:'Invalid request origin.'},403);
 if(Number(req.headers.get('content-length')||0)>7000)return send({error:'Request too large.'},413);
 let data:Record<string,unknown>;try{data=await req.json() as Record<string,unknown>}catch{return send({error:'Invalid JSON.'},400)}
 if(typeof data.sponsorName!=='string'||typeof data.headline!=='string'||typeof data.description!=='string'||typeof data.destinationUrl!=='string')return send({error:'Campaign fields are required.'},400);
 const sponsor_name=data.sponsorName.trim(),headline=data.headline.trim(),description=data.description.trim(),destination_url=data.destinationUrl.trim();
 if(sponsor_name.length<2||sponsor_name.length>70||headline.length<4||headline.length>140||description.length>600)return send({error:'Check text lengths.'},400);
 let parsed:URL;try{parsed=new URL(destination_url)}catch{return send({error:'Enter a valid HTTPS link.'},400)}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hostname==='localhost'||parsed.hostname.endsWith('.local'))return send({error:'Sponsor links must use public HTTPS domains.'},400);
 const starts_at=String(data.startsAt||''),ends_at=String(data.endsAt||'');
 if(!starts_at||!ends_at||!Number.isFinite(Date.parse(starts_at))||!Number.isFinite(Date.parse(ends_at))||Date.parse(ends_at)<=Date.parse(starts_at))return send({error:'The end date must be later than the start date.'},400);
 const enabled=data.enabled===true;
 const db=serviceDb();if(!db)return send({error:'Database unavailable.'},503);
 const {error}=await db.from('sponsored_journeys').insert({sponsor_name,headline,description,destination_url,starts_at,ends_at,enabled});
 if(error)return send({error:'Could not save sponsorship.'},503);
 return send({success:true});
}
export async function PATCH(req:Request){
 if(!(await requireAdmin()))return send({error:'Admin access required.'},403);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==new URL(req.url).host)return send({error:'Invalid request origin.'},403);
 let d:{id?:unknown;enabled?:unknown};try{d=await req.json()}catch{return send({error:'Invalid JSON.'},400)}
 if(typeof d.id!=='string'||!/^[a-f0-9-]{36}$/i.test(d.id)||typeof d.enabled!=='boolean')return send({error:'Invalid sponsorship update.'},400);
 const db=serviceDb();if(!db)return send({error:'Database unavailable.'},503);
 const {error}=await db.from('sponsored_journeys').update({enabled:d.enabled}).eq('id',d.id);
 if(error)return send({error:'Unable to change campaign status.'},503);
 return send({success:true});
}
export async function DELETE(req:Request){
 if(!(await requireAdmin()))return send({error:'Admin access required.'},403);
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==new URL(req.url).host)return send({error:'Invalid request origin.'},403);
 let d:{id?:unknown};try{d=await req.json()}catch{return send({error:'Invalid JSON.'},400)}
 if(typeof d.id!=='string'||!/^[a-f0-9-]{36}$/i.test(d.id))return send({error:'Invalid campaign ID.'},400);
 const db=serviceDb();if(!db)return send({error:'Database unavailable.'},503);
 const {error}=await db.from('sponsored_journeys').delete().eq('id',d.id);
 if(error)return send({error:'Unable to delete campaign.'},503);
 return send({success:true});
}
