import {requireAdmin} from '@/lib/supabase';
import Link from 'next/link';
import SponsorsAdmin from '@/components/SponsorsAdmin';
export const dynamic='force-dynamic';
export const metadata={title:'WHERE7 Partner Campaigns · Admin'};
export default async function PartnerAdmin(){
 if(!(await requireAdmin()))return <main style={{padding:30}}><h1>Admin access required</h1><Link href="/">Back to WHERE7</Link></main>;
 return <SponsorsAdmin/>;
}
