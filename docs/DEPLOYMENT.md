# Deployment and account setup (not completed)

1. Public GitHub repository `StanleyLl0yd/FootballForecast` and branch protection are already configured. The application itself remains private through authentication.
2. From the repository root use `npm ci` to install exactly the dependency tree recorded in `package-lock.json`. CI and Security use the same command. Review audits before updating the lockfile; use `npm install` only when intentionally changing dependencies.
3. In Supabase create a Free project, enable GitHub social login with a registered GitHub OAuth App. Add `https://<your-app-domain>/auth/callback` to Supabase redirect allowlist and configure the GitHub app callback URL exactly as Supabase documents. Avoid broad wildcard redirect patterns.
4. Get numeric GitHub account ID from authenticated `gh api user --jq .id` (not username). Set in **server-only** `APP_OWNER_GITHUB_ID` and a trusted `APP_BASE_URL=https://your-domain` (required to prevent redirects to untrusted hosts). Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel environment (publishable, not service-role). Do not commit `.env.local`.
5. Apply `database/migrations/0001_foundation.sql` through privileged Supabase SQL editor only after reviewing it; verify RLS with unauthenticated and unrelated authenticated users. Provision an owner row in `ff_access_grants` after first OAuth login using trusted SQL admin, not browser-side inserts.
6. Import Vercel project with root `apps/web` and framework Next.js. npm workspaces install requires root lock file; verify Vercel monorepo build path. Configure production URL and test live auth flows.
7. Keep active ruleset #25266406 and security scanning enabled. Protect secrets in GitHub Actions and Vercel. Verify exact commit CI, production smoke tests and rollback.

**Status:** GitHub source and CI exist; Supabase and Vercel are not connected to this application, and no migration or deployment has occurred. No paid resources should be enabled without explicit consent.

Health endpoint `/api/health` reports only `setup_required` or `configured`, not provider secrets, and it is NOT a DB/live forecasting health probe.
