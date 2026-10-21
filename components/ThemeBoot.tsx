'use client';import {useEffect} from 'react';
export default function ThemeBoot(){useEffect(()=>{try{const t=localStorage.getItem('where7-theme')||'ocean';if(['ocean','atlas','aurora','sunset','midnight'].includes(t))document.documentElement.dataset.atlasTheme=t}catch{}},[]);return null}
