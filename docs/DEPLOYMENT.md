# Deployment and account setup (not completed)

1. Create private GitHub repository `StanleyLl0yd/FootballForecast` and commit this source after review.
2. In a network-enabled environment run `npm install` at repo root, inspect transitive dependencies and audit output, commit the generated `package-lock.json`, then replace CI `npm install` with `npm ci`.
3. In Supabase create a Free project, enable GitHub social login with a registered GitHub OAuth App. Add `https://<your-app-domain>/auth/callback` to Supabase redirect allowlist and configure the GitHub app callback URL exactly as Supabase documents. Avoid broad wildcard redirect patterns.
4. Get numeric GitHub account ID from authenticated `gh api user --jq .id` (not username). Set in **server-only** `APP_OWNER_GITHUB_ID` and a trusted `APP_BASE_URL=https://your-domain` (required to prevent redirects to untrusted hosts). Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel environment (publishable, not service-role). Do not commit `.env.local`.
5. Apply `database/migrations/0001_foundation.sql` through privileged Supabase SQL editor only after reviewing it; verify RLS with unauthenticated and unrelated authenticated users. Provision an owner row in `ff_access_grants` after first OAuth login using trusted SQL admin, not browser-side inserts.
6. Import Vercel project with root `apps/web` and framework Next.js. npm workspaces install requires root lock file; verify Vercel monorepo build path. Configure production URL and test live auth flows.
7. Enable branch protection / ruleset and security scanning when supported. Protect secrets in GitHub Actions and Vercel. Verify exact commit CI, production smoke tests and rollback.

**Status:** GitHub repo missing; Supabase and Vercel not connected to this application; no migration or deployment has occurred. No paid resources should be enabled without explicit consent.

Health endpoint `/api/health` reports only `setup_required` or `configured`, not provider secrets, and it is NOT a DB/live forecasting health probe.
