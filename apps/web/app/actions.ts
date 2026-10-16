'use server';
import {redirect} from 'next/navigation';
import {configured, serverClient} from '@/lib/auth';
export async function signOut() {
  if (configured()) {const client = await serverClient(); await client.auth.signOut();}
  redirect('/login');
}
