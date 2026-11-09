# M3 private calibration and evaluation protocol — v1

**Authorized for development by the owner 2026-11-09** after accepting M2 on the same day. [M3 tracking and eight exit gates](https://github.com/StanleyLl0yd/FootballForecast/issues/271). M3 is **OPEN / IN PROGRESS**, not ACCEPTED. Previous pre-authorization statements in older M2 research and audit documents are dated history. This document does not supersede the fixed M2 model or the one-use 2025/26 study evidence.

## Intended product

A **private owner research workbench**, preferably browser-first, where eligible historical RPL development studies can be inspected, compared and rejected without claiming more than the evidence supports. First deliver reproducible baseline and scoring. Further deliver responsible model alternatives, development cross-validation, calibration/uncertainty and an owner-only GUI. Public predictions and live model jobs are **M4 or separately approved operations**, not automatic consequences of M3.

## Fixed dataset and leakage boundary

- Development years: exactly `2018/19`, `2019/20`, `2020/21`, `2021/22`, `2022/23`, `2023/24`, `2024/25`. There are seven private historical source snapshots (1,680 provider-finished matches), but **not** an independently attested 1,680-match played-goal training cohort.
- Sealed/consumed **2025/26 is excluded altogether**. The one permitted M2 retrospective attempt consumed the 2025/26 claim: 182 eligible / 58 abstentions. Never query/re-score/tune on these matches or treat them as an independent test for M3.
- `2026/27` can be used prospectively in a future separately approved step. It is not a development fold or available retrospective label set.
- Five **predeclared** expanding-window validation seasons, always 240 scheduled source fixtures per year before eligibility exclusions:

| Fold | Training years | Nominal train N | Validation year |
| --- | --- | ---: | --- |
| F1 | 2018/19–2019/20 | 480 | 2020/21 |
| F2 | 2018/19–2020/21 | 720 | 2021/22 |
| F3 | 2018/19–2021/22 | 960 | 2022/23 |
| F4 | 2018/19–2022/23 | 1,200 | 2023/24 |
| F5 | 2018/19–2023/24 | 1,440 | 2024/25 |

No training on the validation season's results for that fold. No same-day outcome may be used in a prior-day feature, and club ID continuity needs independent review before cross-season club-strength fitting. The COVID-extended 2019/20 season and award/revision semantics require explicit handling. **Nominal N is not eligible N.** Do not silently replace unverified played-goal rows or dates with a convenient label.

## A2: first executable synthetic-only baseline

`ml/src/football_forecast/research/m3_development_baseline.py` implements a **no-I/O, no-DB, no-network, no-forecast-publication** reference computation:

1. Validate the entire seven-year synthetic double round-robin via `plan_expanding_development_folds`, including UTC season bounds, played-score declaration, directed pair/identity uniqueness and daily schedule impossibility.
2. Accept only `synthetic_*` test fixture identifiers as a defensive local scope limit. **String prefix is not actual source attestation**; this module is neither a real-source loader nor permission for real data.
3. For each fold, count **home win/draw/away win** outcomes only in its training seasons. Fixed H/D/A class order is `(0, 1, 2)`.
4. Use the *frozen*, unoptimized Dirichlet/Laplace(1,1,1) prior: `P(class i) = (training_count_i + 1) / (training_N + 3)`. No hyperparameter search, club features, odds, learning from validation season, or post-hoc calibration.
5. Score all 240 **synthetic** validation fixtures per fold with proper multiclass Log Loss, Brier (sum over three classes) and RPS (first two cumulative thresholds). Return only aggregates: five fold means, nominal training/scoring counts, fold probabilities, and N-weighted pooled means across 1,200 synthetic outcomes.
6. Mark every result `NON_STRICT_RETROSPECTIVE`, `synthetic_only`, and explicitly **no real-source approval, holdout read or bookmaker superiority**. The numbers are engineering controls, **not model performance on real RPL matches**.

Negative tests: unavailable/malformed/2025–26 inputs, awarded/unknown results, duplicate/incomplete fixtures, input permutation, and future-validation-label changes must not refit the same fold's probabilities. Production and existing M2 endpoints must not import/execute this module.

## A3 source-readiness checkpoint (partial, not accepted)

An [aggregate-only seven-season source review](M3_SOURCE_READINESS_2026-11-09.md) and pure refusal gate now distinguish 1,680 private **provider-finished** rows, 1,200 public CC0 structurally observed rows across five seasons, six confirmed public technical awards, one false 2023/24 home/away direction and 47 public rows lacking inline clock. These observations do not identify which private fixtures are played and exclude **zero proven** private rows. The two CC0 paths missing for 2021/22 and 2022/23 have alternative RSSSF retrospective archives but are not cross-mapped. No real training or model evaluation is authorized; A3 remains open until independently reviewed row-level coverage, rights, time and club continuity. Do not subtract public anomalies from private counts without a verified crosswalk.

## A4 candidate preparation: synthetic multi-season team Poisson (NOT A4 acceptance)

`ml/src/football_forecast/research/m3_synthetic_team_poisson.py` implements a **different** predeclared, deterministic five-fold candidate. The existing M2 stored Poisson solver/coefficient escrow stays frozen; only the generic already-tested `poisson_score_distribution` computational primitive is reused. No live DB, model persistence, provider API, historical rows or real match evaluation.

Freeze these values **before any real development data eligibility decision**: `TEAM_PSEUDO_MATCHES=12`, `LEAGUE_PRIOR_MATCHES=20`, `HOME_GOALS_PRIOR=1.35`, `AWAY_GOALS_PRIOR=1.05`, `MIN_RATE=0.05`, `MAX_RATE=6.0`; version `m3-synthetic-team-poisson-shrink12-v1`. No fit search, priors tuned on outcomes or calibration after seeing the already-consumed 2025/26 test.

For each fold, let `N` be only its earlier training-year matches. Set the smoothed league home/away rates to:

- `μH=(Σ training home goals + 20×1.35)/(N+20)`
- `μA=(Σ training away goals + 20×1.05)/(N+20)`

For training-year club `h` in home fixtures and `a` in away fixtures, estimate:

- `attackH(h)=(home goals scored by h +12×μH)/(home games by h +12)`
- `defenceH(a)=(home goals conceded by a when away +12×μH)/(away games by a +12)`
- `attackA(a)=(away goals scored by a +12×μA)/(away games by a +12)`
- `defenceA(h)=(away goals conceded by h when home +12×μA)/(home games by h +12)`
- `λH=clamp(attackH(h)×defenceH(a)/μH,0.05,6.0)`; `λA=clamp(attackA(a)×defenceA(h)/μA,0.05,6.0)`.

Use the existing independent-Poisson score-distribution integration to obtain a normalized H/D/A triple, including unseen score-grid tail. Unseen **synthetic** clubs receive prior-only rates (`n=0`). For each fold, **validation goals are never fitted into that fold's λ parameters**: outcomes are used only for proper Log Loss, multiclass Brier and RPS on 240 synthetic validation matches. Emit only the five aggregate scores, count of fictional unseen-team fixtures and SHA-256 synthetic training-state digest; no fixture-level predictions or real team IDs. The fold train SHA must stay constant if its own validation scores change, independent of input ordering. Earlier validation seasons are permitted as training only for *later* folds.

The synthetic club IDs in fixture tests happen to be consistent over seven seasons; this does **not** validate real longitudinal club identities. Real training is blocked by A3 until independent club-continuity, played-goal, source rights and historical time gates are satisfied. The currently frozen source snapshots do **not** provide this proof. A4 stays **OPEN (synthetic candidate only)**. A5 is not run and no real model superiority or fit is claimed.

## A3 database and fixture-level triage (preparation only, not acceptance)

A direct read-only database observation on 2026-11-09 independently reconfirmed the seven private historical seasons (7×240), 16 clubs/season, no original historical publication timestamps, and FORCE RLS/no anon, authenticated or service-role SELECT grants. [Bounded aggregate receipt](M3_PRIVATE_HISTORY_DATE_TRIAGE_EVIDENCE.json) records six separate days with one private 3:0/0:3 provider result each, coincident with six *public* technical-result dates; **this is date/scoreline evidence, NOT per-fixture club or source-ID proof**. No private rows were exported, altered, trained or evaluated.

The [A3 fixture evidence protocol](M3_FIXTURE_ELIGIBILITY_TRIAGE_PROTOCOL.md) documents a new pure synthetic-tested cross-provider comparator. It requires an explicitly declared per-season club-identity mapping and a pinned independent-source digest, distinguishes played score agreement vs technical-award vs official revision, date errors, home/away reversal and ambiguity, and returns per-season aggregate counts only. **Even perfect matching remains a candidate, never real training authorization.** All rights, original UTC publication time and actual independently reviewed private per-row correspondence remain unresolved. The 2025/26 holdout was not read. A3 stays OPEN.

## A3–A7: eligibility before real evaluation

Before a protected real **development-only** study, separately review: per-fixture independent played vs awarded and home/away evidence; source-use eligibility; original UTC fixture confidence; immutable development-source SHA; official club identity continuity; promotion/renaming handling; and a job with least privileges, once-only anchored configuration and aggregate-only report. Reject or abstain if unproven. Never use the original private M2 2024/25 model as a tuned M3 candidate. Predeclare model families and hyperparameters before reading development validation results. Record per-fold N, exclusions, coverage and missingness. Aggregate Log Loss/Brier/RPS is not a claim of superiority without dependent-match uncertainty and independent benchmark coverage.

A bookmaker comparator may run only on **independently time-authenticated**, identical match/cutoff odds. If absent, display **UNAVAILABLE**; never invent prices, backfill late closing odds to midnight or imply a comparative win. Retrospective records without demonstrable first serving before cutoff remain `NON_STRICT_RETROSPECTIVE`.

Owner UI is a private-only read surface with checked owner identity, non-owner access denial and private aggregate evidence; no public server/model artifacts and no hidden administrative write paths.

## A8: exit and release

Exit only after the issue #271 checklist, two distinct complete repository-wide technical audits, all security and regression checks, real production SHA/three-alias verification and **explicit owner acceptance**. Every PR requires exact-head protected checks, signed squash and post-merge verification. No new provider spend or secret; no changes to the 2025/26 M2 one-use claim, historical archives, DB roles, or public forecasts without a distinct reviewed authorization.

## Independent release incident

[Issue #266](https://github.com/StanleyLl0yd/FootballForecast/issues/266) is separate. Owner-triggered read-only monitor run [#42633780456](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/42633780456) **PASS**, while the first independently witnessed scheduled run remains outstanding. The generated `git-main` alias continues to move with staged Git builds. Do not claim the original triggering cause was proven or that monitoring prevents alias assignment.
