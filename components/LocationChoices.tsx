'use client';
import {useEffect,useState} from 'react';
import type {PublicStage} from '@/lib/types';

type Countries={features:{properties:{name:string}}[]};
export default function LocationChoices({stage,selected,disabled,onSelect}:{stage:PublicStage;selected:string|null;disabled:boolean;onSelect:(name:string)=>void}){
  const [countries,setCountries]=useState<string[]>([]),[query,setQuery]=useState('');
  const [attempt,setAttempt]=useState(0),[countryState,setCountryState]=useState<'loading'|'ready'|'error'>('loading');
  useEffect(()=>{
    if(stage.selection!=='country')return;
    let cancelled=false;
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    setCountryState('loading');
    Promise.all(['/world-countries.geojson','/microstates.geojson'].map(async url=>{
      const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw new Error('Country list unavailable');return r.json() as Promise<Countries>;
    })).then(data=>{
      setCountries([...new Set(data.flatMap(d=>d.features.map(f=>f.properties.name)))].sort((a,b)=>a.localeCompare(b)));
      setCountryState('ready');
    }).catch(()=>{if(!controller.signal.aborted||!cancelled)setCountryState('error');}).finally(()=>clearTimeout(timer));
    return()=>{cancelled=true;controller.abort();clearTimeout(timer);};
  },[stage.selection,attempt]);
  const isCountry=stage.selection==='country';
  const names=isCountry?countries.filter(name=>name.toLowerCase().includes(query.trim().toLowerCase())):stage.choices.map(c=>c.name);
  return <section className="location-choices" aria-label="Selectable locations">
    <div className="choice-heading"><b>{isCountry?'Choose a country':'Choose a location'}</b><small>Map or list · same choices</small></div>
    {isCountry&&<><label htmlFor="country-search" className="sr-only">Search countries</label><input id="country-search" type="search" placeholder="Search countries…" value={query} onChange={e=>setQuery(e.target.value)} disabled={disabled} autoComplete="off"/>
      {countryState==='loading'&&<p role="status">Loading country names…</p>}
      {countryState==='error'&&<p role="alert">Country names could not load. <button type="button" onClick={()=>setAttempt(v=>v+1)}>Retry country list</button></p>}
    </>}
    {stage.choiceException&&<p className="choice-exception">{stage.choiceException.reason}</p>}
    {(!isCountry||countryState==='ready')&&<>
      <p className="choice-count" aria-live="polite">{names.length} {names.length===1?'location':'locations'} · selection is free until you confirm</p>
      <div className={isCountry?'choice-list country-choice-list':'choice-list'}>{names.map(name=><button type="button" key={name} aria-pressed={selected===name} className={selected===name?'is-selected':''} disabled={disabled} onClick={()=>onSelect(name)}>{name}{selected===name&&<span aria-hidden="true">✓</span>}</button>)}</div>
      {stage.choices.some(c=>c.attribution)&&<p className="geometry-credit">Map data: {[...new Set(stage.choices.filter(c=>c.attribution).map(c=>c.attribution))].join(' · ')}</p>}
      {names.length===0&&<p>No countries match. Try a shorter name.</p>}
    </>}
  </section>;
}
