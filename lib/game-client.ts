import type {PublicGame} from './types.ts';

export class GameRequestError extends Error {
  code?:string;
  constructor(message:string,code?:string){super(message);this.code=code;}
}
/** One bounded attempt. Mutations are never automatically replayed. */
export async function requestGame(url:string,init:RequestInit={}):Promise<{game:PublicGame;correct?:boolean}>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  const parent=init.signal;
  const abort=()=>controller.abort();
  parent?.addEventListener('abort',abort,{once:true});
  if(parent?.aborted)abort();
  try{
    const response=await fetch(url,{...init,signal:controller.signal,cache:'no-store'});
    const data=await response.json();
    if(!response.ok)throw new GameRequestError(data.error||'The expedition could not be updated.',data.code);
    if(!data.game||!Number.isInteger(data.game.version))throw new GameRequestError('Please reload to update your expedition.');
    return data;
  }catch(error){
    if(controller.signal.aborted&&!parent?.aborted)throw new GameRequestError('The connection took too long.');
    throw error;
  }finally{
    clearTimeout(timer);parent?.removeEventListener('abort',abort);
  }
}
