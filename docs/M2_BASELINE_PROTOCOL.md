# M2 baseline protocol — pre-registered before real training

**Historical v1 only — not a live source mandate.** On 2026-11-03 the owner authorized a separate [OpenFootball calendar-only study](M2_OPENFOOTBALL_PROTOCOL.md) rather than waiting for Footbolno. The frozen v1 proof, source identity and holdout rules remain historical and cannot be silently rewritten; M2 remains 4/8 and holdout sealed.

**Status:** M2 OPEN, owner-authorized 2026-11-02 ([#182](https://github.com/StanleyLl0yd/FootballForecast/issues/182)). **Protocol version: `m2-independent-poisson-v1`**, frozen before observing any sealed 2025/26 holdout score or model metric. The document is part of the code-reviewed project; changing a decision after inspecting holdout labels requires a new, explicitly non-comparable study and a separate validation sample. **M3 remains closed.**

## Data partition and research integrity

| Role | Season | Permitted operation |
| --- | --- | --- |
| `train_baseline` | RPL 2024/25 | 240 licensed, finished, non-awarded matches, with original fixture and result provenance; estimate pre-specified baseline coefficients only |
| `sealed_holdout` | RPL 2025/26 | 240 private labels remain sealed; one fixed, independent score evaluation when provenance and mapping gates are accepted; never train, select model, tune penalty or calibrate on this data |
| `current` | RPL 2026/27 | Only for *future* consented operations with verified as-of timestamps. Current/future target scores are never trainable labels |

Training is **blocked** unless the source dataset identity, licence, role, normalized full-season directed fixtures, actual play status and match scores pass independently documented QC. The repository intentionally contains no raw production dataset. CI tests train on conspicuously synthetic fixtures only. Separately owner-triggered protected jobs may fit an ephemeral training-only research candidate on the approved stored 2024/25 cohort, without conferring model-lock approval; the private snapshots remain inaccessible to browser roles. No production model, database write or public forecast is authorized by this document alone.

The 2026 retrospective retrieval of historical results cannot establish what was published before each 2025/26 kickoff. Any initial fixed-season historical comparison must therefore be called **non-strict retrospective**, **not** a timestamp-authenticated walk-forward backtest or published predictive accuracy. When unobservable, preserve this limitation rather than inferring publication time from event date or ingestion time.

## Fixed baseline family

Use a **single independent Poisson** model, `H/D/A` order, with shared log-scale parameters:

```text
lambda_home = exp(mu + home_advantage + attack[home] - defence[away])
lambda_away = exp(mu + attack[away] - defence[home])
sum(attack) = 0; sum(defence) = 0
```

- Compute `mu` and shared `home_advantage` **from training season only**; estimate bounded attack/defence log effects by regularized Poisson negative log-likelihood. Set **L2 per-team penalty = 2.0**, home-advantage L2 = 2.0. No optimizer/hyperparameter selection using 2025/26. Effects constrained to a zero-mean identifiable parameterization; convergence must be deterministic and fail closed.
- Target **16 identified training teams** and exactly **240 finished directed fixtures** for the first real training job; synthetic unit tests may use smaller samples, explicitly marked synthetic. Duplicate match IDs/directed fixtures, same-team fixtures, mismatched seasons, naive timestamps, impossible goals or ambiguous/awarded match status fail closed.
- No unseen-club strengths may be inferred from 2025/26 results or normalized using future season labels. **Abstain with `INSUFFICIENT_DATA`** when a 2025/26 target club was absent from 2024/25, or when a future kickoff/as-of status is unverified. This is not a guess of a promoted club's ability.
- Fixed training-only per-club sample threshold: **16 matches** (per team). Exclude incomplete team coverage and refuse real-fit claims if this condition is unmet. Do not tune the threshold on holdout.
- Use the existing adaptive Poisson score enumerator, which separately accounts for truncated score-grid tail; only normalize final H/D/A probabilities after mathematically integrating the tail.

## One-time offline evaluation, if data quality permits

- Lock the model/protocol, SHA-256 source dataset reference, fixed team mapping, code SHA and fit output digest **before** any holdout read. Generate a single immutable aggregate report: number of eligible matches, exclusions by reason, mean multiclass **Log Loss**, multiclass **Brier (sum over H/D/A, not divided by 3)**, and **RPS** for the two cumulative thresholds. Record comparisons to a pre-specified **train-season-only empirical H/D/A frequency** baseline, and clustered uncertainty with clubs/rounds (not an iid match bootstrap); if uncertainty is nonidentifiable report `INCONCLUSIVE`.
- **No calibrated/superiority claim.** Calibration, hyperparameter tuning, Dixon–Coles/Elo champion selection and validation require independent cohort or preregistered prospective splits. Reserve formal validation to M3 unless genuinely independent licensed data is obtained.
- Never write retrospective predictions to live `ff_forecasts` or the immutable public production archive. Live publication requires separate pre-kickoff evidence, owner-authorized writer, transaction and data-source freshness gates.

## Safety and cost

All work remains $0 using current Free/Hobby and protected GitHub Actions. No commercial bulk scraping, paid API, unauthorized private raw export to artifacts, personal data or new browser write capability. Keep M1 RLS/holdout/protected-merge invariants and existing non-gating risks #6/#8/#96. CI may use only synthetic fixtures and do not label synthetic metrics as real match evaluation.

## Protected training input candidate

The separate [M2 training-input contract](M2_TRAINING_INPUT.md) documents an explicitly pinned, privately invoked, bounded 2024/25-only read surface. Its SQL and Python checks are not an authorization to train a real model, open 2025/26 holdout labels, publish predictions or assert a timestamp-authenticated historical backtest.

## Conditional model-family decision — 2026-11-02

**M2 issue #182, conditional candidate-selection task: ACCEPTED BY DEFERRAL, not
by Elo/Dixon–Coles benchmarking.** The pre-registered Independent Poisson v1
is the only currently eligible fixed baseline. No second independent,
rights-cleared, fully provenance-reviewed validation cohort exists within the
approved M2 three-season design:

| RPL cohort | Scope | Can it tune/rank alternative families? |
| --- | --- | --- |
| 2024/25 | Fixed 240-match `train_baseline`; 16 clubs | **No**: used for fitting the sole frozen baseline; training fit quality is not independent validation |
| 2025/26 | Sealed 240-match `sealed_holdout` | **No**: cannot be used for Elo/Dixon–Coles selection, regularization, calibration, aliases or thresholds |
| 2026/27 | Current-season records and future fixtures | **No**: incomplete, with no verified historical pre-match-as-of cohort; live result labels are not permitted for this retrospective choice |
| Earlier seasons/other free sources | Not separately accepted for training/validation in M2 | **No** until independently licensed, identified, quality-checked and temporally appropriate |

**Decision:** do not fit, optimize, compare or publish Elo/Dixon–Coles contenders
in M2; no leaderboard, champion/challenger selection, calibration curves,
hyperparameter search or test-season model switching. These are deferred
**experimental hypotheses**, not rejected due to any measured performance.
If a genuinely independent and appropriately timestamped validation cohort
is later accepted, prepare a new prospective protocol before inspecting
its scores. M3 remains unauthorized until explicit owner acceptance of M2.
Future single fixed-Poisson non-strict retrospective scoring, if separately
authorized after a protected source-corroborated lock, must not be repurposed
as validation of alternative model families.

This closes only the conditional model-family decision criterion; it does
**not** close the separate source-verification, holdout evaluation, immutable
study artifact, UI authorization or two full repository-wide audit gates.
