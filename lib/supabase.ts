import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
export const cloudReady=Boolean(url&&anon&&service);
export function serviceDb(){
  if(!cloudReady)return null;
  return createServiceClient(url!,service!,{auth:{autoRefreshToken:false,persistSession:false}});
}
export async function authClient(){
  if(!url||!anon)return null;
  const jar=await cookies();
  return createServerClient(url,anon,{cookies:{getAll(){return jar.getAll()},setAll(
  changes: {
    name: string;
    value: string;
    options?: Parameters<typeof jar.set>[2];
  }[]
) {
  try {
    changes.forEach(({ name, value, options }) =>
      jar.set(name, value, options)
    );
  } catch {
    // Read-only Server Component.
  }
}
    try{changes.forEach(({name,value,options})=>jar.set(name,value,options))}catch{/* read-only server component */}
  }}});
}
export async function requireAdmin(){
  const client=await authClient();
  if(!client)return false;
  const {data:{user},error}=await client.auth.getUser();
  const permitted=(process.env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  return !error&&!!user?.email&&permitted.includes(user.email.toLowerCase());
}
