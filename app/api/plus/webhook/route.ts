import {NextResponse} from 'next/server';
import {serviceDb} from '@/lib/supabase';
import {verifyStripeSignature} from '@/lib/plus';
export const runtime='nodejs';
type StripeObj={id:string;customer?:string|{id:string};subscription?:string|{id:string};status?:string;client_reference_id?:string;metadata?:Record<string,string>};
type Event={id:string;created:number;type:string;data:{object:StripeObj}};
const strId=(s:unknown)=>typeof s==='string'?s:typeof s==='object'&&s&&'id'in s?String(s.id):null;
export async function POST(req:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:'Webhook disabled'},{status:503});
 const raw=await req.text();if(raw.length>150000)return NextResponse.json({error:'Payload too large'},{status:413});
 if(!verifyStripeSignature(raw,req.headers.get('stripe-signature')||'',secret))return NextResponse.json({error:'Invalid signature'},{status:400});
 let event:Event;try{event=JSON.parse(raw) as Event}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
 const db=serviceDb();if(!db)return NextResponse.json({error:'Database unavailable'},{status:503});
 const obj=event.data?.object;
 if(!obj||!event.id||!Number.isInteger(event.created))return NextResponse.json({error:'Invalid event'},{status:400});
 if(event.type!=='checkout.session.completed'&&!event.type.startsWith('customer.subscription.'))return NextResponse.json({received:true});
 try{
  const customer=strId(obj.customer);if(!customer)return NextResponse.json({received:true});
  const subscription=event.type==='checkout.session.completed'?strId(obj.subscription):obj.id;
  let userId:string|null=null;
  if(event.type==='checkout.session.completed')userId=obj.client_reference_id||null;
  else userId=obj.metadata?.where7_user_id||null;
  if(!userId){
   const old=await db.from('player_entitlements').select('user_id').eq('stripe_customer_id',customer).maybeSingle();
   if(old.error)throw old.error;userId=old.data?.user_id||null;
  }
  if(!userId||!/^[0-9a-f-]{36}$/i.test(userId))return NextResponse.json({received:true});
  // Never grant Plus merely because checkout redirected to success. Only
  // subscription.updated/created or a verified Stripe checkout event can grant it.
  const status=event.type==='checkout.session.completed'?'pending':event.type==='customer.subscription.deleted'?'canceled':obj.status||'inactive';
  const current=await db.from('player_entitlements').select('last_event_created,stripe_customer_id,status').eq('user_id',userId).maybeSingle();
  if(current.error)throw current.error;
  if((current.data?.last_event_created||0)>event.created)return NextResponse.json({received:true});
  if(event.type==='checkout.session.completed' && current.data?.status && ['active','trialing'].includes(current.data.status))return NextResponse.json({received:true});
  if(current.data?.stripe_customer_id&&current.data.stripe_customer_id!==customer)return NextResponse.json({error:'Customer mismatch'},{status:409});
  const {error}=await db.from('player_entitlements').upsert({
   user_id:userId,stripe_customer_id:customer,stripe_subscription_id:subscription,status,
   last_event_created:event.created,updated_at:new Date().toISOString()
  },{onConflict:'user_id'});
  if(error)throw error;
  return NextResponse.json({received:true});
 }catch(e){console.error('[WHERE7 webhook]',e);return NextResponse.json({error:'Could not persist event'},{status:503})}
}
