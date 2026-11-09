# Hosting and deployment — M0/M1 accepted; M2 research open

**M2 authorized on 2026-11-02:** the research implementation is initially offline/synthetic-only; no new database migration, privileged production training worker or public forecast publisher has been deployed. Keep accepted M1 source history, zero-cost protections and browser RLS unchanged. Since the owner decision 2026-11-03, legacy Footbolno schedules/push imports are disabled; the separate OpenFootball calendar-only train-only workflow has no database or holdout access. See [M2 #182](https://github.com/StanleyLl0yd/FootballForecast/issues/182).

**M1 was accepted on 2026-11-02** ([closed #124](https://github.com/StanleyLl0yd/FootballForecast/issues/124)) after full internal technical audits and exact-main Frankfurt production verification. The protected importer ran before the 2026-11-03 Footbolno-free source transition; it is now manual-only. M1 acceptance did not itself enable M2 model publication. The deployment and database counts below are dated operational observations.

## Verified infrastructure

- Repository: `StanleyLl0yd/FootballForecast`, protected `main`, six required exact-head checks.
- Supabase: **Free** project `FootballForecast`, Frankfurt `eu-central-1`, PostgreSQL 17. Migrations `0001`-`0010` are applied; latest `20261030092045_m1_compact_source_observations`. Verified live 2026-11-01: **4 immutable full 720-row snapshots (2880 protected source records)**, 2 compact byte observations, **616 public fixtures (583 finished, 33 scheduled), 7 audited finish transitions, 0 forecasts**. A guarded [protected run #41349407434](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41349407434) updated exactly four safe current-season results on `main=5ce43dfea16074d6234359336df79e993a0523a5`, preserving all four sealed-holdout revisions. No new paid services or anonymous writes.
- Vercel: **Hobby** project `footballforecast` connected to GitHub `main`, `apps/web` root, Next.js, npm workspace install `npm ci`, server function region `fra1` (Frankfurt).
- Production: https://footballforecast.vercel.app. Anonymous viewing enabled; Vercel Authentication disabled for production. A GitHub-hosted HTTP canary verified health, dashboard, matches, archive, data and admin denial; a separate **real Russian wired/home browser no-VPN** report on 2026-10-22 confirmed health/dashboard/archive all HTTP 200. This establishes exactly **one** wired network, not all Russian ISPs or mobile reachability.
- Deployment env: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configured on Vercel. These are public/read-only client credentials; never use a service-role key in any browser-facing environment.

## Reconstructing the M0 application schema and non-secret deployment configuration

The current M0 application schema is **source-controlled**, not backed up as production data:

- PostgreSQL 17 SQL migrations in `database/migrations/0001_foundation.sql`, `0002_public_read.sql`, `0003_match_fk_indexes.sql`, `0004_match_status_scores.sql` (apply **in order** on a freshly provisioned, authorized target with Supabase `auth` roles and `auth.uid()` available). The 0004 migration rejects scores on scheduled/postponed/cancelled fixtures, preserves provisional live and finished/awarded scores, and fails closed on existing incompatible rows. GitHub deploys do **not** apply Supabase SQL automatically; verify live migration history separately.
- Security/ledger assertions in `database/tests/0005_live_anon_posture.sql`, `0006_live_immutable_ledger.sql`, `0007_live_public_surface.sql`. All are read-only; a failed invariant must reject the target.
- Disposable CI installs Supabase role/function stubs only in its **test container** via `database/tests/0000_ci_supabase_stub.sql`. Never deploy these mock roles/functions to real Supabase.
- Deployment reference: Vercel Hobby, source root `apps/web`, Next.js framework, Frankfurt function region `fra1`, linked to protected GitHub `main`; Supabase Free project `FootballForecast`, Frankfurt `eu-central-1`, PostgreSQL 17. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the **new target project** after any disaster, not by reusing stale project URLs.
- `.env.example` lists the web environment variable **names**. `FF_SUPABASE_PUBLISHABLE_KEY` is needed only for optional owner-dispatched live REST proof; this value and all connection/password/age identities stay in protected secret stores, **never** in Git. Public web access does not require OAuth or a service-role key.
- Real Supabase-managed `auth` users, custom instance settings, external secrets, real table rows, data-provider payloads and Storage object bytes are **not** reconstructed by these application migrations. Cloud resources, roles and runtime secrets may need authorized manual re-provisioning.

**2026-10-23 live schema rollout verification:** reviewed source-controlled `0004_match_status_scores.sql` from merged [PR #113](https://github.com/StanleyLl0yd/FootballForecast/pull/113) was applied to the existing Free Frankfurt PostgreSQL 17 project using the tracked Supabase migration `20261023081004_match_status_scores_m0` (no new project/paid resources). Before applying, `ff_matches` had 0 rows and 0 violating fixtures. After applying, `pg_constraint` independently confirmed `ff_matches_status_scores_consistent` exists, is `convalidated=true`, and enforces the exact scheduled/postponed/cancelled NULL-score contract. `ff_matches`, `ff_forecasts`, `ff_source_records` remained at 0 rows. Supabase Security Advisor reported 0 findings. Performance Advisor reported three INFO-level unused FK indexes on the empty matches table, intentionally retained. Exact post-merge [CI](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39921230299), [Security](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39921230295) and [CodeQL](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39921230311) succeeded, and Vercel production was READY at the exact merged SHA `d6c0667a0650488b615f98195eb9f8ee399e52f7`. CI verified the negative mutation test only against disposable PostgreSQL 17; no negative test inserted rows in the live database. This proof does not close the separate source-licensing/data-readiness and full-repository M0 audit gates.

Actual evidence: [exact-main CI run #39764646186](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39764646186) PASSED creating the M0 application schema and testing RLS/triggers on disposable PostgreSQL 17 and separately restoring synthetic schema/data. On 2026-10-22, live Free Supabase contained zero rows in `ff_matches`, `ff_forecasts`, `ff_source_records` and `ff_access_grants` (read-only SQL). These results establish **application-schema reproducibility**, not that a new complete production Supabase tenant could be brought up automatically or that any real data can be restored.

**Owner decision (2026-10-22):** accept the residual risk of total current Free database loss without a production backup. Do not block M0/M1 on real encrypted offsite backup or isolated production restore. Re-evaluate backup needs **after FootballForecast is fully functional** ([issue #96](https://github.com/StanleyLl0yd/FootballForecast/issues/96)); nothing has been backed up in production.

## Production release integrity: read-only drift warning (#266)

On 2026-11-09, a **later Git-triggered Vercel build of an older SHA** reassigned all
three production aliases after the newer audited deployment had already been READY.
The initiating event is unknown; see [#266](https://github.com/StanleyLl0yd/FootballForecast/issues/266)
for timestamped Vercel audit/build evidence. The validated main deployment was manually
re-promoted, without rebuilding or touching private research data.

The scheduled [Production Release Integrity workflow](../.github/workflows/production-release-integrity.yml)
runs hourly (minute 17 UTC), or on owner manual dispatch. It queries the exact protected
GitHub main SHA **before and after** reading all three allowlisted production aliases'
public `/api/health` responses, using no-cache GETs. An absent/malformed SHA,
wrong service, HTTP error, alias disagreement, or main moving during the observation
fails the job, not a silent PASS. This is a diagnostic job, **not** a required
exact-head PR check. Synthetic regression tests include an old-SHA READY build
arriving after a newer release and one secondary alias drifting.

The health JSON's public `releaseCommitSha` comes solely from Vercel's
`VERCEL_GIT_COMMIT_SHA` system environment variable, never from a request or
a database. Vercel documents this variable as available at build/runtime when
system environment variables are exposed. If it is disabled, the monitor deliberately
fails closed. Check Vercel Project Settings → Environment Variables →
*Automatically expose System Environment Variables*; do not add a permanent
GitHub/Vercel token to fix a missing value. GitHub Actions uses only its automatically
scoped read-only `GITHUB_TOKEN`, and no Vercel API token.

An hourly alert **cannot block alias assignment, restore production automatically,
guarantee immediate notification, or establish the initiating cause**. Check the
workflow's failed runs/notification settings. Investigate any failure with the
Vercel deployment API, verifying alias deployment IDs, Git SHA and `fra1` before
a separately reviewed manual promotion. Do not promote a build just because its
self-reported health metadata matches; verify independent Vercel metadata and
protected exact-main checks first. Issue #266 stays open until live observability
and a prevention policy are accepted. This neither closes M2 nor authorizes M3.

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

**M0 scope updated by owner 2026-10-22:** actual website access and all three `/connectivity` HTTP checks **PASS on one Russian wired/home ISP without VPN** are sufficient for the current read-only prototype. The owner provided a real 3/3 PASS report at `2026-10-22T11:33:03.282Z` (health 130 ms, dashboard 368 ms, archive 333 ms; all HTTP 200). **This is not cross-provider or nationwide availability.** Tests from St Petersburg T-Mobile (primarily on T2) and MegaFon mobile without VPN did not load the site; they are recorded as **FAIL**, accepted as a known **non-gating** M0 limitation. The earlier requirement to test and pass on two unrelated operators is superseded for **M0 only**. Do not attribute the mobile failures to white lists, DNS, Vercel blocking or specific network faults without direct evidence. Future mobile/other-carrier coverage may be re-evaluated in issue #6 without forced retesting, paid host changes or blocking M1.

### Autonomous carrier fallback when the main site cannot load

The public static [`m0-carrier-check.html`](../apps/web/public/m0-carrier-check.html) can be **downloaded in advance** from the `/connectivity` GUI and opened locally as a standalone file, without npm, terminal, account, browser extensions, or VPN. It makes a single `GET` to the **pinned** `https://footballforecast.vercel.app/api/health` endpoint, with `credentials: omit`, no redirect, no caching, a 12-second timeout and no key. That one public JSON-only health route sets `Access-Control-Allow-Origin: *` so `file://` browsers can inspect the response without granting CORS access to protected or database routes.

The local tester may optionally enter an operator, city and network type, and attest that VPN/proxy is off. **These are self-reported**, not verified or transmitted; the report is generated and copied locally only. An HTTP 200 with a validated health JSON counts as **health endpoint reachability**, not full HTML rendering, Supabase connectivity or complete no-VPN proof. Network failure and CORS failure may be indistinguishable; raw browser error details, automatic IP/geolocation and tokens are never included.

For further voluntary network diagnostics, preserve negative observations even if GitHub, VPN or another access network succeeds. **The optional two-carrier investigation is no longer an M0 gate under the owner's 2026-10-22 decision**; #6 may stay OPEN as non-gating mobile follow-up. An offline health PASS alone does not prove HTML/browser reachability; one actual owner browser/wired 3/3 report already supplies the revised M0 evidence. No automatic external storage or receipt of reports is implemented.

## Runtime configuration and future administration

The public site does **not** require a GitHub OAuth application, an account or cookies. `/admin` is deny-by-default and does not have enabled write actions. Its optional owner OAuth code requires `APP_OWNER_GITHUB_ID`, a trusted `APP_BASE_URL`, correctly configured Supabase GitHub provider/callback and live negative session tests **before** activation. Registration for regular visitors is intentionally deferred.

Vercel Hobby supports personal non-commercial development; commercial operation requires a separately approved hosting/terms review. On Supabase Free, account for pausing, storage limits and lack of automatic daily backups. Under the owner's current decision, actual backup/restore is deferred until the project is fully functional; acknowledge ongoing risk to all data written before that reassessment. Before external/paid usage, review provider rights, hosting terms and Russian personal-data obligations if user accounts are introduced. Do not enable paid tiers, commercial ingestion or bulk scraping on assumptions.

## Current limitations

The live Supabase database contains a licensed, attributed Footbolno RPL dataset and 616 public canonical fixtures, but still **zero forecasts, no trained/calibrated model and no historical prematch publication proof**. Protected source ingestion is historically verified but presently manual-only; new OpenFootball-first research does not write live rows. Live forecast publication remains disabled. GitHub Actions browser diagnostics have run Chrome, Firefox, Edge and Safari successfully; the **separate actual wired/home Russian no-VPN 3/3 observation PASS** does not generalize to other residential/mobile networks, and T-Mobile/MegaFon mobile failure remains documented. See `ROADMAP.md`, `docs/KNOWN_LIMITATIONS.md` and tracked GitHub issues for unfinished acceptance criteria.
