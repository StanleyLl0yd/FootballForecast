# Changelog


## Pre-holdout research lock (M2, synthetic-only)

Prepared a private-only, reproducible [M2 research-lock contract](docs/M2_RESEARCH_LOCK.md) with strict exact-revision Footbolno/OpenFootball score-gate input, predeclared 16-club mapping, and SHA-256 fingerprints of the train rows, model, mapping and code. No real fit, trusted-runner anchoring or holdout evaluation has occurred. M2 remains 3/8 complete; no public forecasts.

## M2 statistical research opened — 2026-11-02 (in progress)

Merged protected [PR #184](https://github.com/StanleyLl0yd/FootballForecast/pull/184) with the SHA-pinned 2024/25-only SQL/Python read adapter and synthetic tests (10/10 exact-head PASS). Applied migration `m2_training_read_only` to live Supabase Frankfurt and verified only aggregate 240 training rows/16 clubs; browser roles and service_role still cannot execute the function. No real model training, holdout evaluation or forecast publication. See [M2 input contract](docs/M2_TRAINING_INPUT.md).

Owner authorized [M2 #182](https://github.com/StanleyLl0yd/FootballForecast/issues/182). [Fixed Poisson baseline protocol](docs/M2_BASELINE_PROTOCOL.md) pre-registered, with 2024/25 train, 2025/26 sealed holdout and strict provenance limitations; implementation/testing begins on synthetic examples. No live model is trained or forecast published; M3 is unopened. Status and documentation are kept in sync with each guarded PR.

## M1 data foundation accepted — 2026-11-02 (milestone, not a versioned release)

Owner accepted [M1 #124](https://github.com/StanleyLl0yd/FootballForecast/issues/124) after two internal full-repository technical reviews and exact-main CI/Security/CodeQL/browser and Vercel Frankfurt verification. Protected attributed Footbolno RPL ingestion, guarded current-season finalization and immutable private revision history are operational; 2025/26 holdout remains sealed. At acceptance: 616 published matches and 0 published forecasts/trained models. M2 is not authorized. Existing non-gating risks #6, #8, #96 remain tracked.

## 0.1.0 - 2026-10-16

Initial local M0 source preparation: private Next.js app skeleton, Supabase owner gate, SQL RLS/append-only migration draft, time-aware Python contracts, Poisson probability primitive and statistical metrics, preliminary source review and CI definitions. **Unreleased and not deployed.**
