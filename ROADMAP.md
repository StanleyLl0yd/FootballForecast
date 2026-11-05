## M2 five CC0 historical RPL source shape snapshots — 2026-11-05

Read-only original-repository, content-SHA-pinned evidence confirms 1,200 structurally present RPL fixtures across five 2018/19–2024/25 development seasons, **not 1,200 eligible played-score training rows**: 2019/20 contains four and 2020/21 two explicitly awarded results; 2023/24 Football.TXT has only 239 unique home/away pairings out of 240. Individual original kickoff/publication times and rights of upstream contributions are not independently verified. 2021/22 and 2022/23 are missing from the two checked CC0 repositories, not from the wider internet. [Research-only evidence](docs/M2_CC0_RPL_DEVELOPMENT_SOURCE_SHAPE_EVIDENCE.json); no private match read, model fitting, or 2025/26 holdout access. M2 4/8 OPEN.

## M2 synthetic weather candidate preflight and SStats specification status — 2026-11-05

A pure 26-test synthetic gate now refuses RPL historical weather without pre-cutoff source availability, verified venue validity and source rights; it **never** authorizes model admission. Official SStats docs expose `/Ls/Leagues` but its bounded query parameters, complete downloadable specification, and training rights remain unverified. No new SStats request, source data import, model fitting or holdout read. M2 4/8 OPEN; M3 unauthorized. [Details](docs/RPL_SEVEN_SEASON_ENRICHMENT_SOURCES.md).

## M2 bounded SStats catalog transfer-integrity finding — 2026-11-03

Protected [owner run #41697495298](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41697495298) safely classified HTTP200 catalog as JSON-prefixed, invalid JSON with **exactly 1,500,000 captured bytes**, equal to the configured maximum. Curl exit code was discarded by `|| true`, therefore successful full transfer cannot be attested and size-cap truncation is likely; no claim that SStats itself sends malformed JSON. Subsequent guarded source workflows must check nonzero curl status and fail closed as inconclusive transfer (all four bounded GETs). Do not raise the 1.5MB cap or repeat a large catalog download until endpoint/pagination/rights are independently qualified. No games, odds, model fitting or holdout reads. M2 4/8 OPEN; M3 forbidden. [Aggregate evidence](docs/M2_FREE_SOURCE_ENRICHMENT_OBSERVATION_EVIDENCE.json).

## M2 real seven-year JMA GSM city-reference receipt — 2026-11-03

Protected owner [run #41695184408](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41695184408): 7/7 full fixed reference dates, 168/168 non-null hourly temperature fields (August 1, 2018–2024; Saint Petersburg city, not stadium). No historical model-run issuance time, real RPL match joining or weather training permission. Protected repeat [SStats #41695180516](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41695180516) remained INCONCLUSIVE_SCHEMA; follow up by classifying non-JSON payloads using only size/type/SHA, no raw provider content. Holdout 2025/26 sealed; M2 4/8 OPEN; M3 prohibited. [Aggregate receipt](docs/M2_FREE_SOURCE_ENRICHMENT_OBSERVATION_EVIDENCE.json).

## M2 JMA GSM historical weather-year reference discovery — prepared 2026-11-03

Documentation confirms JMA GSM/MSM previous-run archive began in 2018. Add seven-owner-only fixed-reference-date GETs from 2018–2024 with a strict 24-hour-lead temp count-only validator and explicit per-year HTTP/shape statuses. Real full-season match venue coverage **not proven**; do not attach city reference temperatures to stadium matches, infer historical forecast issuance or train real weather models. Protected owner `/m2-weather-seven-years` completed; only bounded aggregate evidence is pinned. No sealed holdout, M3, paid API or public match data.

## M2 first actual external enrichment discovery results — 2026-11-03

Exact-main protected source jobs: SStats public official catalog #41690706216 **HTTP200 / INCONCLUSIVE_SCHEMA** (no historical games requested, no historical RPL API coverage claim), Open-Meteo Previous Runs #41690713868 **24/24 non-null fixed-lead hourly temperature values** for a Saint Petersburg reference location on 2024-08-01 (no match venue attestation, historical run ID or model inclusion). SHA-only evidence in [docs/M2_FREE_SOURCE_ENRICHMENT_OBSERVATION_EVIDENCE.json](docs/M2_FREE_SOURCE_ENRICHMENT_OBSERVATION_EVIDENCE.json). New safe JSON envelope diagnostic for SStats prepares one bounded retry. Still no new multi-season model training, historical bookmaker quote validation or holdout access.

## M2 bounded free multi-provider discovery — 2026-11-03

Official documentation reviewed for SStats.net public anonymous API (30 requests/minute/IP, league and match list endpoints), public RPL 2022/23 page, and Open-Meteo Previous Runs fixed 24-hour-lead forecasts (CC BY 4.0, noncommercial call caps). Owner-only [discovery workflow](.github/workflows/m2-enrichment-source-discovery.yml) adds a maximum of two SStats metadata/sample GETs and one Open-Meteo reference point GET; no raw source rows, data import, historical bookmaker performance claim or sealed holdout access. Exact API RPL coverage, rights for model training, venue history and forecast issuance remain gates. See [source qualification](docs/RPL_SEVEN_SEASON_ENRICHMENT_SOURCES.md) and [machine-readable plan](docs/RPL_SEVEN_SEASON_ENRICHMENT_PLAN.json).

## M2 seven-season enrichment source coverage VERIFIED (first pages only) — 2026-11-03

Protected owner [run #41674569785](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41674569785) read 7×50 first-page match records, confirmed 26 unique club IDs with adjacent overlaps 14/14/14/13/14/13 (**82** shared-ID name matches, zero name conflicts), and observed **0/350 nonempty candidate fields** for venues, cities, surface, weather, staff, lineups, players, xG, shots and odds. These are **sampled keys only**; full-season richness and independent club identity remain unproven. Next qualify SStats.net official free API for RPL extended match statistics and historical odds, Wikidata/TheSportsDB for dated venue and personnel identity, and Open-Meteo for historical as-of weather forecasts from ~2022. Preserve no-data/no-train/no-holdout guarantees. [Pinned aggregate-only receipt](docs/M2_RPL_TEAM_IDENTITY_SAMPLE_EVIDENCE.json) · [Prioritized enrichment matrix](docs/RPL_SEVEN_SEASON_ENRICHMENT_SOURCES.md).

## M2 owner-only historical club identity consistency discovery — 2026-11-03

Prepare a bounded seven-GET Starter-only private club-ID/name continuity audit; compare with previously verified private SQL aggregates (26 unique IDs, 19 multi-season, 8 in all seven; adjacent overlaps 14/14/14/13/14/13). No public team identifiers/names, no automatic aliases or extra data source and no holdout access. Even a perfect source-name match is not independent club identity evidence; remain unapproved until a cross-provider corroboration policy is reviewed.

## M2 seven-season development-fold and market-benchmark foundation — 2026-11-03

New pure synthetic-tested [five expanding development folds and paired H/D/A bookmaker comparator](docs/RPL_SEVEN_SEASON_DEVELOPMENT_PROTOCOL.md). Fixed validation seasons 2020/21–2024/25 (five × 240). No real new-model fitting, calibration, historical odds sourcing, holdout evaluation or production predictions authorized. Actual private adjacent-year source-team-ID overlap counts are 14/14/14/13/14/13 of 16: require independently reviewed identity continuity before cross-season training. Bookmaker outperformance is **not** established; compare only matched timestamp-authenticated, vig-adjusted quotes with Log Loss/Brier/RPS. M2 remains 4/8 OPEN and M3 forbidden.

## M2 seven-season private source archive VERIFIED — 2026-11-03

Protected owner [import #41668066639](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41668066639) completed **7 immutable private snapshots / 1,680 scored matches** in Supabase Frankfurt (2018/19–2024/25). Independent SQL readback confirms 240 finished matches and 16 clubs per season, source-only roles, FORCE RLS and denied anon/authenticated/service_role access, original 1 train-only M2 model unchanged and 0 public forecasts. The actual normalized archive fingerprint is pinned in [M2 private history evidence](docs/M2_PRIVATE_RPL_HISTORY_EVIDENCE.json); no raw provider rows in Git. Development-only [temporal feature protocol](docs/RPL_SEVEN_SEASON_TEMPORAL_FEATURES.md) now uses prior-day match history and excludes the sealed 2025/26 cohort. Do not treat retrospective data as authenticated historical as-of evidence. Existing M2 4/8 OPEN and M3 prohibition remain unchanged.

## M2 guarded private historical source importer — completed and independently verified

Added owner-only manual GitHub Actions seven-season historical import with 119 throttled free Starter requests, cross-team checking, canonical SHA receipts, a second Python validation layer and an atomic append-only Supabase transaction. No old Poisson model refit or sealed 2025/26 access. Executed in protected owner run #41668066639; independently verified **7 immutable snapshots and 1,680 matches** in Supabase Frankfurt, 0 public forecasts. See [private history contract](docs/M2_PRIVATE_RPL_HISTORY.md).

## M2 seven-season full historical score verification — 2026-11-03

Owner run [#41662712300](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41662712300) cross-confirmed 1,680/1,680 finished RPL development matches and nested final goals across 7 seasons (7×240), using 119 bounded free Starter requests. No sealed 2025/26 label was fetched. A private, append-only candidate history store with no model approval is introduced; never change the fixed M2 baseline or read held-out results before independent study lock. See [private history plan](docs/M2_PRIVATE_RPL_HISTORY.md).

M2 real protected training-only escrow ACCEPTED AS TECHNICAL EVIDENCE (2026-11-03; not M2 criterion acceptance): PR #220 merged protected, exact-main 10/10 PASS, Supabase Frankfurt migration `20261103125026_m2_private_openfootball_model_escrow` applied; owner run #41639171388 persisted exactly 1 private model (1447 bytes) with DB SHA256 verification matching two prior OpenFootball CC0 2024/25 replays, all client/service-role permissions denied, RLS+append-only triggers verified. Aggregate receipt securely anchored in Git, but **NOT a pre-holdout study lock**: independent 2025/26 evaluation source and owner research authenticated-browser acceptance still outstanding. No holdout read or predictions, M2 **4/8 OPEN**, M3 forbidden.
M2 source-rights and private model storage (2026-11-03): verified protected OpenFoot catalogue #41635173009 identifies RPL FotMob as `Unlicensed-Beta`; upstream terms do not authorize automatic production import. Added fail-closed catalog classification and prepared private append-only RLS model escrow for pinned OpenFootball 2024/25 train-only coefficients, protected manual GH runner, aggregate SHA evidence. Real DB migration/run/protected Git anchor still require verification; 2025/26 holdout remains sealed. M2 4/8 OPEN.
M2 free RPL 2026/27 source validation (2026-11-03): protected owner run #41632612945 confirmed 240/240 cross-confirmed fixtures across 16 free Starter team filters (104 finished / 136 scheduled, 0 missing UTC kickoff, 16/16 source metadata presence), still `STRUCTURALLY_COMPLETE_UNAPPROVED`. Added one owner-only exact issue-command authenticated free Starter `/v1/competitions` source licence/attribution audit; no provider rows/credentials/holdout. Source rights and independent score/time accuracy gates remain. M2 4/8 OPEN.
M2 Starter team-filter fallback (2026-11-03): protected #41631229550 reached first round but returned an ambiguous old preflight stop (not proof of invalid key). Implemented a separate manual owner-only 17-GET free team-filter source coverage audit using 16 club IDs resolved from a validated season page, with paired-team matching and no raw artifacts/pagination/holdout. First-round preflight now emits safe cause flags. Actual current RPL coverage remains pending; M2 4/8 OPEN.
M2 free-source coverage paging gate (2026-11-03): owner protected run #41628766870 verified authenticated free OpenFoot Starter returned a 50-finished-match default page / 16 clubs, not a complete RPL 2026/27 feed. Public OpenAPI documents default limit 50 and Developer-only cursor; no paid pagination. Prepared one new manual input `AUDIT_OPENFOOT_ROUNDS` (or exact owner-only #182 comment `/m2-openfoot-rounds`) in the same source-observation workflow: at most 30 ordinary free `round` filters, aggregate-only, no secrets or provider rows in logs, no holdout/model/public writes. Approval and actual execution pending. M2 4/8 OPEN.
M2 private free Starter API check (2026-11-03): owner-only manual one-shot authenticated RPL 2026/27 observation added to existing research workflow; requires private GitHub free-tier API key and exact confirmation, otherwise no request. A 240/16 result would still require independent quality/rights/temporal approval. No holdout access, model publication or production writes. M2 4/8 OPEN; M3 forbidden.
# Roadmap

## Personal forecasting research direction (owner, 2026-11-03)

The owner prioritizes a private, noncommercial RPL research laboratory over a public forecasting product. Research candidate horizon: 2018/19–2024/25 (up to 1,680 scheduled matches); 2025/26 remains sealed; 2026/27 is prospective only. Develop leakage-safe chronological team, coach, player, venue, weather and market-odds features, compare probabilistic forecasts against contemporaneous vig-adjusted bookmaker baselines with Log Loss/RPS/Brier and honest uncertainty. First executable deliverable is a manual, owner-only seven-season **sample** discovery against free OpenFoot Starter with no row retention (real owner run #41648185988: 7×50 finished matches, 16 clubs in each sample, pagination restricted; no complete season inferred). Next owner-only structured audit: 7×16 free club-filter pages, 119 total GETs or holdout access. See [research strategy](docs/RPL_PRIVATE_RESEARCH_STRATEGY.md) and [machine-readable discovery plan](docs/M2_SEVEN_SEASON_DISCOVERY_PLAN.json). Actual full source run #41651058492 cross-confirmed 7×240 unique historical fixtures on free Starter, with 0/1680 valid goal pairs at the initially expected top-level keys. Owner [single-request score probe #41652739590](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41652739590) confirmed nested `score.home`/`score.away` on 50/50 2018/19 sample rows. Full seven-season score replay PASSED in owner run #41662712300 (1,680/1,680). No new fitted model or feature set is approved by this change; existing M2 4/8 and M3 ban are preserved.


Updated 2026-11-03. Milestone acceptance requires verification, not code presence.

M2 OpenFootball model-lock preparation (2026-11-03): the canonical private in-memory coefficient codec now supports protocol-explicit OpenFootball calendar-only model fingerprints, rejecting legacy/calendar substitution. Synthetic tests only; no persisted model or immutable approved lock. Football-Data.co.uk advertises archived 2025/26 Russia CSV but remains **restricted-reference only** under the existing source registry, not an approved evaluation input (no holdout labels accessed). 2026/27 source still missing, M2 4/8 OPEN, M3 prohibited.

## M1 — RPL data foundation (ACCEPTED 2026-11-02)

- [x] Owner accepted [M1 issue #124](https://github.com/StanleyLl0yd/FootballForecast/issues/124) after two distinct full 232/232 **internal** technical audit passes, findings disposition and exact-main CI/Security/CodeQL/browser verification; no outside auditor signatures claimed.
- [x] At acceptance: three three-season Footbolno CC BY 4.0 data roles (2024/25 train candidate, 2025/26 sealed holdout, 2026/27 current); four immutable full 720-row revisions (2880 private records), two byte observations, 616 public canonical matches (583 finished, 33 scheduled), seven guarded current-season result events, zero forecasts. Live counts are a dated observation, not fixed perpetual invariants.
- [x] Protected $0-only source synchronization, immutable provenance, 15/15 RLS, client read/write denials, sealed holdout unchanged, server-enforced squash-only main, no bypasses, exact-main Frankfurt production READY.
- [x] Accepted remaining non-gating risks [#6](https://github.com/StanleyLl0yd/FootballForecast/issues/6) (mobile reachability), [#8](https://github.com/StanleyLl0yd/FootballForecast/issues/8) (controlled dev-only advisory), [#96](https://github.com/StanleyLl0yd/FootballForecast/issues/96) (production recovery). These remain **open, not fixed**.

**M2 is OPEN, owner-authorized 2026-11-02** ([issue #182](https://github.com/StanleyLl0yd/FootballForecast/issues/182)). The fixed independent-Poisson study must be pre-registered before any real-data training, with 2025/26 sealed. M3 remains not authorized. Two real ephemeral train-only fits reproduced the same fingerprint; no approved or retained model and no public forecast exists. Historical pre-match publication timestamps and independent calibration remain unproven.

M2 protected training input implemented in [PR #184](https://github.com/StanleyLl0yd/FootballForecast/pull/184), protected squash merge, exact-head 10/10 PASS. The 11th Supabase Frankfurt migration is applied, live aggregate SELECT confirms 240/240 2024/25 training records, 16 clubs with 30 games each, 0 non-training rows and 0 published forecasts. [Read-only contract](docs/M2_TRAINING_INPUT.md). No real fitted model or opened holdout; four remaining #182 tasks after conditional model-family deferral; source/holdout/immutable-evidence gates remain unaccepted.

M2 new OpenFootball real train-only repeatability proof (2026-11-03): two owner-triggered protected job runs #41601074078 and #41601164752 both PASS on exact main `b7812c531a7284a4db58c34ed77af8adeecf8d1f`, identical aggregate receipt SHA `381159c8928283c6f3d9a2b75bda4ee53d1b9a41f31184d5cd9a14ec267306b6`, same 240/16 cohort, model/train/source digests. [Recorded safe allowlisted evidence](docs/M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE.json), **TRAIN_ONLY_UNAPPROVED**, no model escrow, historical-as-of proof or holdout evaluation, M2 4/8.

M2 source-observation result (2026-11-03): protected owner run [#41613346756](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41613346756) returned OpenFootball pinned 240/16, public OpenFoot demo only 5 finished records / 10 clubs, and a zero-record **single-day** SportScore RPL observation. Persisted only [closed-schema aggregate SHA evidence](docs/M2_PUBLIC_SOURCE_OBSERVATION_EVIDENCE.json), displayed after owner login; these observations establish neither a 2026/27 full fixture feed nor a licensed, pinned 2025/26 evaluation source. M2 still 4/8, original holdout sealed, M3 not started.

M2 empirical provider observation access (2026-11-03): the existing M2 manual-only public source workflow now emits its previously reviewed aggregate-only summaries and explicit INCONCLUSIVE flags to protected GitHub Actions job logs (in addition to the step summary), so independent verification of real provider responses is possible without publishing or retaining fixture identities. Synthetic regression protects no raw provider log leakage.

M2 prospective live-source one-shot probe (2026-11-03): add a third owner-only research job to existing public-sources workflow, using exactly one published public-demo OpenFoot API GET with explicit RPL competition and 2026/27 season; fail closed to aggregate-only INCONCLUSIVE/PARTIAL/STRUCTURALLY_COMPLETE_UNAPPROVED statuses and response SHA. No live feed integration, model/holdout/publishing approval or database write; provider rights and real season completeness still pending.

M2 retired legacy Footbolno push probes (2026-11-03): four M0 archival observation workflows now manual-only/owner-only, in addition to the existing manual-only M1 importer. An explicit workflow-level regression gate verifies no automatic Footbolno HTTP access; source history and manual emergency options remain intact.

M2 OpenFootball-first migration (2026-11-03): the owner removed Footbolno as a mandatory future provider. A separate preregistered [calendar-only CC0 train study](docs/M2_OPENFOOTBALL_PROTOCOL.md) uses the pinned 240/16 2024/25 text, an ephemeral no-secrets owner-only train-only workflow and isolated fixed Poisson solver. No invented kickoff instants; no legacy v1 or sealed 2025/26 holdout modification. Old scheduled/push Footbolno imports are disabled while preserved snapshots and manual recovery remain. Neither live-current-season nor a non-Footbolno 2025/26 licensed evaluation cohort is approved yet; M2 still 4/8, M3 unauthorized.

M2 source-independent follow-up (2026-11-03): owner-only manual public-source observation workflow with zero secrets and no Supabase access; exact OpenFootball 2024/25 pinned reference and at most one current UTC SportScore league-filtered GET, aggregate-only results with attribution, explicit INCONCLUSIVE unavailable state. Neither observations nor match rows are inserted into canonical data or used to train/publish any model; source selection remains fail-closed. M2 still 4/8 and no new acceptance asserted.

M2 source-outage work (2026-11-03): a strict, local-file-only OpenFootball 2024/25 independently pinned **reference** adapter reuses the historical structure/date parser, verifies the original Git blob before processing, checks 240 fixtures/16 clubs/30 rounds and emits aggregate-only diagnostics. All kickoff instants remain unknown. It introduces no new database write, ML training, sealed holdout read, or silent fallback in the frozen Footbolno study. SportScore remains bounded current-only corroboration; see [data-source decision](docs/DATA_SOURCES.md#m2-source-outage-independent-reference-path-2026-11-03). M2 acceptance remains 4/8.

M2 owner-facing UI work in progress: an owner-only `/admin/research` read-only console displays bounded committed train-only identifiers, independent public-source and train-only GitHub workflow metadata (no source-content approval inferred) and explicit blockers for exact-source reconfirmation, immutable pre-holdout anchoring and one-time evaluation. The public model lab stays read-only. The new page is guarded with `requireOwner()` before reading status or showing evidence; this is not acceptance of the entire UI, immutable-artifact or evaluation criterion. M2 remains OPEN 4/8.

A synthetic-only private model codec now serializes and independently rechecks a future fitted model using a closed canonical 8 KiB format and existing fitted-model SHA; synthetic-only tests reject tampering and malformed/noncanonical coefficients. This does **not** save real model weights, establish encrypted protected storage or open holdout. The immutable study-artifact criterion remains OPEN.

A synthetic-only M2 study-anchor request envelope is prepared: SHA-bound source comparison, execution identity, runtime/dependency digests and a future private model-artifact reference. It always states pending review/no holdout permission; no source-verified real lock, protected immutable anchor or evaluator authorization exists. The owner research console now supports browser-local inspection of the 24-field pending anchor request with strict schema and SHA checks, not external verification, persistence or approval. M2 stays 4/8.

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
- [x] Conditional Elo/Dixon–Coles validation decision: independently validated alternate models cannot be selected with the sole fixed 2024/25 train, sealed 2025/26 holdout and incomplete 2026/27. [Documented M2 deferral](docs/M2_BASELINE_PROTOCOL.md#conditional-model-family-decision--2026-11-02); no extra fitting, holdout tuning or calibration; **M2 remains OPEN 4/8**, four milestones pending.
- [ ] Protected pre-holdout model and source attestations: implementation/tests prepared; protected runner with owner-only workflow dispatch or strict manual issue #182 command prepared; real source-corroborated lock and immutable anchoring NOT YET DONE; two source-offline ephemeral train-only fits reproduced exact model and data fingerprints ([contract](docs/M2_RESEARCH_LOCK.md)).
- [ ] Protected real-data read-only training extraction and QC; no private raw records or provider credentials in artifacts. Protected [real preflight #41442233583](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41442233583) **PASS** (240/16). Two protected [temporary train-only fits #41443294566](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41443294566) and [#41443547849](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41443547849) **PASS** with identical train, mapping, snapshot and model SHA; external source not rechecked. These are not approved locks, production models or holdout evaluation. GitHub train-only run #41436355466 attempts 1–2 failed **before fit** due to Footbolno DNS resolution; guarded same-origin DoH recovery prepared, not proof of a successful run.
- [ ] One-time **non-strict retrospective** holdout evaluation after immutable real lock and provenance: offline scorer with strict 240/240 role/identity gates and synthetic-only tests prepared; **real study NOT RUN**, no tuning or accuracy claim.
- [ ] Browser-based owner M2 research/status interface and reproducible constrained study jobs: public read-only GitHub workflow status (bounded tokenless GET, fail-closed), local schema-guarded aggregate-attestation viewer, two-file offline train-only replay comparison and pinned two-run SHA-validated aggregate evidence on the Models page prepared; trusted owner authentication, source-corroborated immutable evidence anchoring and one-time real evaluation NOT COMPLETE. No browser DB writes or default predictions.
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
