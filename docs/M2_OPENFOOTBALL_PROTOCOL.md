# M2 OpenFootball-first calendar-only train experiment — frozen before first run

**Pre-registered 2026-11-03.** Owner directed FootballForecast to proceed without
Footbolno as a required source. This is a **separate research protocol**
`m2-openfootball-calendar-v1`; it does not retroactively rewrite the
`m2-independent-poisson-v1` source-specific study, reuse an approved model,
or change the original 2025/26 sealed holdout. M2 #182 remains OPEN, 4/8;
M3 and production prediction publication remain unauthorized.

## Source identity and eligibility

- **Only input:** OpenFootball `openfootball/europe` CC0-1.0, exact Git
  commit `63df627f3c87ce71708f016522ea236cf74332c3`,
  file `russia/2024-25_ru1.txt`, Git blob
  `6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc`.
  Verify the raw Git blob **before** any parse; record raw SHA-256.
- Train cohort: exactly **240 ordinary played, scored, uniquely directed RPL
  2024/25 fixtures**, 16 identifiable teams, 30 rounds / eight games per round,
  30 matches per team; reject awards, duplicates, invalid dates, invalid scores,
  incomplete calendars, ambiguous team identities and source substitutions.
- Original text contains **calendar dates**. No independently authenticated
  kickoff UTC instant, final-whistle instant or pre-match publication revision.
  Keep these fields absent, not inferred from calendar midnight or textual
  local time. This research can fit a full prior-season baseline, **not**
  assert strict point-in-time match or lineup availability.
- Deterministic, train-only irreversible aliases derive from **exact training
  text names** as `S_` + first 20 uppercase hex of
  SHA-256(`openfootball-2024-club:` + name). IDs derive exclusively from the
  ordered names of the directed match. No holdout-aware aliases or fuzzy
  normalization. Same-name ambiguities fail closed.

## Fixed model and reproducibility

- Exactly the already pre-registered `fit_independent_poisson` mathematical
  solver: L2 per-team `2.0`, home-advantage L2 `2.0`, zero-mean effects,
  deterministic optimizer, independent Poisson goal rates, no Elo, Dixon–Coles,
  tuning, calibration or other candidate selection.
- Calendar fixtures are a distinct type with `source_calendar_date: date`,
  **not** `kickoff_at: datetime`. The source calendar day has **no authenticated timezone**, so it is not labeled UTC. Mixing types fails closed. Sort solely by
  original source calendar date + deterministic match identity for reproducibility; never
  fabricate or store a kickoff timestamp.
- A *manual owner-only* protected-main workflow fetches this exact public file,
  checks its raw Git blob, validates the round-robin and fits the model in
  ephemeral RAM. Outputs only fixed allowlisted aggregate counts and SHA-256 of
  source bytes, normalized training rows, aliases and fitted coefficients,
  plus actual Git SHA. Private fixture JSON and model weights are deleted on
  runner teardown. No live database credentials, SQL, provider data writes,
  artifacts, model escrow, public forecast or holdout read.
- A successful research job is **not** model approval, published accuracy,
  immutable study lock or true upstream source independence. Record all
  receipts as `TRAIN_ONLY_UNAPPROVED`.

## Verified temporary train replay — 2026-11-03

Two owner-authored protected-main independent research runs [#41601074078](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41601074078) and [#41601164752](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41601164752) both succeeded at exact code SHA `b7812c531a7284a4db58c34ed77af8adeecf8d1f`. Receipt SHA-256 `381159c8928283c6f3d9a2b75bda4ee53d1b9a41f31184d5cd9a14ec267306b6` matched; 240/16 fixtures, H/D/A 103/65/72, identical source/training/club/model digests. The [aggregate-only recorded evidence](M2_OPENFOOTBALL_TRAIN_REPLAY_EVIDENCE.json) links both job IDs; it does not include source records or trained coefficients. Neither run authenticates historical pre-match availability or grants a model lock. The owner page validates its closed schema and SHA locally on the server **after** `requireOwner()`.

## Real public-source outcome — 2026-11-03

[Protected observation #41613346756](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41613346756) has been recorded as [strict aggregate-only evidence](M2_PUBLIC_SOURCE_OBSERVATION_EVIDENCE.json). OpenFootball pinned training reference: 240/16. OpenFoot public demo: only five records (ten clubs), incomplete 2026/27 coverage. SportScore: zero current-day observed matches on one UTC day, not a proof that no fixtures exist. The HTTP response hashes and job IDs are pinned; the original holdout and model lock gates remain unchanged. The owner-only research interface shows **unapproved** observations, not selectable model inputs.

## One-shot alternative current fixture diagnostic

The same existing M2 manual owner-only source-observation workflow may perform **one** separate public-demo, free OpenFoot API request for RPL 2026/27, using documented competition/season filters. It validates only in-memory response shape/aggregate and prints a SHA; all outcomes, even a synthetic complete 240/16 cohort, are explicitly **UNAPPROVED** for model training, live data replacement, pre-match prediction or publication. The OpenFoot trial neither changes nor supplies independent 2025/26 sealed-holdout labels and does not relax the calendar-only 2024/25 training protocol.

## Sealed holdout and live current-season policy

- **2025/26 remains sealed**. The old Footbolno-derived holdout cannot become a
  substitute training cohort. A separate permitted, pinned and quality-checked
  2025/26 evaluation source, deterministic source-team mapping from the
  training-only aliases, protected immutable real model escrow/lock and
  authenticated single-use scorer must be independently accepted **before**
  any labeled evaluation. A prior source agreement report is not an unsealing
  authorization; do not read/migrate/score holdout as part of this protocol.
- OpenFootball's checked pinned RPL tree has no complete 2025/26 or
  current 2026/27 RPL fixtures. Current-match data must come from a separately
  rights-verified, full-coverage and timestamp-qualified **free** source.
  SportScore's previously documented **one-day diagnostic is not** a production
  ingestion or full-season feed. With no eligible source, return stale/unknown,
  **never invent a fixture, a result, a future kickoff or a forecast**.
- Disable recurring Footbolno fetch/import workflows while retaining immutable
  historical Supabase data, migration history and explicitly manual legacy
  recovery commands. No Footbolno requirement is introduced in the new study.
- $0 only, public pages read-only, owner identity fail-closed; RLS and protected
  branch policies remain intact. M2 full exit still needs all acceptance checks,
  two complete repository-wide audits and explicit owner sign-off.
