'use client';
import {useEffect,useRef,useState} from 'react';
import gl,{type Map as GLMap,type Marker,type StyleSpecification} from 'maplibre-gl';
import {Crosshair,MapPinned} from 'lucide-react';
type Props={lat:number;lng:number;onChange:(lat:number,lng:number)=>void};
const style:StyleSpecification={version:8,sources:{voyager:{type:'raster',tiles:['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],tileSize:256,attribution:'© OpenStreetMap contributors · CARTO'}},layers:[{id:'basemap',type:'raster',source:'voyager'}]};
export default function CoordinatePicker({lat,lng,onChange}:Props){
 const target=useRef<HTMLDivElement>(null),mapRef=useRef<GLMap|null>(null),markerRef=useRef<Marker|null>(null),changeRef=useRef(onChange),[failed,setFailed]=useState(false);
 changeRef.current=onChange;
 useEffect(()=>{
  if(!target.current)return;
  let map:GLMap|undefined;
  try{
   map=new gl.Map({container:target.current,style,center:[Math.max(-180,Math.min(180,lng)),Math.max(-90,Math.min(90,lat))],zoom:9,minZoom:1,maxZoom:19});
   mapRef.current=map;
   const marker=new gl.Marker({draggable:true,color:'#ffb86c'}).setLngLat([lng,lat]).addTo(map);
   markerRef.current=marker;
   marker.on('dragend',()=>{const v=marker.getLngLat();changeRef.current(Number(v.lat.toFixed(6)),Number(v.lng.toFixed(6)))});
   map.on('click',e=>{marker.setLngLat(e.lngLat);changeRef.current(Number(e.lngLat.lat.toFixed(6)),Number(e.lngLat.lng.toFixed(6)))});
   map.on('error',()=>setFailed(true));
  }catch{setFailed(true)}
  return()=>{markerRef.current?.remove();map?.remove();mapRef.current=null;markerRef.current=null};
  // Keep the map instance stable while text inputs update independently.
 },[]);
 useEffect(()=>{
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return;
  markerRef.current?.setLngLat([lng,lat]);
 },[lat,lng]);
 return <section className="studio-coordinate">
  <div><MapPinned size={16}/><b>Coordinate picker</b><span>Click the map or drag the pin</span></div>
  <div ref={target} className="studio-coordinate-map" role="application" aria-label="Interactive map coordinate picker"/>
  {failed&&<p>Some map tiles could not load. You can still enter coordinates manually above.</p>}
  <button type="button" className="secondary-action" onClick={()=>{if(Number.isFinite(lat)&&Number.isFinite(lng))mapRef.current?.flyTo({center:[lng,lat],zoom:12})}}><Crosshair size={15}/> Centre on coordinates</button>
 </section>
}
