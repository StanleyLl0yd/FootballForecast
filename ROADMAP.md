# Roadmap

Updated 2026-10-19. Milestone acceptance requires verification, not code presence.

## M0 - Architecture & Web Foundation (OPEN)
- [x] Research preliminary RPL data source coverage and terms; candidates NOT approved.
- [x] Local monorepo and Next.js browser-first design with navigation and honest empty states.
- [x] Initial Python package and deterministic Poisson/scoring math primitives.
- [x] Initial RLS database schema and append-only prediction tables (applied to Free Supabase Frankfurt, with post-deployment verification pending).
- [x] Public read-only dashboard and protected administrator-only route; optional owner OAuth not yet integrated.
- [x] Keep optional OAuth middleware out of public routes and add regression tests for bad visitor cookies.
- [x] Basic CI, Gitleaks v3, npm audit, Dependabot and CodeQL verified on the initial exact-main commit.
- [x] Create public GitHub repo (`StanleyLl0yd/FootballForecast`).
- [x] Publish M0 source through reviewed PR #1; initial exact-main CI, Security and CodeQL PASS.
- [x] Generate and commit a workspace npm lockfile on a network-enabled GitHub runner; install with `npm ci` in CI/Security.
- [x] Run remote web lint, TypeScript typecheck and production build.
- [x] Verify Safari native WebDriver on hosted macOS, plus Firefox/Edge and Chrome in automated cross-browser diagnostics.
- [x] Restore synthetic PostgreSQL 17 schema/data into a **separate** PostgreSQL 17 container on the same CI runner, with SHA-256 agreement and RLS/trigger verification.
- [ ] Prove actual Free-project encrypted offsite backup and independent recovery; synthetic CI restoration does not count.
- [ ] Execute the manually dispatched real publishable-key REST refusal proof; local SQL-denial and mock HTTP tests do not count. Optional OAuth E2E remains deferred until enabled.
- [x] Confirm Firefox and Edge headless cross-browser diagnostics on Ubuntu 24.04: PASS on public dashboard, denied admin and mobile screenshots (PR #35).
- [x] Run unconfigured Next.js browser smoke in real headless Chrome on CI.
- [x] Unit-test stable GitHub identity decisions and negative non-owner/malformed provider cases in CI.
- [x] Add built Next.js production HTTP smoke: unconfigured/invalid-owner environments, protected routes, health and callback denial.
- [x] Exercise the M0 migration and negative RLS / forecast immutability checks against disposable PostgreSQL 17 in CI.
- [x] Configure public Supabase read-only environment; ordinary visitors need no registration.
- [ ] Configure and test optional GitHub owner OAuth only if administrative login is enabled later.
- [x] Apply foundation/public-read migrations to Free Frankfurt Supabase and verify RLS/security advisors.
- [ ] Finish issue #5 only with recorded, successful real PostgREST denial evidence and independently restorable offsite Free database backup.
- [x] Add synthetic PostgreSQL 17 pg_dump/pg_restore round-trip proof in CI, including RLS, data and immutable-archive triggers.
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

- [x] Read published forecast archive (latest 20) through bounded anonymous REST, including revisions, model identity and SHA-256; avoid fictitious rows and distinguish upstream outages.

- [x] Generate TypeScript schema definitions from Frankfurt Supabase and type anonymous public REST clients; validate through required web typecheck/build.

- [x] Align disposable PostgreSQL SQL/RLS/integrity and dump/restore CI with the real Supabase PostgreSQL 17 major release.

- [x] Stabilize Chrome headless DOM smoke (PR #39), then verify exact-head and post-merge web/production-browser checks remain green.

- [x] Add pure offline Football.TXT fixture structural auditor and synthetic CI regression detecting the observed 2023/24 duplicate/missing directed pairing, with no data import or rights approval.

- [x] Stabilize Edge Chromium blank-DOM retry (PR #42) and verify post-merge exact-main browser diagnostics.

## Remaining external M0 acceptance (no M1 transition)

- [ ] #2: authenticated, licensed current RPL feed and defensible historical provenance; 2023/24 OpenFootball source remains quarantined, and all historical seasons remain unapproved for ingestion.
- [ ] #5: live public-key PostgREST negative probe, offsite encrypted Free backup and isolated actual restore.
- [ ] #6: two independent Russian residential/mobile provider network checks without VPN, including total site-load failures.
- [ ] #8: supported patched dependency or documented accepted remediation for the unresolved dev-only `braces` advisory; enforced production audit stays active.

Green CI and Vercel deployment are **necessary but not sufficient** for M0 sign-off. No model training, data import, subscription or M1 work is authorized.
