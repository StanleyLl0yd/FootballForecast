import {NextResponse} from 'next/server';
import {publicSettingsConfigured} from '@/lib/public-overview';

export const dynamic = 'force-dynamic';
export async function GET() {
  // System-provided deployment identity is public repo metadata, never a secret.
  // Null intentionally causes the separate release-integrity monitor to fail closed.
  const candidate=process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  const releaseCommitSha=/^[0-9a-f]{40}$/.test(candidate) ? candidate : null;
  return NextResponse.json(
    {service:'footballforecast', status: publicSettingsConfigured() ? 'public_configured':'setup_required', releaseCommitSha},
    {headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}}
  );
}
