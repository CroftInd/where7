import Link from 'next/link';
import {ArrowLeft,Compass,Gift} from 'lucide-react';
import ProgressionClient from '@/components/ProgressionClient';
export const metadata={title:'Explorer Passport & Rewards | WHERE7',description:'Complete daily geography missions, earn XP, protect your streak and collect WHERE7 badges.'};
export default function RewardsPage(){return <main className="rewards-page"><header className="rewards-page-header"><Link href="/" className="rewards-page-brand"><Compass size={24}/><strong>WHERE<span>7</span></strong></Link><div className="rewards-page-label"><Gift size={19}/><span>REWARDS & PROGRESSION</span></div><Link href="/" className="rewards-page-back"><ArrowLeft size={16}/> Back to map</Link></header><div className="rewards-page-main"><ProgressionClient/></div></main>}
