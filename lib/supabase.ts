import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const cloudReady = Boolean(url && anon && service);

export function serviceDb() {
  if (!url || !service) return null;
  return createServiceClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function authClient() {
  if (!url || !anon) return null;
  const jar = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(changes: { name: string; value: string; options?: Parameters<typeof jar.set>[2] }[]) {
        try {
          changes.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Cookie writes are unavailable in read-only Server Components.
        }
      },
    },
  });
}

export async function requireAdmin() {
  const client = await authClient();
  if (!client) return false;
  const { data: { user }, error } = await client.auth.getUser();
  const permitted = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const allowedUserId = (process.env.ADMIN_USER_ID || '').trim();
  // Restrict to one exact Supabase Auth user ID when configured.
  return !error && !!user?.email && permitted.includes(user.email.toLowerCase())
    && (!allowedUserId || user.id === allowedUserId);
}
