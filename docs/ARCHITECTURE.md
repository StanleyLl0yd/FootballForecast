# Architecture (M0 ADR)

Date 2026-10-16. Decision: browser-first monorepo, reusable ML core, async jobs outside request handlers.

```
Browser (private, Russian UI)
    | Supabase GitHub OAuth / cookie session
Next.js 16 (Vercel; auth checked per protected route)
    | row-filtered read access (Supabase anon/publishable key)
Supabase Postgres (RLS; time-aware records; append-only forecasts)
    ^
Worker boundary (future): dispatch allowlisted work → GitHub Actions
    | verified runner identity, service secret inaccessible to browser
Python core: legal adapter → validation → snapshot → features → train/test → forecast
    | signed/hashed outputs, immutable IDs
Object storage for snapshots and model artifacts (future, private)
```

Client and ML contracts are versioned JSON Schema documents under `packages/contracts/`. The `forecast-v1` example is an initial subset, not a full publication contract. Never compute ML training in HTTP handlers. Application and worker protocol to be designed after RLS and hosting are verified.

#### Separation of responsibilities

- Web: authentication, UI, authorized read, job state (later), no model fitting.
- Postgres: metadata, source provenance, protected analytics, immutable predictions. No raw dataset in Git.
- Python: validation and deterministic computation. Historical inputs must be reconstructed from data available as-of forecast time.
- Runner: ephemeral and replaceable behind a job protocol, initially proposed GitHub Actions. Signed callback or trusted server-side polling required.

#### Security constraints

Private deployment is protected **at application layer** even if URL is known. Multi-user RBAC is designed, not implemented. No payment or betting-account APIs. Service credential isolated to future worker. Fallback on missing config is denial, not a public fake dashboard.

#### Hosting risk

Vercel Hobby only supports non-commercial personal use; Supabase free projects may pause after low usage. Public repository workflows using standard GitHub-hosted runners are subject to GitHub Actions acceptable-use and job limits. Evaluate an inexpensive paid runner only after consent.

Sources: https://vercel.com/docs/plans/hobby ; https://supabase.com/docs/guides/platform/free-project-pausing ; https://docs.github.com/en/billing/concepts/product-billing/github-actions
