import {NextResponse} from 'next/server';
import {serverClient, ownerAccess, configured} from '@/lib/auth';
export async function GET(request: Request) {
  if (!configured()) return NextResponse.json({error: 'setup_required'}, {status: 503});
  const origin = new URL(process.env.APP_BASE_URL!).origin;
  const code = new URL(request.url).searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login', origin));
  const supabase = await serverClient();
  const {error} = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/login', origin));
  if (!(await ownerAccess())) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/access-denied', origin));
  }
  return NextResponse.redirect(new URL('/dashboard', origin));
}
