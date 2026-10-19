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

## Browser network self-check (M0)

The public `/connectivity` page offers a **user-initiated, no-registration GUI** for three fixed *same-origin GET-only* probes: the Vercel health endpoint, the public dashboard and the forecast archive. The last two routes verify whether the **Next.js server can read the anonymous Supabase API**. The browser sends no API keys and does not make a cross-origin request to Supabase, consistent with the server-rendered application architecture. The client displays response statuses and local elapsed time and can copy a short diagnostic report, but it does not send that report or device identifiers to FootballForecast. Normal infrastructure request logs still apply.

To investigate access from Russia, open the **actual site** in a Russian residential or mobile operator network **without VPN**, run the test and preserve the copied report with the operator/city supplied separately by the tester if they consent. Compare at least two independent carriers. A successful GitHub runner, European browser, datacenter proxy, VPN or even one Russian carrier does **not** satisfy cross-operator availability acceptance. If the website itself cannot load, record that as a failed reachability observation: the self-check cannot bootstrap an inaccessible website.

### Autonomous carrier fallback when the main site cannot load

The public static [`m0-carrier-check.html`](../apps/web/public/m0-carrier-check.html) can be **downloaded in advance** from the `/connectivity` GUI and opened locally as a standalone file, without npm, terminal, account, browser extensions, or VPN. It makes a single `GET` to the **pinned** `https://footballforecast.vercel.app/api/health` endpoint, with `credentials: omit`, no redirect, no caching, a 12-second timeout and no key. That one public JSON-only health route sets `Access-Control-Allow-Origin: *` so `file://` browsers can inspect the response without granting CORS access to protected or database routes.

The local tester may optionally enter an operator, city and network type, and attest that VPN/proxy is off. **These are self-reported**, not verified or transmitted; the report is generated and copied locally only. An HTTP 200 with a validated health JSON counts as **health endpoint reachability**, not full HTML rendering, Supabase connectivity or complete no-VPN proof. Network failure and CORS failure may be indistinguishable; raw browser error details, automatic IP/geolocation and tokens are never included.

Capture two independent Russian residential/mobile providers without VPN using both this offline fallback (including FAILs) and, where reachable, full `/connectivity` results and browser screenshots. If the public site cannot load at all, preserve that failure even if an alternate GitHub or VPN connection works. Do not close #6 based solely on offline health PASS, a single provider or CI. No automatic external storage or receipt of reports is implemented.

## Runtime configuration and future administration

The public site does **not** require a GitHub OAuth application, an account or cookies. `/admin` is deny-by-default and does not have enabled write actions. Its optional owner OAuth code requires `APP_OWNER_GITHUB_ID`, a trusted `APP_BASE_URL`, correctly configured Supabase GitHub provider/callback and live negative session tests **before** activation. Registration for regular visitors is intentionally deferred.

Vercel Hobby supports personal non-commercial development; commercial operation requires a separately approved hosting/terms review. On Supabase Free, account for pausing, storage limits and lack of automatic daily backups. Before external/paid usage, verify restore and storage, provider rights and Russian personal-data obligations if user accounts are introduced. Do not enable paid tiers, commercial ingestion or bulk scraping on assumptions.

## Current limitations

The live database is empty (zero imported RPL matches and forecasts); no calibrated model or legal source feed is connected. GitHub Actions browser diagnostics have run Chrome, Firefox, Edge and Safari successfully, but they do not prove end-user connectivity from Russian residential/mobile networks or all client browser combinations. See `ROADMAP.md`, `docs/KNOWN_LIMITATIONS.md` and tracked GitHub issues for unfinished acceptance criteria.
