# Roadmap

Updated 2026-11-02. Milestone acceptance requires verification, not code presence.

## M1 — RPL data foundation (ACCEPTED 2026-11-02)

- [x] Owner accepted [M1 issue #124](https://github.com/StanleyLl0yd/FootballForecast/issues/124) after two distinct full 232/232 **internal** technical audit passes, findings disposition and exact-main CI/Security/CodeQL/browser verification; no outside auditor signatures claimed.
- [x] At acceptance: three three-season Footbolno CC BY 4.0 data roles (2024/25 train candidate, 2025/26 sealed holdout, 2026/27 current); four immutable full 720-row revisions (2880 private records), two byte observations, 616 public canonical matches (583 finished, 33 scheduled), seven guarded current-season result events, zero forecasts. Live counts are a dated observation, not fixed perpetual invariants.
- [x] Protected $0-only source synchronization, immutable provenance, 15/15 RLS, client read/write denials, sealed holdout unchanged, server-enforced squash-only main, no bypasses, exact-main Frankfurt production READY.
- [x] Accepted remaining non-gating risks [#6](https://github.com/StanleyLl0yd/FootballForecast/issues/6) (mobile reachability), [#8](https://github.com/StanleyLl0yd/FootballForecast/issues/8) (controlled dev-only advisory), [#96](https://github.com/StanleyLl0yd/FootballForecast/issues/96) (production recovery). These remain **open, not fixed**.

**M2 is OPEN, owner-authorized 2026-11-02** ([issue #182](https://github.com/StanleyLl0yd/FootballForecast/issues/182)). The fixed independent-Poisson study must be pre-registered before any real-data training, with 2025/26 sealed. M3 remains not authorized. No model has been trained or published. Historical pre-match publication timestamps and independent calibration remain unproven.

M2 protected training input implemented in [PR #184](https://github.com/StanleyLl0yd/FootballForecast/pull/184), protected squash merge, exact-head 10/10 PASS. The 11th Supabase Frankfurt migration is applied, live aggregate SELECT confirms 240/240 2024/25 training records, 16 clubs with 30 games each, 0 non-training rows and 0 published forecasts. [Read-only contract](docs/M2_TRAINING_INPUT.md). No real fitted model or opened holdout; five remaining #182 tasks after exact-main acceptance.

The following M0 material is retained as historical acceptance evidence.


## M0 - Architecture & Web Foundation (ACCEPTED 2026-10-29)
- [x] Research preliminary RPL data source coverage and terms; owner-approved published-source uses are documented, not blanket production ingestion.
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
- [x] Defer optional GitHub owner OAuth unless administrative login is enabled later; not an M0 acceptance gate.
- [x] Apply foundation/public-read migrations to Free Frankfurt Supabase and verify RLS/security advisors.
- [x] Finish #5's M0 application-schema/reproducible-migrations and real PostgREST authorization acceptance, backed by successful PostgreSQL 17 CI and live REST evidence. Owner deliberately moved **real offsite backup/restore** to non-gating #96, without claiming production data recovery.
- [x] Add synthetic PostgreSQL 17 pg_dump/pg_restore round-trip proof in CI, including RLS, data and immutable-archive triggers.
- [x] Apply and verify all three FK indexes; performance advisor no longer reports unindexed FKs.
- [x] Deploy public Vercel Hobby to Frankfurt from protected GitHub main and verify anonymous pages/admin redirect from GitHub Actions.
- [x] **2026-10-22 owner-approved M0 scope:** actual Russian home/wired Internet **without VPN** confirmed the live public health, dashboard and archive **3/3 HTTP 200 PASS**; hosted Safari/Firefox/Edge/Chrome compatibility PASS. Two failed St Petersburg mobile operators are explicitly documented but **non-gating** for M0 (#6 follow-up).
- [x] Connect public read-only dashboard/matches to Supabase REST via publishable key with unconfigured/error/empty states and mocked REST contract tests.
- [x] Verify live anonymous Supabase REST via production dashboard and external GitHub Actions HTTP canary.
- [x] Verify **one real Russian home/wired network** separately from GitHub runners: owner browser report 2026-10-22 11:33:03 UTC; API 130 ms, dashboard 368 ms, archive 333 ms, all HTTP 200. This checks only the observed network, not universal access or Russian mobile service.
- [x] Document and accept the actually published zero-cost source-use tier (Footbolno CC BY 4.0, SportScore attributed bounded API/derived analytics, OpenFootball CC0), with owner risk acceptance; see [scope/risks](docs/M0_EXIT_AUDIT_AND_SOURCE_DECISION.md). Production ETL, upstream rights, historical pre-kickoff snapshots and model training remain M1 intake requirements, not inferred M0 accomplishments.
- [x] Create M0 GitHub issues and activate main ruleset #25266406 (six required checks, no mandatory reviewers).
- [x] Verify protected PR merges #15 and #16 and exact-head/post-merge CI/Security/CodeQL.

## M1 - Data Foundation (ACCEPTED 2026-11-02 — see exit evidence above)
Licensed adapters, provenance, normalized seasons and teams, timestamp checks, data center and sync.

## M2 - Statistical Baselines (OPEN 2026-11-02)

- [x] Owner explicitly authorized [M2 issue #182](https://github.com/StanleyLl0yd/FootballForecast/issues/182), while [M1 #124](https://github.com/StanleyLl0yd/FootballForecast/issues/124) remains ACCEPTED.
- [x] [Independent-Poisson protocol v1](docs/M2_BASELINE_PROTOCOL.md) frozen **before real training**, with 2024/25 train, 2025/26 sealed holdout and current-season time gates; no retrospective strict-as-of or accuracy claims.
- [x] Deterministic regularized Poisson team-strength fit with synthetic-only tests (PR #183); protected real training read (PR #184).
- [ ] Protected pre-holdout model and source attestations: implementation/tests prepared; protected runner with owner-only workflow dispatch or strict manual issue #182 command prepared; real fit and immutable anchoring NOT YET CONFIRMED ([contract](docs/M2_RESEARCH_LOCK.md)).
- [ ] Protected real-data read-only training extraction and QC; no private raw records or provider credentials in artifacts. Stored-snapshot train-only **preflight** is available without the publisher; this is not training or a model lock. GitHub train-only run #41436355466 attempts 1–2 failed **before fit** due to Footbolno DNS resolution; guarded same-origin DoH recovery prepared, not proof of a successful run.
- [ ] One-time **non-strict retrospective** holdout evaluation after immutable real lock and provenance: offline scorer with strict 240/240 role/identity gates and synthetic-only tests prepared; **real study NOT RUN**, no tuning or accuracy claim.
- [ ] Browser-based owner M2 research/status interface and reproducible constrained study jobs: public read-only GitHub workflow status (bounded tokenless GET, fail-closed) and local schema-guarded aggregate-attestation viewer prepared; trusted owner authentication, immutable evidence anchoring and real research jobs NOT COMPLETE. No browser DB writes or default predictions.
- [ ] Complete two repository-wide M2 exit audits, exact-main CI/Security/CodeQL/browser, verified production and explicit owner acceptance.

Deferred calibration/Elo/Dixon-Coles selection requires independent validation/cohort; do not tune on the sealed holdout. **M3 is not open.**

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

## Final M0 acceptance, independent of later data-foundation training

The reduced M0 recovery gate is **application migration re-creation**, **documented non-secret infrastructure configuration**, and **explicit acceptance of database-loss risk**. The live 2026-10-22 read-only check found zero imported matches, forecasts, source records or access grants. This is **not** proof of a complete Supabase platform restore. Backup work is tracked after a fully functional project in #96 and is not an M0/M1 acceptance condition.

- [x] M0 free-source strategy and owner's bounded-use acceptance (research issue #2 remains **closed by owner**; source/usage policy approved 2026-10-29, not a certification of raw data rights or strict historical as-of): **$0-only** legitimately reusable current RPL data and defensible historical provenance, triangulated with lawful independent evidence using the ranked registry (`docs/M0_FREE_SOURCE_REGISTRY.json`). **Owner-approved reduction 2026-10-20:** research the pilot minimum **2024/25 training, 2025/26 untouched evaluation, current 2026/27 fixtures** (`docs/M0_MINIMUM_RPL_SCOPE.json`); do not require 2015/16–2023/24 historical completeness. This is a scope reduction, **not** rights, accuracy or strict as-of approval. M1 may implement attributed Footbolno ingestion of these seasons, keeping OpenFootball 2023/24 anomalies quarantined; no paid feeds or fallbacks.
  - **Observed no-cost source consistency, 2026-10-22:** 2024/25 **240/240** directed fixtures with scores and dates agree Footbolno / OpenFootball (PR #103); 2025/26 **240/240** directed scores agree Footbolno / pinned Wikimedia CC BY-SA revision (PR #104); current 2026/27 **16/16** directed fixtures on six fixed dates agree Footbolno / filtered SportScore REST v1 (PR #107). [Aggregate evidence](docs/M0_SPORTSCORE_FILTERED_RPL_EVIDENCE.json) has enforced non-approval flags, and the [registry](docs/M0_FREE_SOURCE_REGISTRY.json) now reflects measured coverage. These are published-source comparisons, **not official protocol audits, 240-match current freshness, upstream data-license proofs, or authenticated prematch histories**. Provider integrations and real-model training were disabled during M0. M1 is now open for implementation of permitted source adapters and data-quality gates; the local source-accuracy tool differentiates scheduled and finished fixtures (PR #109).
- [x] #5: application schema replay + isolated **synthetic** PG17 restore PASS on [CI #39764646186](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39764646186), real publishable-key REST [PASS](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/39763464499/job/119773072854). Owner accepts lack of production-data recovery for this prototype and defers optional backup decision to #96 **once fully functional**.
- [x] #6 M0 **reduced acceptance (owner 2026-10-22): wired/home no-VPN PASS 3/3 is sufficient for current prototype**; historical two-independent-carrier requirement superseded. Mobile failures (T-Mobile on mostly T2 in St Petersburg, and MegaFon) remain real, known, **non-gating** limitations. Track deferred mobile network diagnostics under #6 without paid hosting, claiming resolution or delaying M0.
- [x] #8 **M0 security exception accepted by owner 2026-10-22**: narrowly limited dev-only `braces@3.0.3` / `GHSA-vfj7-8cjw-p6xm` chain. Enforced production audit and fail-closed full audit for all other HIGH/CRITICAL findings remain active. **Unpatched advisory is NOT fixed**; issue #8 stays OPEN as **non-gating upstream patch watch**, reviewed when Dependabot/advisory or dependency graph changes (see `SECURITY.md`).

M0 exit evidence: two full-repository audit passes and fixes, successful protected exact-main CI/Security/CodeQL, Russian wired network acceptance, and independently verified Vercel production READY on exact commit `523d70d50a6f079ecbf9c84e48e469409c6fb765` (region `fra1`, deployment `dpl_7JvAPEn6Jp2K4WWZbfnAiVTYwuqU`). The owner accepted the remaining non-gating risks #6/#8/#96 and approved closing speculative source-rights review as an M0 blocker. M0 is accepted; M1 source/data foundation may proceed on free published terms. Historical as-of validation, accurate match status and sealed holdout separation remain technical M1 controls. No subscriptions or paid fallbacks.

### 2026-10-29 M0 exit audit / owner source-use decision

The repository-wide security/correctness and independent complexity sweeps, the PR #122 regression fixes and residual risks are documented in [M0 exit evidence](docs/M0_EXIT_AUDIT_AND_SOURCE_DECISION.md). The owner explicitly directed use of all 20 recorded free sources within the corresponding published terms, without further routine requests for upstream permissions or vendor letters. Existing licensed data may be used for M1 ingestion and training where the provider's terms cover that operation. Never misrepresent prohibited extraction, raw redistribution, missing chronological evidence or measured model accuracy. **M0 accepted 2026-10-29; M1 was OPEN at that checkpoint, and was subsequently ACCEPTED 2026-11-02.**
