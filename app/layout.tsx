import {AtlasBackdrop} from '@/components/AtlasArtwork';
import InstallPWA from '@/components/InstallPWA';
import ThemeBoot from '@/components/ThemeBoot';
import type {Metadata,Viewport} from 'next';
// Load MapLibre's defaults first so WHERE7's layout rules take precedence.
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import './premium.css';
export const metadata:Metadata={title:'WHERE7 — Seven clues. One place.',description:'A daily map mystery. Trace the world down to a single building in seven guesses.',applicationName:'WHERE7',manifest:'/manifest.webmanifest',openGraph:{title:'WHERE7 — The Daily Geography Mystery',description:'Seven clues. Seven hearts. One destination.',type:'website'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#061522'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AtlasBackdrop/><ThemeBoot/><InstallPWA/>{children}</body></html>}
