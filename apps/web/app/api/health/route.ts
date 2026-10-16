import {NextResponse} from 'next/server';
import {publicSettingsConfigured} from '@/lib/public-overview';

export const dynamic = 'force-dynamic';
export async function GET() {
  // Public app readiness is independent of optional, disabled owner OAuth.
  return NextResponse.json(
    {service:'footballforecast', status: publicSettingsConfigured() ? 'public_configured':'setup_required'},
    {headers:{'Cache-Control':'no-store'}}
  );
}
