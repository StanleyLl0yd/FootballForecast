# Roadmap

Updated 2026-10-16. Milestone acceptance requires verification, not code presence.

## M0 - Architecture & Web Foundation (OPEN)
- [x] Research preliminary RPL data source coverage and terms; candidates NOT approved.
- [x] Local monorepo and Next.js browser-first design with navigation and honest empty states.
- [x] Initial Python package and deterministic Poisson/scoring math primitives.
- [x] Initial RLS database schema and append-only prediction tables (applied to Free Supabase Frankfurt, with post-deployment verification pending).
- [x] Public read-only dashboard and protected administrator-only route; optional owner OAuth not yet integrated.
- [x] Basic CI, Gitleaks v3, npm audit, Dependabot and CodeQL verified on the initial exact-main commit.
- [x] Create public GitHub repo (`StanleyLl0yd/FootballForecast`).
- [x] Publish M0 source through reviewed PR #1; initial exact-main CI, Security and CodeQL PASS.
- [x] Generate and commit a workspace npm lockfile on a network-enabled GitHub runner; install with `npm ci` in CI/Security.
- [x] Run remote web lint, TypeScript typecheck and production build.
- [ ] Run Safari/Firefox/Edge browser tests, restore drill, and direct negative Supabase REST tests; real OAuth E2E deferred until admin login is approved.
- [x] Run unconfigured Next.js browser smoke in real headless Chrome on CI.
- [x] Unit-test stable GitHub identity decisions and negative non-owner/malformed provider cases in CI.
- [x] Add built Next.js production HTTP smoke: unconfigured/invalid-owner environments, protected routes, health and callback denial.
- [x] Exercise the M0 migration and negative RLS / forecast immutability checks against disposable PostgreSQL 16 in CI.
- [x] Configure public Supabase read-only environment; ordinary visitors need no registration.
- [ ] Configure and test optional GitHub owner OAuth only if administrative login is enabled later.
- [x] Apply foundation/public-read migrations to Free Frankfurt Supabase and verify RLS/security advisors.
- [ ] Verify REST negative-write attempts with a real publishable key and backup/restore against an independently isolated real Free/PostgreSQL 17 instance.
- [x] Add synthetic PostgreSQL 16 pg_dump/pg_restore round-trip proof in CI, including RLS, data and immutable-archive triggers.
- [x] Apply and verify all three FK indexes; performance advisor no longer reports unindexed FKs.
- [x] Deploy public Vercel Hobby to Frankfurt from protected GitHub main and verify anonymous pages/admin redirect from GitHub Actions.
- [ ] Verify reachability from Russian networks without VPN and Safari/Firefox/Edge browser behavior.
- [x] Connect public read-only dashboard/matches to Supabase REST via publishable key with unconfigured/error/empty states and mocked REST contract tests.
- [x] Verify live anonymous Supabase REST via production dashboard and external GitHub Actions HTTP canary.
- [ ] Verify Russian operator network reachability separately.
- [ ] Confirm data acquisition and storage/distribution permissions in writing where necessary.
- [x] Create M0 GitHub issues and activate main ruleset #25266406 (six required checks, no mandatory reviewers).
- [x] Verify protected PR merges #15 and #16 and exact-head/post-merge CI/Security/CodeQL.

## M1 - Data Foundation (BLOCKED by M0 acceptance)
Licensed adapters, provenance, normalized seasons and teams, timestamp checks, data center and sync.

## M2 - Statistical Baselines
Train Poisson/Dixon-Coles/Elo on proven historical data; strict chronological walk-forward; view results in browser.

## M3 - Calibration & Evaluation
Independent calibration validation, Log Loss, Brier, RPS, uncertainty and baseline comparisons.

## M4 - Production Forecasting
Immutable revisions, scheduled match updates, browser-triggered jobs, Zenit reports only for corresponding RPL fixtures, reliable monitoring.

## M5 - Advanced Models
CatBoost, validated ensembles, champion/challenger and market comparison if data and rights permit.

## M6 - Multiple Leagues
Generic adapters and independently evaluated league-specific workflows.
