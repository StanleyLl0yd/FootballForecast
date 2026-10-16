import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasOwnerGitHubIdentity } from './owner-identity';

export function configured(): boolean {
  let trustedUrl = false;
  try {
    const url = new URL(process.env.APP_BASE_URL ?? '');
    trustedUrl = (url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:')) && !url.username && !url.password;
  } catch { /* Empty or invalid base URL is a configuration error. */ }
  return Boolean(trustedUrl && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && /^[1-9]\d*$/.test(process.env.APP_OWNER_GITHUB_ID ?? ''));
}

export async function serverClient() {
  if (!configured()) throw new Error('Authentication is not configured');
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        try { values.forEach(({name, value, options}) => cookieStore.set(name, value, options)); }
        catch { /* Server Components are read-only; proxy.ts refreshes tokens. */ }
      }
    }
  });
}

export async function ownerAccess(): Promise<boolean> {
  if (!configured()) return false;
  const supabase = await serverClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  return hasOwnerGitHubIdentity(data.user.identities, process.env.APP_OWNER_GITHUB_ID);
}

export async function requireOwner() {
  if (!configured()) redirect('/setup');
  if (!(await ownerAccess())) redirect('/login');
}
