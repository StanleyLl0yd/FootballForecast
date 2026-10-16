# Roadmap

Updated 2026-10-16. Milestone acceptance requires verification, not code presence.

## M0 - Architecture & Web Foundation (OPEN)
- [x] Research preliminary RPL data source coverage and terms; candidates NOT approved.
- [x] Local monorepo and Next.js browser-first design with navigation and honest empty states.
- [x] Initial Python package and deterministic Poisson/scoring math primitives.
- [x] Initial RLS database schema and append-only prediction tables (NOT applied).
- [x] Next.js Supabase OAuth owner-gate implementation (NOT integration-tested).
- [x] Basic CI, Gitleaks v3, npm audit, Dependabot and CodeQL verified on the initial exact-main commit.
- [x] Create public GitHub repo (`StanleyLl0yd/FootballForecast`).
- [x] Publish M0 source through reviewed PR #1; initial exact-main CI, Security and CodeQL PASS.
- [x] Generate and commit a workspace npm lockfile on a network-enabled GitHub runner; install with `npm ci` in CI/Security.
- [x] Run remote web lint, TypeScript typecheck and production build.
- [ ] Run real browser smoke, OAuth E2E and Supabase-specific authorization tests.
- [x] Exercise the M0 migration and negative RLS / forecast immutability checks against disposable PostgreSQL 16 in CI.
- [ ] Configure Supabase, GitHub OAuth and owner stable provider ID.
- [ ] Apply and test migration, permissions and backup.
- [ ] Connect and verify Vercel deployment, production auth, browser compatibility.
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
