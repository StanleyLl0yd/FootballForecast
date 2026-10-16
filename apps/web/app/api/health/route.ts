import {NextResponse} from 'next/server';
import {configured} from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({service: 'footballforecast', status: configured() ? 'configured' : 'setup_required'}, {headers: {'Cache-Control': 'no-store'}});
}
