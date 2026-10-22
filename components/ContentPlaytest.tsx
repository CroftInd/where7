'use client';
import {useState} from 'react';
import dynamic from 'next/dynamic';
import type {Challenge} from '@/lib/types';
import {newSession,publicGame,guess,useHint} from '@/lib/engine';
import LocationChoices from './LocationChoices';
const MapCanvas=dynamic(()=>import('./MapCanvas'),{ssr:false});
export default function ContentPlaytest({challenge}:{challenge:Challenge}){
 const [session,setSession]=useState(()=>newSession(challenge.id,'practice')),[selected,setSelected]=useState<string|null>(null),[notice,setNotice]=useState('');
 const game=publicGame(session,challenge,true),stage=game.current;
 const confirm=()=>{if(!selected)return;try{const next=guess(session,challenge,selected);setNotice(next.stage>session.stage?'Correct — next clue unlocked.':'Incorrect — one chance spent.');setSession(next);setSelected(null);}catch(e){setNotice(e instanceof Error?e.message:'Check this stage.');}};
 return <section className="content-playtest"><h3>Play the draft</h3><p>Local simulation only. This does not change the daily game, rankings or review status.</p><p><b>{game.hearts} chances · {game.stage}/7 places · {game.score} points</b></p>
  {stage?<><h4>{stage.label}</h4><p className="preview-clue-text">{stage.clue||'This clue is still empty.'}</p><div className="content-playtest-map"><MapCanvas stage={stage} selected={selected} onSelect={setSelected} reduceMotion/></div><LocationChoices key={stage.level} stage={stage} selected={selected} disabled={false} onSelect={setSelected}/><button type="button" disabled={!selected} onClick={confirm}>Confirm {selected||'a location'}</button><button type="button" disabled={!!stage.hint} onClick={()=>setSession(useHint(session))}>Preview hint</button>{stage.hint&&<p>{stage.hint}</p>}</>:<p role="status">{game.status==='won'?'Perfect run.':'Run complete.'} {game.path.join(' → ')}</p>}
  <p role="status">{notice}</p><button type="button" onClick={()=>{setSession(newSession(challenge.id,'practice'));setSelected(null);setNotice('');}}>Restart playtest</button>
 </section>;
}
