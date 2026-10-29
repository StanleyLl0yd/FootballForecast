# Architecture (M0, public read-only)

Accepted operating mode: unrestricted viewing without user registration for the initial non-commercial prototype. First audience is Russia, then potentially Europe/US. One real Russian home/wired network without VPN passed health/dashboard/archive checks (3/3 HTTP 200 on 2026-10-22); T-Mobile (primarily T2, St Petersburg) and MegaFon mobile networks failed without VPN. Mobile limitations are owner-accepted, non-gating for M0; no claim of nationwide availability or proven network root cause.

```text
Anonymous browser (Russian-language UI)
  -> Vercel Next.js 16 (Frankfurt fra1, publicly reachable)
    -> server-only anonymous Supabase client (publishable API key)
      -> Supabase PostgreSQL 17 (Frankfurt eu-central-1)
         public SELECT: competition, season, teams, matches, forecasts, outcomes
         private: grants, source licenses, raw provider records
    -> /admin: fail-closed until separately approved owner OAuth is configured

Future restricted worker (not enabled): allowlisted jobs -> authorized Python ML core
  -> licensed data source -> provenance -> as-of snapshots -> validation -> training
  -> immutable pre-kickoff forecasts -> calibrated independent evaluation
```

The public browser never receives a service-role key or writes directly to Supabase. Anonymous access is restricted by both SQL privileges and RLS. Owner-only GitHub OAuth is prepared but **not an M0 prerequisite** because there are no live administrative actions and user registration is deferred.

## Boundaries and commitments

- Web: public match/catalog/forecast read paths; render truthful empty/unavailable states and protect the admin route. Heavy model fitting never runs in an HTTP request.
- PostgreSQL: nine RLS-enabled `ff_*` tables. Six public read tables, three private tables. Forecast and outcome rows append-only, with fixture mutation guards.
- Python: deterministic mathematical kernel, isolated from web. Dataset licenses, publication timestamps and temporal cutoff must be verified before any import/training.
- Hosting: Supabase **Free**, Vercel **Hobby** non-commercial, hosted in Frankfurt. No paid additions without explicit owner approval.
- Monitoring: non-gating external production HTTP canary runs in the existing CI, including a live public dashboard REST-read check. That canary alone does not prove Russian ISP reachability, OAuth, multi-browser UX or database restore; the separate owner-observed wired pass and mobile failures are documented above.

## Not yet authorized

No public accounts, user-data profile store, bulk data ingestion, forecasting worker, licensed-feed subscription, production model claims or paid infrastructure. M1 stays blocked until M0 is explicitly accepted.

Contracts remain under `packages/contracts/`; full archival, feature and evaluation semantics are specified in `docs/` and require tests before activation.

### Auth middleware scope (M0)

Next.js `proxy.ts` is matched only for `/admin/:path*`. All public pages, health checks and ordinary visitor requests bypass Supabase OAuth claims refresh, avoiding unnecessary auth overhead and cookie processing. An enabled administrator must still pass independent server-side `requireOwner()` identity verification. The GitHub OAuth capability itself remains disabled until separately approved.
