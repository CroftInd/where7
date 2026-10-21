import {NextResponse} from 'next/server';import {currentAccount} from '@/lib/player';import {serviceDb} from '@/lib/supabase';import {planReady,activeSubscription} from '@/lib/plus';
export async function POST(req:Request){
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==new URL(req.url).host)return NextResponse.json({error:'Invalid origin'},{status:403});
 const account=await currentAccount();if(!account)return NextResponse.json({error:'Sign in before subscribing.'},{status:401});
 if(!planReady())return NextResponse.json({error:'WHERE7 Plus subscriptions are not yet available. No payment has been taken.'},{status:503});
 const db=serviceDb();if(!db)return NextResponse.json({error:'Subscriptions unavailable.'},{status:503});
 const {data:existing,error}=await db.from('player_entitlements').select('status,stripe_customer_id').eq('user_id',account.id).maybeSingle();
 if(error)return NextResponse.json({error:'Subscription lookup failed.'},{status:503});
 if(activeSubscription(existing?.status||''))return NextResponse.json({error:'You already have an active subscription.'},{status:409});
 const key=process.env.STRIPE_SECRET_KEY!,price=process.env.STRIPE_PRICE_ID!;
 const body=new URLSearchParams();
 body.set('mode','subscription');body.set('line_items[0][price]',price);body.set('line_items[0][quantity]','1');
 body.set('client_reference_id',account.id);
 body.set('subscription_data[metadata][where7_user_id]',account.id);
 body.set('success_url','https://www.where7.world/plus?checkout=success');
 body.set('cancel_url','https://www.where7.world/plus?checkout=cancelled');
 if(existing?.stripe_customer_id)body.set('customer',existing.stripe_customer_id);
 else if(account.email)body.set('customer_email',account.email);
 try{
  const res=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),cache:'no-store'});
  const response=await res.json() as {url?:string;error?:{message?:string}};
  if(!res.ok||!response.url||!response.url.startsWith('https://checkout.stripe.com/'))throw new Error(response.error?.message||'Checkout unavailable');
  return NextResponse.json({url:response.url},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('[WHERE7 checkout]',e);return NextResponse.json({error:'Unable to launch checkout. Try again later.'},{status:503})}
}
