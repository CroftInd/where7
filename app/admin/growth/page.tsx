import {requireAdmin} from '@/lib/supabase';
import Link from 'next/link';import GrowthClient from '@/components/GrowthClient';
export const dynamic='force-dynamic';
export const metadata={title:'WHERE7 Growth Analytics · Admin'};
export default async function GrowthPage(){
 if(!(await requireAdmin()))return <main style={{padding:32}}><h1>Admin access required</h1><Link href="/">Return to WHERE7</Link></main>;
 return <GrowthClient/>;
}
