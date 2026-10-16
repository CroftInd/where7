import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {selectChallenge,readSession,saveSession,restartPractice,cloudReady} from '@/lib/store';
import {guess,useHint,abandon,publicGame} from '@/lib/engine';
import type {Session} from '@/lib/types';

export const dynamic='force-dynamic';
async function guestKey(){
  const jar=await cookies();let token=jar.get('where7_guest')?.value;
  if(!token||!/^[0-9a-f-]{36}$/.test(token)){
    token=crypto.randomUUID();jar.set('where7_guest',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:60*60*24*365});
  }
  return token;
}
function modeAndId(url:URL,body?:Record<string,unknown>){
  const mode=(body?.mode||url.searchParams.get('mode'))==='practice'?'practice':'daily' as Session['mode'];
  const id=String(body?.challengeId||url.searchParams.get('challenge')||'').slice(0,100);
  return{mode,id};
}
function errorResponse(error:unknown){const message=error instanceof Error?error.message:'Unexpected error';return NextResponse.json({error:message},{status:message.includes('another tab')?409:400,headers:{'Cache-Control':'no-store'}})}
export async function GET(request:Request){
  try{const guest=await guestKey();const {mode,id}=modeAndId(new URL(request.url));const challenge=await selectChallenge(id,mode);const session=await readSession(guest,challenge.id,mode);
    return NextResponse.json({game:publicGame(session,challenge,!cloudReady),available:[{id:'london',title:'Westminster Mystery'},{id:'nyc',title:'Manhattan Mystery'}]}, {headers:{'Cache-Control':'private, no-store'}});
  }catch(e){return errorResponse(e)}
}
export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;
    const {mode,id}=modeAndId(new URL(request.url),body);
    const guest=await guestKey();const challenge=await selectChallenge(id,mode);
    if(body.action==='restart'){
      if(mode!=='practice')throw new Error('Official daily challenges cannot be restarted.');
      await restartPractice(guest,challenge.id);
      const fresh=await readSession(guest,challenge.id,mode);
      return NextResponse.json({game:publicGame(fresh,challenge,!cloudReady)},{headers:{'Cache-Control':'no-store'}});
    }
    const session=await readSession(guest,challenge.id,mode);
    // Reject stale browser requests. Submit only the stage the client currently displays.
    if(typeof body.stage!=='number'||body.stage!==session.stage)throw new Error('Your challenge has advanced. Refresh the page.');
    let next:Session;
    if(body.action==='guess')next=guess(session,challenge,String(body.answer||''));
    else if(body.action==='hint')next=useHint(session);
    else if(body.action==='giveup')next=abandon(session);
    else throw new Error('Unknown action.');
    if(next!==session)await saveSession(guest,session,next);
    return NextResponse.json({game:publicGame(next,challenge,!cloudReady),correct:body.action==='guess'?next.history.at(-1)?.correct:undefined}, {headers:{'Cache-Control':'private, no-store'}});
  }catch(e){return errorResponse(e)}
}
