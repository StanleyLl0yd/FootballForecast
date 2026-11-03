# RPL seven-season development folds and bookmaker benchmark — v1

**Pre-registered 2026-11-03.** This is a *separate*, personal, noncommercial research design. It is not M2's frozen `m2-independent-poisson-v1` source/model lock and gives **no authorization** to access the sealed 2025/26 outcomes or launch M3.

## Data and first independent steps

- Private OpenFoot Starter RPL archive, **2018/19–2024/25**, seven immutable 240-match snapshots, 1,680 finished matches. Provenance and source digests are pinned in [private archive evidence](M2_PRIVATE_RPL_HISTORY_EVIDENCE.json). This establishes provider-internal consistency, **not** independent official result truth or historical publisher publication time.
- `football_forecast.research.rpl_development_folds` creates five fixed expanding-window folds **without fitting or scoring**. The source of each fold is all earlier complete seasons; the validation season is exactly the next season.
- A complete directed competition must have 16 clubs, each with exactly 15 home and 15 away fixtures. Incomplete seasons, duplicate identities, altered scores, naive dates, overlap between training and validation periods, unknown seasons and sealed-year records fail closed.
- Consecutive-season club-ID overlap was measured privately without exposing team identifiers: **14, 14, 14, 13, 14, 13** of 16, respectively. This is only an identity-continuity *signal*, not permission to infer a persistent club mapping. Require independently reviewed per-club continuity and promotion/renaming policy before any multi-season strength fitting.

| Fixed fold | Train seasons | Train matches | Development validation | Matches |
| --- | --- | ---: | --- | ---: |
| F1 | 2018/19–2019/20 | 480 | 2020/21 | 240 |
| F2 | 2018/19–2020/21 | 720 | 2021/22 | 240 |
| F3 | 2018/19–2021/22 | 960 | 2022/23 | 240 |
| F4 | 2018/19–2022/23 | 1,200 | 2023/24 | 240 |
| F5 | 2018/19–2023/24 | 1,440 | 2024/25 | 240 |

**Frozen design:** folds are not shuffled and cannot be selected after seeing their scores. Club-strength estimates cannot use scores of the fold's validation season. Previous-day feature states may use past results *within* a validation season only when strictly older than the forecast's UTC calendar day; this is prequential covariate updating, **not** permission to refit strengths using current-season labels. No 2025/26 record belongs to any fold. The seven-season feature engineer remains `NON_STRICT_RETROSPECTIVE`: a 2026 retrieval does not prove the facts were originally published before the historical kickoff.

### Models and calibration, later gated work

First implement a *new, separate* seven-season model in its own module and protocol version only after club identity resolution and source eligibility review. Initial baselines are a frozen training-season H/D/A frequency baseline and a development-only multiseason Poisson model with pre-specified regularization, club promotion policy and deterministic fit. Do **not** modify, reuse as new results or silently expand the 2024/25 independent Poisson model stored for existing M2. Report proper scores **per validation season**, denominators, abstentions and coverage; then compare across all five folds. Any selection between model families or calibration curves must be based **only** on these development folds and preregistered before scoring the sealed independent holdout. Missing time-as-of provenance means only retrospective exploratory claims.

## Bookmaker-market comparison: exact matched timing

`football_forecast.research.rpl_market_benchmark` is a **pure synthetic-tested metric helper**, not a downloader, odds database, betting recommendation, prediction publication or historical source attestation.

- One same-bookmaker 1X2 **H,D,A** decimal-odds triple, observed at or before the model's UTC **00:00 match-day cutoff**, with a maximum age **36 hours**. Only authenticated historical quote observations are eligible; closing odds from a later time cannot serve as an earlier market comparator. Reject odds that cannot be attested, cannot be matched to a source match ID or arrive after cutoff. Merely setting `historically_captured_before_cutoff=True` in memory does **not** independently authenticate the original quote.
- The overround is `sum(1/odds)`. Accept only complete positive bookmaker margins from **1.00 to 1.30**; divide each inverse odd by this sum to get normalized no-vig H/D/A probabilities. Reject implausible/arbitrage/missing prices, duplicates, naive/shifted timestamps and records outside development validation seasons.
- Primary paired metric is **mean model Log Loss minus market Log Loss** on exactly the same matched fixtures (negative favors the model), plus the corresponding H/D/A Brier sum and 2-threshold RPS. Always report **matched N and unavailable-odds N**. Never compare a model's full dataset with the bookmaker's smaller subset.
- Current pure evaluator returns `bookmaker_superiority_claimed=false` and `uncertainty=INCONCLUSIVE_DEPENDENT_MATCHES` even if raw paired means favor the model. Uncertainty accounting for repeated clubs/seasons and independent as-of proof are separate mandatory gates. Without legitimate historical quotes there is **no real bookmaker benchmark**.

## Research security and release gates

1. **Completed:** source discovery and private 7×240 snapshot import; first prior-day feature builder; pure fold design and odds-metric contract, with synthetic-only tests.
2. **Unfinished:** independent team/coach/player identity crosswalk; source-availability dates; ethically eligible historical bookmaker price observations; archived weather forecasts (as opposed to observed post-hoc weather); proper dynamic feature coverage.
3. **Unfinished:** separately approved seven-season model fitting, model selection and historical retrospective scoring, with model/feature code SHA and frozen fixed fold manifest.
4. **Strictly unchanged:** the existing M2 Poisson 2024/25 private escrow, immutability and M2 study-lock requirements; **2025/26 remains sealed** until a separately independently approved lock and single-use evaluation; no M3, publicly published forecasts or unverified superiority statements.

This protocol alone does not approve a read of the private real match rows for a multi-season fit; future owner-only execution needs protected verified data permissions and a distinct model study anchor. Never include raw match IDs, raw odds, player data, private coefficients or private team aliases in public GitHub artifacts.
