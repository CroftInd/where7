import {createHmac,timingSafeEqual} from 'node:crypto';
export const FREE_THEMES=['ocean','atlas'] as const;
export const PLUS_THEMES=['aurora','sunset','midnight'] as const;
export const FREE_FRAMES=['classic','bronze'] as const;
export const PLUS_FRAMES=['gold','diamond','starlight'] as const;
export const allowedTheme=(theme:string,plus:boolean)=>[...FREE_THEMES,...(plus?PLUS_THEMES:[])].includes(theme as never);
export const allowedFrame=(frame:string,plus:boolean)=>[...FREE_FRAMES,...(plus?PLUS_FRAMES:[])].includes(frame as never);
export const activeSubscription=(status:string)=>status==='active'||status==='trialing';
export const planReady=()=>Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID&&process.env.STRIPE_WEBHOOK_SECRET);
export function verifyStripeSignature(payload:string,header:string,secret:string,now=Math.floor(Date.now()/1000)){
 const fields=new Map(header.split(',').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}));
 const timestamp=Number(fields.get('t'));
 if(!Number.isSafeInteger(timestamp)||Math.abs(now-timestamp)>300)return false;
 const expected=createHmac('sha256',secret).update(timestamp+'.'+payload).digest();
 return header.split(',').filter(x=>x.startsWith('v1=')).some(x=>{
   const received=x.slice(3);
   if(!/^[a-f0-9]{64}$/i.test(received))return false;
   return timingSafeEqual(expected,Buffer.from(received,'hex'));
 });
}
