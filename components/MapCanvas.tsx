'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {PublicStage} from '@/lib/types';
import type {Map as MaplibreMap,Marker as MaplibreMarker,StyleSpecification,GeoJSONSource} from 'maplibre-gl';
import {Compass,LocateFixed,Plus,Minus,Layers,AlertCircle} from 'lucide-react';

type Props={stage:PublicStage|null; disabled?:boolean; onSelect?:(name:string)=>void; pickMode?:boolean; onPick?:(lat:number,lng:number)=>void; selected?:string|null;};
const emptyFC={type:'FeatureCollection',features:[]};
// CARTO basemap key is read automatically at build time from .env.local / Vercel.
const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();
const BASE_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim() || 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
const TILE = CARTO_API_KEY && BASE_TILE_URL.includes('cartocdn.com')
  ? `${BASE_TILE_URL}${BASE_TILE_URL.includes('?') ? '&' : '?'}key=${encodeURIComponent(CARTO_API_KEY)}`
  : BASE_TILE_URL;
const ATTRIBUTION=process.env.NEXT_PUBLIC_MAP_ATTRIBUTION||'© OpenStreetMap contributors · © CARTO';
export default function MapCanvas({stage,disabled=false,onSelect,pickMode=false,onPick,selected}:Props){
  const holder=useRef<HTMLDivElement>(null);
  const mapRef=useRef<MaplibreMap|null>(null);
  const markers=useRef<MaplibreMarker[]>([]);
  const onSelectRef=useRef(onSelect),onPickRef=useRef(onPick),stageRef=useRef(stage),disabledRef=useRef(disabled),pickRef=useRef(pickMode);
  const [ready,setReady]=useState(false),[warning,setWarning]=useState(''),[hover,setHover]=useState(''),[hoverPos,setHoverPos]=useState<[number,number]>([0,0]),[detail,setDetail]=useState(true);
  const [mapError,setMapError]=useState('');
  onSelectRef.current=onSelect;onPickRef.current=onPick;stageRef.current=stage;disabledRef.current=disabled;pickRef.current=pickMode;
  const clearMarkers=useCallback(()=>{markers.current.forEach(m=>m.remove());markers.current=[]},[]);
  useEffect(()=>{
    if(!holder.current)return;
    let stopped=false;let instance:MaplibreMap|null=null;
    import('maplibre-gl').then(mod=>{
      if(stopped||!holder.current)return;
      const gl=mod.default;
      const style:StyleSpecification={version:8,
        sources:{basemap:{type:'raster',tiles:[TILE],tileSize:256,attribution:ATTRIBUTION}},
        layers:[{id:'backdrop',type:'background',paint:{'background-color':'#132c3a'}},
          {id:'basemap',type:'raster',source:'basemap',paint:{'raster-opacity':1}}]};
      const map=new gl.Map({container:holder.current,style,center:[-17,24],zoom:1.75,minZoom:1,maxZoom:19,attributionControl:false,pitchWithRotate:false,dragRotate:false,touchPitch:false,fadeDuration:80,renderWorldCopies:false});
      instance=map;mapRef.current=map;
      map.addControl(new gl.AttributionControl({compact:true}),'bottom-left');
      map.on('error',e=>{const text=String(e.error?.message||'');if(text.includes('style')||text.includes('WebGL'))setMapError('The map renderer is unavailable. Try refreshing or enabling hardware acceleration.');});
      map.on('load',()=>{
        if(stopped)return;
        map.addSource('countries',{type:'geojson',data:'/world-countries.geojson'});
        map.addLayer({id:'countries',type:'fill',source:'countries',paint:{'fill-color':'#52aabb','fill-opacity':0.12}});
        map.addLayer({id:'country-lines',type:'line',source:'countries',paint:{'line-color':'#77d4de','line-opacity':0.6,'line-width':['interpolate',['linear'],['zoom'],1,0.45,5,1.4]}});
        map.addLayer({id:'country-highlight',type:'line',source:'countries',filter:['==',['get','name'],'§never§'],paint:{'line-color':'#55f2d8','line-width':3,'line-opacity':1}});
        // Tiny sovereign states do not appear in the low-resolution Natural Earth polygon dataset.
        // Provide genuine map-position targets rather than invented polygons.
        map.addSource('microstates',{type:'geojson',data:'/microstates.geojson'});
        map.addLayer({id:'microstates',type:'circle',source:'microstates',paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,3,8,7],
          'circle-color':'#52e7d7','circle-stroke-color':'#0c2b3a','circle-stroke-width':1.4,'circle-opacity':0.94}});
        map.addLayer({id:'microstates-highlight',type:'circle',source:'microstates',filter:['==',['get','name'],'§never§'],
          paint:{'circle-radius':10,'circle-color':'#fff5c5','circle-stroke-color':'#40e1d0','circle-stroke-width':3}});
        map.addSource('regions',{type:'geojson',data:emptyFC as GeoJSON.FeatureCollection});
        map.addLayer({id:'regions-fill',type:'fill',source:'regions',paint:{'fill-color':'#36c6bf','fill-opacity':0.12}});
        map.addLayer({id:'regions-lines',type:'line',source:'regions',paint:{'line-color':'#80e5e0','line-width':1.5}});
        map.addLayer({id:'region-highlight',type:'line',source:'regions',filter:['==',['get','name'],'§never§'],paint:{'line-color':'#5ffde3','line-width':4}});
        map.on('mousemove','countries',e=>{
          if(stageRef.current?.selection!=='country'||disabledRef.current||pickRef.current)return;
          const name=String(e.features?.[0]?.properties?.name||'');setHover(name);setHoverPos([e.point.x,e.point.y]);
          map?.getCanvas().style.setProperty('cursor','pointer');
          if(name)map?.setFilter('country-highlight',['==',['get','name'],name]);
        });
        map.on('mouseleave','countries',()=>{setHover('');map?.getCanvas().style.setProperty('cursor','');map?.setFilter('country-highlight',['==',['get','name'],'§never§']);});
        map.on('click','countries',e=>{
          if(stageRef.current?.selection!=='country'||disabledRef.current||pickRef.current)return;
          if(map?.queryRenderedFeatures(e.point,{layers:['microstates']}).length)return;
          const name=String(e.features?.[0]?.properties?.name||'');if(name)onSelectRef.current?.(name);
        });
        map.on('mousemove','microstates',e=>{
          if(stageRef.current?.selection!=='country'||disabledRef.current||pickRef.current)return;
          const name=String(e.features?.[0]?.properties?.name||'');setHover(name);setHoverPos([e.point.x,e.point.y]);
          map?.getCanvas().style.setProperty('cursor','pointer');
          if(name)map?.setFilter('microstates-highlight',['==',['get','name'],name]);
        });
        map.on('mouseleave','microstates',()=>{setHover('');map?.setFilter('microstates-highlight',['==',['get','name'],'§never§']);});
        map.on('click','microstates',e=>{
          if(stageRef.current?.selection!=='country'||disabledRef.current||pickRef.current)return;
          const name=String(e.features?.[0]?.properties?.name||'');if(name)onSelectRef.current?.(name);
        });
        map.on('mousemove','regions-fill',e=>{
          if(stageRef.current?.selection!=='region'||disabledRef.current||pickRef.current)return;
          const name=String(e.features?.[0]?.properties?.name||'');setHover(name);setHoverPos([e.point.x,e.point.y]);map?.getCanvas().style.setProperty('cursor','pointer');
          if(name)map?.setFilter('region-highlight',['==',['get','name'],name]);
        });
        map.on('mouseleave','regions-fill',()=>{setHover('');map?.getCanvas().style.setProperty('cursor','');map?.setFilter('region-highlight',['==',['get','name'],'§never§']);});
        map.on('click','regions-fill',e=>{
          if(stageRef.current?.selection!=='region'||disabledRef.current||pickRef.current)return;
          const name=String(e.features?.[0]?.properties?.name||'');if(name)onSelectRef.current?.(name);
        });
        map.on('click',e=>{if(pickRef.current)onPickRef.current?.(e.lngLat.lat,e.lngLat.lng)});
        setReady(true);
      });
    }).catch(()=>{setMapError('Unable to initialise the map. Install dependencies and reload.');});
    return()=>{stopped=true;markers.current.forEach(m=>m.remove());markers.current=[];instance?.remove();mapRef.current=null;};
  },[]);
  useEffect(()=>{
    const map=mapRef.current;
    if(!ready||!map)return;
    const active=stage&&!disabled;
    map.setPaintProperty('countries','fill-opacity',active&&stage.selection==='country'?0.17:0.03);
    map.setLayoutProperty('microstates','visibility',active&&stage.selection==='country'?'visible':'none');
    map.setLayoutProperty('microstates-highlight','visibility',active&&stage.selection==='country'?'visible':'none');
    map.setPaintProperty('country-lines','line-opacity',active&&stage.selection==='country'?0.8:0.2);
    map.setLayoutProperty('regions-fill','visibility',active&&stage.selection==='region'?'visible':'none');
    map.setLayoutProperty('regions-lines','visibility',active&&stage.selection==='region'?'visible':'none');
    map.setLayoutProperty('region-highlight','visibility',active&&stage.selection==='region'?'visible':'none');
    map.setPaintProperty('basemap','raster-opacity',detail?1:0.04);
    const point=stage?.center||[-14,27];
    map.flyTo({center:point,zoom:stage?.zoom||1.9,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1050,essential:true});
    clearMarkers();
    if(!active||stage.selection==='country')return;
    if(stage.selection==='region'){
      setWarning('Loading verified administrative boundaries…');
      let cancelled=false;
      // ISO3 is passed explicitly as a server-authorised value; there are no arbitrary external requests.
      const iso=(stage as PublicStage & {countryIso3?:string}).countryIso3||'USA';
      fetch('/api/geo?iso='+encodeURIComponent(iso),{cache:'force-cache'})
        .then(async response=>{if(!response.ok)throw new Error('Official boundaries are not reachable.');return response.json()})
        .then(data=>{if(cancelled||!mapRef.current||stageRef.current?.selection!=='region')return;
          (map.getSource('regions') as GeoJSONSource).setData(data.geojson);
          setWarning('Administrative borders: geoBoundaries · gbOpen');
        }).catch(()=>{if(cancelled)return;
          (map.getSource('regions') as GeoJSONSource).setData(emptyFC as GeoJSON.FeatureCollection);
          setWarning('Boundary service unavailable — select a labelled regional marker instead.');
        });
      // Always show named fallback markers, useful for sparse datasets and keyboard access.
      addChoiceMarkers(stage);
      return()=>{cancelled=true;clearMarkers()};
    }
    setWarning('');
    addChoiceMarkers(stage);
    return()=>clearMarkers();
    function addChoiceMarkers(s:PublicStage){
      import('maplibre-gl').then(({default:gl})=>{
        const currentMap=mapRef.current;
        if(!currentMap||stageRef.current!==s||disabledRef.current)return;
        for(const choice of s.choices){
          const wrap=document.createElement('button');wrap.className='map-choice';wrap.type='button';wrap.setAttribute('aria-label','Select '+choice.name);
          wrap.title=choice.name;wrap.innerHTML=`<span class="map-choice-dot"></span><span class="map-choice-name"></span>`;
          (wrap.querySelector('.map-choice-name') as HTMLElement).textContent=choice.name;
          wrap.addEventListener('pointerenter',()=>setHover(choice.name));wrap.addEventListener('pointerleave',()=>setHover(''));
          wrap.addEventListener('click',e=>{e.stopPropagation();onSelectRef.current?.(choice.name)});
          wrap.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelectRef.current?.(choice.name)}});
          const marker=new gl.Marker({element:wrap,anchor:'center'}).setLngLat([choice.lng,choice.lat]).addTo(currentMap);
          markers.current.push(marker);
        }
      });
    }
  },[ready,stage?.level,stage?.selection,stage?.clue,stage?.center?.[0],stage?.center?.[1],stage?.zoom,disabled,clearMarkers,detail]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map||!selected)return;
    if(stage?.selection==='country')map.setFilter('country-highlight',['==',['get','name'],selected]);
    if(stage?.selection==='region')map.setFilter('region-highlight',['==',['get','name'],selected]);
  },[selected,stage?.selection,ready]);
  const zoom=(n:number)=>mapRef.current?.zoomTo((mapRef.current?.getZoom()||2)+n,{duration:260});
  return <div className="map-root">
    <div ref={holder} className="map-container" aria-label="Interactive geography map" role="application"/>
    <div className="map-vignette" aria-hidden="true"/>
    {hover&&<div className="map-hover-tag" style={{left:hoverPos[0],top:hoverPos[1]}}><span className="mini-pulse"/>{hover}</div>}
    {warning&&stage?.selection==='region'&&<div className="map-boundary-note"><AlertCircle size={13}/>{warning}</div>}
    {mapError&&<div className="map-load-error" role="alert">{mapError}</div>}
    <div className="map-toolbar" aria-label="Map controls">
      <button type="button" onClick={()=>zoom(1)} aria-label="Zoom in"><Plus size={19}/></button>
      <button type="button" onClick={()=>zoom(-1)} aria-label="Zoom out"><Minus size={19}/></button>
      <button type="button" onClick={()=>mapRef.current?.flyTo({center:stage?.center||[-17,24],zoom:stage?.zoom||2,duration:500})} aria-label="Recenter"><LocateFixed size={18}/></button>
      <button type="button" onClick={()=>setDetail(v=>!v)} aria-label={detail?'Hide map detail':'Show map detail'}><Layers size={18}/></button>
    </div>
    <div className="map-corner-title"><Compass size={17}/> {pickMode?'CHOOSE A POSITION':stage?.label?.toUpperCase()||'THE EXPEDITION'}</div>
    {stage&&!disabled&&!pickMode&&<div className="map-action-hint">✦ {stage.selection==='country'?'Hover countries · Click to answer':stage.selection==='region'?'Select a region on the map':'Choose a highlighted location'}</div>}
  </div>
}
