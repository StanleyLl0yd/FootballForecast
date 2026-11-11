# M4 — private prospective RPL shadow protocol (v1, 2026-11-11)

**Status: M4 OPEN, [#304](https://github.com/StanleyLl0yd/FootballForecast/issues/304); A1–A8 independent gates.** The owner authorized beginning M4 after accepting [M3 #271](https://github.com/StanleyLl0yd/FootballForecast/issues/271) 8/8. **No public forecasts are authorized.** This initial PR adds a pure testable guard and documentation, not a real model lock, database migration, source fetch, timed workflow or forecast publication.

## Science and fixed inputs

M3 has 1,680/1,680 retrospective public/private fixture correspondences, 1,673 candidate played labels after excluding six technical awards and a revised official score, and five chronological development validation folds with 1,197 scored candidates. This is **NON_STRICT_RETROSPECTIVE**, not historical original first-publication evidence or independent sealed test performance. Never re-fetch, re-query, re-score, tune, publish or reuse the **consumed 2025/26 holdout**, even if a current external API returns it.

Start M4 only with genuinely **future 2026/27 RPL fixtures**, frozen model provenance based solely on eligible 2018/19–2024/25 development data, and new *trusted server-time* source observations **after 2026-11-11T11:04:56Z** (M4 issue creation). No retrospective “forecasts” for matches already completed by M4's start; no backdating historical receipt timestamps. The first candidate requires at least **900 seconds (15 minutes)** of actual lead before kickoff.

## Private shadow pipeline, sequential gates

1. **A1** freeze this scope, 2025/26 denial, versioned source/model/fixture contracts and honest monitoring.
2. **A2** pure source-free preflight with canonical seconds-precision UTC, explicit 2026/27 only, unique directed identity, unrevised scheduled fixture, source revision/kickoff evidence/identity SHA-256 and monotone observation/capture/evaluation time. Strictly deny awarded, revised, missing, ambiguous, stale or past fixtures.
3. **A3** protected owner-only candidate training/locking with immutable model manifest, digest and approved historical cohort. Do not tune using 2026/27 observed outcomes or the 2025/26 holdout. The fixed M3 Poisson is a candidate, not automatically a production-approved model.
4. **A4** add a privately protected **append-only**, idempotent forecast/revision/abstention ledger; no public SELECT or write privilege. Test PG17 RLS, transaction concurrency, first-write timestamps, revision lineage and denial of status mutation.
5. **A5** actual forward-time capture before kickoffs using server-controlled UTC and independently verified kickoff/club mapping/source revision, plus bounded owner-only job. No browser-initiated privileged work until auth, CSRF, rate/replay, one-use idempotency and negative user-role tests are reviewed. No public forecast worker.
6. **A6** settle outcomes only after independent *played* results and real post-match availability; maintain calibration, coverage/abstention, Log Loss/Brier/RPS, matching baseline and uncertainty. A completed game with no earlier immutable forecast must never enter scored forecast coverage.
7. **A7** owner-only monitoring, match revisions and Zenit pre/post-match reports only for applicable RPL fixtures; no user-visible published forecast.
8. **A8** two complete repository-wide audits, live RLS/auth/browser, exact-main CI/Security/CodeQL and Vercel release integrity, with owner acceptance. **Publishing still requires a separate explicit authorization.**

## Initial code boundary

`apps/web/lib/m4-prospective-preflight.mjs` accepts only a tight metadata envelope and an **untrusted caller-supplied evaluation timestamp**. It performs deterministic structural checks, returning `blocked` or `candidate_only`. Even a positive candidate explicitly reports **`genuineAsOfAttested:false`, `modelApproved:false`, `writeAuthorized:false`, `publicationAuthorized:false`**. Digests are format-tested, not authenticated. **No code may treat this function alone as an authorization to run a model, write to the database, claim an authentic pre-match forecast or release predictions.** A3–A5 must establish actual server-trusted attestation, append-only persistence and private execution. This first gate does not use real source data.

Follow [the M4 milestone issue](https://github.com/StanleyLl0yd/FootballForecast/issues/304). Protected PR, exact-head checks, signed squash, exact-main checks and staged Vercel release verification are mandatory; original M2 escrow/RLS and M3 files remain untouched except accurate acceptance-status text.
