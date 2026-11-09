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

## A3–A7: eligibility before real evaluation

Before a protected real **development-only** study, separately review: per-fixture independent played vs awarded and home/away evidence; source-use eligibility; original UTC fixture confidence; immutable development-source SHA; official club identity continuity; promotion/renaming handling; and a job with least privileges, once-only anchored configuration and aggregate-only report. Reject or abstain if unproven. Never use the original private M2 2024/25 model as a tuned M3 candidate. Predeclare model families and hyperparameters before reading development validation results. Record per-fold N, exclusions, coverage and missingness. Aggregate Log Loss/Brier/RPS is not a claim of superiority without dependent-match uncertainty and independent benchmark coverage.

A bookmaker comparator may run only on **independently time-authenticated**, identical match/cutoff odds. If absent, display **UNAVAILABLE**; never invent prices, backfill late closing odds to midnight or imply a comparative win. Retrospective records without demonstrable first serving before cutoff remain `NON_STRICT_RETROSPECTIVE`.

Owner UI is a private-only read surface with checked owner identity, non-owner access denial and private aggregate evidence; no public server/model artifacts and no hidden administrative write paths.

## A8: exit and release

Exit only after the issue #271 checklist, two distinct complete repository-wide technical audits, all security and regression checks, real production SHA/three-alias verification and **explicit owner acceptance**. Every PR requires exact-head protected checks, signed squash and post-merge verification. No new provider spend or secret; no changes to the 2025/26 M2 one-use claim, historical archives, DB roles, or public forecasts without a distinct reviewed authorization.

## Independent release incident

[Issue #266](https://github.com/StanleyLl0yd/FootballForecast/issues/266) is separate. Owner-triggered read-only monitor run [#42633780456](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/42633780456) **PASS**, while the first independently witnessed scheduled run remains outstanding. The generated `git-main` alias continues to move with staged Git builds. Do not claim the original triggering cause was proven or that monitoring prevents alias assignment.
