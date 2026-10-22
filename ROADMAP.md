# Roadmap

Updated 2026-10-22. Milestone acceptance requires verification, not code presence.

## M0 - Architecture & Web Foundation (OPEN)
- [x] Research preliminary RPL data source coverage and terms; candidates NOT approved.
- [x] Add browser-only, on-demand Footbolno `235-matches.csv` structural consistency checks for three approved RPL seasons (strict streaming cap, one CSV GET, no persistence or ML).
- [x] Enable bounded, on-demand read-only Footbolno and SportScore browser research previews with immediate attribution; no vendor correspondence needed for the publicly permitted preview tier, no raw DB writes or ML.
- [x] Local monorepo and Next.js browser-first design with navigation and honest empty states.
- [x] Initial Python package and deterministic Poisson/scoring math primitives.
- [x] Initial RLS database schema and append-only prediction tables applied to Free Supabase Frankfurt, with live catalog and REST refusal verification.
- [x] Public read-only dashboard and protected administrator-only route; optional owner OAuth not yet integrated.
- [x] Keep optional OAuth middleware out of public routes and add regression tests for bad visitor cookies.
- [x] Basic CI, Gitleaks v3, npm audit, Dependabot and CodeQL verified on the initial exact-main commit.
- [x] Create public GitHub repo (`StanleyLl0yd/FootballForecast`).
- [x] Publish M0 source through reviewed PR #1; initial exact-main CI, Security and CodeQL PASS.
- [x] Generate and commit a workspace npm lockfile on a network-enabled GitHub runner; install with `npm ci` in CI/Security.
- [x] Run remote web lint, TypeScript typecheck and production build.
- [x] Verify Safari native WebDriver on hosted macOS, plus Firefox/Edge and Chrome in automated cross-browser diagnostics.
- [x] On exact-main [CI #39764646186](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39764646186), reapply source-controlled migrations `0001`-`0003` to disposable PostgreSQL 17 and verify RLS, catalog, triggers and indexes; independently restore **synthetic** encrypted schema/data into a second PostgreSQL 17 container on the same runner, with SHA-256 agreement. Supabase-managed services/real production rows are outside this proof.
- [x] **2026-10-22 owner decision:** accept loss risk for the current near-empty Free prototype, verify source-controlled application schema rebuild and non-secret deployment configuration instead. Actual encrypted offsite backup/recovery is explicitly **deferred until FootballForecast is fully functional**, tracked in #96; it is **not an M0/M1 gate**. Synthetic CI restoration is not production recovery.
- [x] **2026-10-22 LIVE PASS:** manually dispatched [real publishable-key REST refusal proof](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39763464499/job/119773072854) on exact-main `2d307fbf9159d063b3ee914c8cb65c64ec4a14a0`: 1 allowed GET HTTP 200, 7 SQLSTATE 42501-denied HTTP 401 operations. Local mocks alone do not count. Optional OAuth E2E remains deferred until enabled.
- [x] Confirm Firefox and Edge headless cross-browser diagnostics on Ubuntu 24.04: PASS on public dashboard, denied admin and mobile screenshots (PR #35).
- [x] Run unconfigured Next.js browser smoke in real headless Chrome on CI.
- [x] Unit-test stable GitHub identity decisions and negative non-owner/malformed provider cases in CI.
- [x] Add built Next.js production HTTP smoke: unconfigured/invalid-owner environments, protected routes, health and callback denial.
- [x] Exercise the M0 migration and negative RLS / forecast immutability checks against disposable PostgreSQL 17 in CI.
- [x] Configure public Supabase read-only environment; ordinary visitors need no registration.
- [ ] Configure and test optional GitHub owner OAuth only if administrative login is enabled later.
- [x] Apply foundation/public-read migrations to Free Frankfurt Supabase and verify RLS/security advisors.
- [x] Finish #5's M0 application-schema/reproducible-migrations and real PostgREST authorization acceptance, backed by successful PostgreSQL 17 CI and live REST evidence. Owner deliberately moved **real offsite backup/restore** to non-gating #96, without claiming production data recovery.
- [x] Add synthetic PostgreSQL 17 pg_dump/pg_restore round-trip proof in CI, including RLS, data and immutable-archive triggers.
- [x] Apply and verify all three FK indexes; performance advisor no longer reports unindexed FKs.
- [x] Deploy public Vercel Hobby to Frankfurt from protected GitHub main and verify anonymous pages/admin redirect from GitHub Actions.
- [x] **2026-10-22 owner-approved M0 scope:** actual Russian home/wired Internet **without VPN** confirmed the live public health, dashboard and archive **3/3 HTTP 200 PASS**; hosted Safari/Firefox/Edge/Chrome compatibility PASS. Two failed St Petersburg mobile operators are explicitly documented but **non-gating** for M0 (#6 follow-up).
- [x] Connect public read-only dashboard/matches to Supabase REST via publishable key with unconfigured/error/empty states and mocked REST contract tests.
- [x] Verify live anonymous Supabase REST via production dashboard and external GitHub Actions HTTP canary.
- [x] Verify **one real Russian home/wired network** separately from GitHub runners: owner browser report 2026-10-22 11:33:03 UTC; API 130 ms, dashboard 368 ms, archive 333 ms, all HTTP 200. This checks only the observed network, not universal access or Russian mobile service.
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

The reduced M0 recovery gate is **application migration re-creation**, **documented non-secret infrastructure configuration**, and **explicit acceptance of database-loss risk**. The live 2026-10-22 read-only check found zero imported matches, forecasts, source records or access grants. This is **not** proof of a complete Supabase platform restore. Backup work is tracked after a fully functional project in #96 and is not an M0/M1 acceptance condition.

- [ ] #2: **$0-only** legitimately reusable current RPL data and defensible historical provenance, triangulated with lawful independent evidence using the ranked registry (`docs/M0_FREE_SOURCE_REGISTRY.json`). **Owner-approved reduction 2026-10-20:** research the pilot minimum **2024/25 training, 2025/26 untouched evaluation, current 2026/27 fixtures** (`docs/M0_MINIMUM_RPL_SCOPE.json`); do not require 2015/16–2023/24 historical completeness. This is a scope reduction, **not** rights, accuracy or strict as-of approval. No seasons approved for ingestion; OpenFootball 2023/24 remains quarantined; no paid feeds or fallbacks.
- [x] #5: application schema replay + isolated **synthetic** PG17 restore PASS on [CI #39764646186](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39764646186), real publishable-key REST [PASS](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39763464499/job/119773072854). Owner accepts lack of production-data recovery for this prototype and defers optional backup decision to #96 **once fully functional**.
- [x] #6 M0 **reduced acceptance (owner 2026-10-22): wired/home no-VPN PASS 3/3 is sufficient for current prototype**; historical two-independent-carrier requirement superseded. Mobile failures (T-Mobile on mostly T2 in St Petersburg, and MegaFon) remain real, known, **non-gating** limitations. Track deferred mobile network diagnostics under #6 without paid hosting, claiming resolution or delaying M0.
- [ ] #8: supported patched dependency or documented accepted remediation for the unresolved dev-only `braces` advisory; enforced production audit stays active.

Green CI and Vercel deployment are **necessary but not sufficient** for M0 sign-off. Verified wired reachability is one observed success only; the mobile failure cannot be labeled PASS. M0 still needs #2 data rights/accuracy and #8 security acceptance. No model training, data import, subscription or M1 work is authorized.
