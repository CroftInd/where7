'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {PublicStage} from '@/lib/types';
import type {Map as MaplibreMap,StyleSpecification,GeoJSONSource} from 'maplibre-gl';
import {Compass,LocateFixed,Plus,Minus,Layers,AlertCircle,RefreshCw} from 'lucide-react';
import {mapCameraOffset,shouldAnimate} from '@/lib/presentation';

type Props={stage:PublicStage|null; disabled?:boolean; onSelect?:(name:string)=>void; pickMode?:boolean; onPick?:(lat:number,lng:number)=>void; selected?:string|null; reduceMotion?:boolean;};
const emptyFC={type:'FeatureCollection',features:[]};
// CARTO basemap key is read automatically at build time from .env.local / Vercel.
const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();
// Restore the original detailed Voyager VECTOR cartography (roads, labels, parks).
// Unlike V15.5, the basemap must never be rendered at 4% opacity.
const CARTO_VECTOR_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const CARTO_STYLE_URL = CARTO_API_KEY
  ? `${CARTO_VECTOR_STYLE}?key=${encodeURIComponent(CARTO_API_KEY)}`
  : CARTO_VECTOR_STYLE;
// A full-colour Voyager raster fallback, not the V15.5 dark_all 4%-opacity fallback.
const BASE_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim() || 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png';
const FALLBACK_TILE = CARTO_API_KEY && BASE_TILE_URL.includes('cartocdn.com')
  ? `${BASE_TILE_URL}${BASE_TILE_URL.includes('?') ? '&' : '?'}key=${encodeURIComponent(CARTO_API_KEY)}`
  : BASE_TILE_URL;
const ATTRIBUTION=process.env.NEXT_PUBLIC_MAP_ATTRIBUTION||'© OpenStreetMap contributors · © CARTO';
export default function MapCanvas({stage,disabled=false,onSelect,pickMode=false,onPick,selected,reduceMotion=false}:Props){
  const holder=useRef<HTMLDivElement>(null);
  const mapRef=useRef<MaplibreMap|null>(null);

  const onSelectRef=useRef(onSelect),onPickRef=useRef(onPick),stageRef=useRef(stage),disabledRef=useRef(disabled),pickRef=useRef(pickMode);
  const [ready,setReady]=useState(false),[warning,setWarning]=useState(''),[hover,setHover]=useState(''),[hoverPos,setHoverPos]=useState<[number,number]>([0,0]),[detail,setDetail]=useState(true);
  const [mapError,setMapError]=useState('');
  const [renderStatus,setRenderStatus]=useState<'loading'|'ready'|'error'>('loading');
  const detailRef=useRef(detail);
  const motionRef=useRef(reduceMotion);
  motionRef.current=reduceMotion;
  detailRef.current=detail;
  onSelectRef.current=onSelect;onPickRef.current=onPick;stageRef.current=stage;disabledRef.current=disabled;pickRef.current=pickMode;
  const clearMarkers=useCallback(()=>{const map=mapRef.current;const source=map?.getSource('choice-points') as GeoJSONSource|undefined;if(source)source.setData(emptyFC as GeoJSON.FeatureCollection)},[]);
  useEffect(()=>{
    if(!holder.current)return;
    let stopped=false;let instance:MaplibreMap|null=null;let teardownExtra=()=>{};
    import('maplibre-gl').then(mod=>{
      if(stopped||!holder.current)return;
      const gl=mod.default;
      // The map container sizing fix from V15.5 stays intact in globals.css.
      // Voyager is the detailed map used before the blank-map repair.
      const fallbackStyle:StyleSpecification={
        version:8,
        sources:{basemap:{type:'raster',tiles:[FALLBACK_TILE],tileSize:256,attribution:ATTRIBUTION}},
        layers:[
          {id:'ocean',type:'background',paint:{'background-color':'#e8f1f3'}},
          {id:'basemap',type:'raster',source:'basemap',paint:{'raster-opacity':1}}
        ]
      };
      const map=new gl.Map({container:holder.current,style:CARTO_STYLE_URL,center:[-17,24],zoom:1.75,minZoom:1,maxZoom:19,attributionControl:false,pitchWithRotate:false,dragRotate:false,touchPitch:false,fadeDuration:80,renderWorldCopies:false,interactive:true});
      instance=map;
      mapRef.current=map;
      map.addControl(new gl.AttributionControl({compact:true}),'bottom-left');
      let layersInitialised=false;
      let fallbackStarted=false;
      let mapStyleTimeout:number|undefined;
      const fallbackToRaster=()=>{
        if(stopped||fallbackStarted||layersInitialised)return;
        fallbackStarted=true;
        setWarning('Detailed vector map unavailable — using Voyager map imagery.');
        map.setStyle(fallbackStyle);
      };
      map.on('error',e=>{
        const message=String(e.error?.message||'');
        console.warn('[WHERE7 map]',message);
        if(/webgl|context lost/i.test(message)){
          setRenderStatus('error');setMapError('The interactive map could not render. Check WebGL / hardware acceleration and retry.');
        }else if(!layersInitialised&&!fallbackStarted&&/style|fetch|network|http|request|load/i.test(message)){
          fallbackToRaster();
        }else if(/tile|fetch|http|network/i.test(message)){
          // Preserve rendered countries/choices even if some external tiles fail.
          setWarning(prev=>prev||'Some map details could not load; selections remain available.');
        }
      });
      // A failed third-party style must not indefinitely block country selection.
      mapStyleTimeout=window.setTimeout(fallbackToRaster,6500);
      // Initialise the game layers on style.load; don't wait for every tile.
      const initialiseLayers=()=>{
        // `style.load` means the style graph is ready for layers. Do not use
        // `isStyleLoaded()` here: it can stay false while raster tiles are failing,
        // which previously prevented ALL interactive sources from being added.
        if(stopped||layersInitialised)return;
        layersInitialised=true;
        if(mapStyleTimeout!==undefined)window.clearTimeout(mapStyleTimeout);
        map.addSource('countries',{type:'geojson',data:'/world-countries.geojson'});
        map.addLayer({id:'countries',type:'fill',source:'countries',paint:{'fill-color':'#31a3aa','fill-opacity':0.12}});
        map.addLayer({id:'country-lines',type:'line',source:'countries',paint:{'line-color':'#238d9d','line-opacity':0.72,'line-width':['interpolate',['linear'],['zoom'],1,0.45,5,1.4]}});
        map.addLayer({id:'country-highlight',type:'line',source:'countries',filter:['==',['get','name'],'§never§'],paint:{'line-color':'#55f2d8','line-width':3,'line-opacity':1}});
        // Tiny sovereign states do not appear in the low-resolution Natural Earth polygon dataset.
        // Provide genuine map-position targets rather than invented polygons.
        map.addSource('microstates',{type:'geojson',data:'/microstates.geojson'});
        map.addLayer({id:'microstates',type:'circle',source:'microstates',paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,3,8,7],
          'circle-color':'#52e7d7','circle-stroke-color':'#0c2b3a','circle-stroke-width':1.4,'circle-opacity':0.94}});
        map.addLayer({id:'microstates-highlight',type:'circle',source:'microstates',filter:['==',['get','name'],'§never§'],
          paint:{'circle-radius':10,'circle-color':'#fff5c5','circle-stroke-color':'#40e1d0','circle-stroke-width':3}});
        // Draw choices in WebGL rather than as DOM markers. They remain locked to
        // geographical coordinates on every pan/zoom frame, including touch gestures.
        map.addSource('choice-points',{type:'geojson',data:emptyFC as GeoJSON.FeatureCollection});
        map.addLayer({id:'choice-halo',type:'circle',source:'choice-points',paint:{'circle-radius':16,'circle-color':'#3be6ce','circle-opacity':0.17}});
        map.addLayer({id:'choice-dots',type:'circle',source:'choice-points',paint:{'circle-radius':['interpolate',['linear'],['zoom'],2,8,13,12],'circle-color':'#a8fff1','circle-stroke-color':'#073343','circle-stroke-width':3}});
        map.addLayer({id:'choice-selected-ring',type:'circle',source:'choice-points',filter:['==',['get','name'],'§never§'],paint:{'circle-radius':17,'circle-color':'#d9fffb','circle-opacity':0.2,'circle-stroke-color':'#50efd7','circle-stroke-width':3}});
        map.addLayer({id:'choice-labels',type:'symbol',source:'choice-points',layout:{'text-field':['get','name'],'text-size':12,'text-font':['Open Sans Regular'],'text-offset':[0,-1.8],'text-anchor':'bottom','text-allow-overlap':false},paint:{'text-color':'#ffffff','text-halo-color':'#092737','text-halo-width':2.5}});
        const pickChoice=(e:any)=>{if(disabledRef.current||pickRef.current)return;const name=String(e.features?.[0]?.properties?.name||'');if(name)onSelectRef.current?.(name)};
        map.on('click','choice-dots',pickChoice);
        map.on('click','choice-labels',pickChoice);
        for(const layer of ['choice-dots','choice-labels']){
          map.on('mouseenter',layer,()=>{map.getCanvas().style.cursor='pointer'});
          map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor=''});
        }
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
        // Gameplay is available before any external raster tiles are fetched.
        setRenderStatus('ready');setMapError('');setReady(true);
        requestAnimationFrame(()=>{if(!stopped)map.resize()});
      };
      map.on('style.load',initialiseLayers);
      map.on('load',initialiseLayers);
      // Handle a synchronous style event or a missed callback during hydration.
      if(map.isStyleLoaded())initialiseLayers();
      const observer=new ResizeObserver(()=>map.resize());
      observer.observe(holder.current);
      const firstResize=window.setTimeout(()=>{if(!stopped)map.resize()},200);
      const onVisible=()=>{if(!document.hidden&&!stopped)map.resize()};
      document.addEventListener('visibilitychange',onVisible);
      // Remove observers even if React unmounts before style.load.
      teardownExtra=()=>{observer.disconnect();window.clearTimeout(firstResize);if(mapStyleTimeout!==undefined)window.clearTimeout(mapStyleTimeout);document.removeEventListener('visibilitychange',onVisible)};
    }).catch(error=>{console.error('[WHERE7 map initialization]',error);setRenderStatus('error');setMapError('Unable to initialise the map. Try reloading this page.');});
    return()=>{stopped=true;teardownExtra();instance?.remove();mapRef.current=null;};
  },[]);
  useEffect(()=>{
    const map=mapRef.current;
    if(!ready||!map)return;
    const mapInstance=map; // Capture the non-null map for nested callbacks.
    // Busy submissions disable interaction, not rendering; do not clear markers.
    const active=stage!==null;
    map.setPaintProperty('countries','fill-opacity',detailRef.current?(active&&stage.selection==='country'?0.14:0.025):0.025);
    map.setLayoutProperty('microstates','visibility',active&&stage.selection==='country'?'visible':'none');
    map.setLayoutProperty('microstates-highlight','visibility',active&&stage.selection==='country'?'visible':'none');
    map.setPaintProperty('country-lines','line-opacity',detailRef.current?(active&&stage.selection==='country'?0.78:0.22):0.10);
    map.setLayoutProperty('regions-fill','visibility',active&&stage.selection==='region'?'visible':'none');
    map.setLayoutProperty('regions-lines','visibility',active&&stage.selection==='region'?'visible':'none');
    map.setLayoutProperty('region-highlight','visibility',active&&stage.selection==='region'?'visible':'none');

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
      const source=mapInstance.getSource('choice-points') as GeoJSONSource|undefined;
      if(!source)return;
      source.setData({type:'FeatureCollection',features:s.choices.map(choice=>({type:'Feature',properties:{name:choice.name,id:choice.id},geometry:{type:'Point',coordinates:[choice.lng,choice.lat]}}))} as GeoJSON.FeatureCollection);
    }

  },[ready,stage?.level,stage?.selection,stage?.clue,stage?.center?.[0],stage?.center?.[1],stage?.zoom,clearMarkers]);
  // Keep ALL five legitimate candidates on screen. Previously, flying directly
  // to the correct answer could hide distractors and effectively reveal the solution.
  const frameStage=()=>{
    const map=mapRef.current;if(!ready||!map||pickMode)return;
    const candidates=stage?.selection!=='country' ? stage?.choices?.filter(c=>
      Number.isFinite(c.lat)&&Number.isFinite(c.lng)&&Math.abs(c.lat)<=90&&Math.abs(c.lng)<=180) : [];
    const duration=shouldAnimate(motionRef.current)?750:0;
    if(candidates&&candidates.length>=2){
      const minLng=Math.min(...candidates.map(c=>c.lng)),maxLng=Math.max(...candidates.map(c=>c.lng));
      const minLat=Math.min(...candidates.map(c=>c.lat)),maxLat=Math.max(...candidates.map(c=>c.lat));
      if(maxLng-minLng>0.00001||maxLat-minLat>0.00001){
        const isDesktop=map.getContainer().clientWidth>900;
        const padding=isDesktop?{top:74,right:56,bottom:80,left:430}:{top:93,right:35,bottom:190,left:35};
        map.fitBounds([[minLng,minLat],[maxLng,maxLat]],{padding,maxZoom:stage?.zoom||17,duration,essential:false});
        return;
      }
    }
    map.flyTo({center:stage?.center||[-14,27],zoom:stage?.zoom||1.9,
      offset:mapCameraOffset(map.getContainer().clientWidth,false),duration,essential:false});
  };
  // Change framing only when the stage/options change, not during submissions.
  useEffect(frameStage,[ready,stage?.level,stage?.center?.[0],stage?.center?.[1],stage?.zoom,stage?.choices,pickMode]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    if(stage?.selection==='country')map.setFilter('country-highlight',['==',['get','name'],selected||'§never§']);
    if(stage?.selection==='region')map.setFilter('region-highlight',['==',['get','name'],selected||'§never§']);
    if(map.getLayer('choice-selected-ring'))map.setFilter('choice-selected-ring',['==',['get','name'],selected||'§never§']);
  },[selected,stage?.selection,ready]);
  useEffect(()=>{
    const map=mapRef.current;if(!ready||!map)return;
    // The Layers button now toggles the highlighted borders, not the actual map.
    // It must never turn streets/place names almost invisible again.
    if(map.getLayer('countries'))map.setPaintProperty('countries','fill-opacity',detail?(stage?.selection==='country'?0.14:0.025):0.025);
    if(map.getLayer('country-lines'))map.setPaintProperty('country-lines','line-opacity',detail?(stage?.selection==='country'?0.78:0.22):0.10);
  },[ready,detail,stage?.selection]);
  const zoom=(n:number)=>mapRef.current?.zoomTo((mapRef.current?.getZoom()||2)+n,{duration:shouldAnimate(reduceMotion)?260:0});
  const recenter=()=>{if(pickMode){const map=mapRef.current;map?.flyTo({center:stage?.center||[-17,24],zoom:stage?.zoom||2,duration:shouldAnimate(reduceMotion)?620:0});return;}frameStage();};
  return <div className="map-root">
    <div ref={holder} className="map-container" aria-label="Interactive geography map. Select a location, then confirm your guess." role="application"/>
    <div className="map-vignette" aria-hidden="true"/>
    {hover&&<div className="map-hover-tag" style={{left:hoverPos[0],top:hoverPos[1]}}><span className="mini-pulse"/>{hover}</div>}
    {warning&&<div className="map-boundary-note"><AlertCircle size={13}/>{warning}</div>}
    {renderStatus==='loading'&&<div className="map-render-loading" role="status"><div className="loading-orb"/><span>Loading your interactive atlas…</span></div>}
    {mapError&&<div className="map-load-error" role="alert"><AlertCircle size={20}/><span>{mapError}</span><button type="button" onClick={()=>window.location.reload()}><RefreshCw size={15}/> Retry</button></div>}
    <div className="map-toolbar" aria-label="Map controls">
      <button type="button" onClick={()=>zoom(1)} aria-label="Zoom in"><Plus size={19}/></button>
      <button type="button" onClick={()=>zoom(-1)} aria-label="Zoom out"><Minus size={19}/></button>
      <button type="button" onClick={recenter} aria-label="Recenter"><LocateFixed size={18}/></button>
      <button type="button" onClick={()=>setDetail(v=>!v)} aria-label={detail?'Reduce country border highlights':'Show country border highlights'} title="Toggle border highlights"><Layers size={18}/></button>
    </div>
    <div className="map-corner-title"><Compass size={17}/> {pickMode?'CHOOSE A POSITION':stage?.label?.toUpperCase()||'THE EXPEDITION'}</div>
    {stage&&!disabled&&!pickMode&&<div className="map-action-hint">✦ {stage.selection==='country'?'Tap or click a country to preview':stage.selection==='region'?'Select a region or marker to preview':'Choose a marker, then confirm your guess'}</div>}
  </div>
}
