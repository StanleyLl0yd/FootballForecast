# Hosting and deployment - public M0

## Verified infrastructure

- Repository: `StanleyLl0yd/FootballForecast`, protected `main`, six required exact-head checks.
- Supabase: **Free** project `FootballForecast`, Frankfurt `eu-central-1`, PostgreSQL 17. Migration history: `foundation_m0`, `public_read_m0`, `match_fk_indexes_m0`.
- Vercel: **Hobby** project `footballforecast` connected to GitHub `main`, `apps/web` root, Next.js, npm workspace install `npm ci`, server function region `fra1` (Frankfurt).
- Production: https://footballforecast.vercel.app. Anonymous viewing enabled; Vercel Authentication disabled for production. A GitHub-hosted HTTP canary has verified health, dashboard, matches, archive, data and admin denial; no claim of Russian network reachability.
- Deployment env: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configured on Vercel. These are public/read-only client credentials; never use a service-role key in any browser-facing environment.

## Reproducible build and verification

From the repository root:

```sh
npm ci
npm run lint && npm run typecheck && npm run build
npm run test:auth && npm run test:public-data
npm run smoke:auth
npm run smoke:production
```

The local `smoke:auth` checks fail-closed optional administrator OAuth and public routes under deliberately missing/malformed settings. With Google Chrome installed, `FF_BROWSER_SMOKE=1 npm run smoke:auth` also checks a real browser. The external `smoke:production` runs from GitHub Actions as a **non-gating** production canary, verifying real HTTP responses and successful public Supabase REST reads. Inspect its logs even when CI is green; follow through with exact Vercel deployment SHA and end-to-end manual browser checks.

## Runtime configuration and future administration

The public site does **not** require a GitHub OAuth application, an account or cookies. `/admin` is deny-by-default and does not have enabled write actions. Its optional owner OAuth code requires `APP_OWNER_GITHUB_ID`, a trusted `APP_BASE_URL`, correctly configured Supabase GitHub provider/callback and live negative session tests **before** activation. Registration for regular visitors is intentionally deferred.

Vercel Hobby supports personal non-commercial development; commercial operation requires a separately approved hosting/terms review. On Supabase Free, account for pausing, storage limits and lack of automatic daily backups. Before external/paid usage, verify restore and storage, provider rights and Russian personal-data obligations if user accounts are introduced. Do not enable paid tiers, commercial ingestion or bulk scraping on assumptions.

## Current limitations

The live database is empty (zero imported RPL matches and forecasts); no calibrated model or legal source feed is connected. Monitoring does not prove end-user connectivity from Russia or Firefox/Safari/Edge compatibility. See `ROADMAP.md`, `docs/KNOWN_LIMITATIONS.md` and tracked GitHub issues for unfinished acceptance criteria.
