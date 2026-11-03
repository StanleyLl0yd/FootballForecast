# Personal RPL forecasting research — seven-season discovery

**Owner decision: 2026-11-03.** FootballForecast is primarily a private, noncommercial RPL probability-forecasting research tool. Public site availability, marketing, advertising and publication of predictions are not success criteria. Keep infrastructure and sources at zero cost.

## Objective and hierarchy

Primary target: calibrated pre-match probabilities for home win, draw and away win. Compare honestly against normalized (overround-removed) bookmaker 1X2 probabilities obtained at matched forecast cutoffs. A lower independent-period Log Loss, backed by uncertainty and sample counts, is the central quality criterion; also report multiclass Brier, ranked probability score (RPS), calibration and coverage. Winning a handful of matches, classification accuracy or hypothetical betting ROI alone does not establish bookmaker superiority.

Secondary: goal totals and score distributions, with no invented historic results or market prices. Keep a price-independent model and an odds-augmented market-correction model separate.

## Data partition, no retrospective leakage

| Seasons | Purpose | Until separately authorized |
|---|---|---|
| 2018/19–2024/25 | Seven-season development candidate, up to 1,680 fixtures before exclusions | Discover sample coverage; do not bulk-import or fit a new model |
| 2025/26 | Existing sealed independent holdout | Never request match rows, results or features until the applicable pre-holdout study lock is approved |
| 2026/27 | Prospective forecast season | Predict only with provenance-confirmed information observed before the exact cutoff |

The existing 2024/25 M2 Independent Poisson model, 1,447-byte private escrow, original source pins, M2 completion conditions and sealed 2025/26 holdout remain UNCHANGED. The multi-season model is a distinct future pre-registered experiment and is NOT part of the frozen M2 baseline. M2 remains 4/8 OPEN; M3 is not authorized. Do not silently apply new features or hyperparameters to the existing M2 model.

Development selection should use expanding-window temporal folds within the development horizon; earliest years primarily initialize team history. Cluster uncertainty by match round and shared clubs. Preserve team promotions/relegations as unseen-team policies, and exclude awarded matches from goals-scored learning unless explicitly modelled as separate administrative outcomes.

## Candidate feature families

1. Baseline: season/date, clubs, home advantage, chronological team strength, rest days, congestion, prior finished goals; rolling historical features use only past matches.
2. Roster and staff: coach appointment intervals, player registration and availability, transfers, injuries, suspensions, lineup announcements and observed minutes. Announced lineups may be used only after their independently recorded publication time.
3. Match context: stadium ID, hosting club, home/neutral status, city, journey distance, field/surface, timezone and recovery time. Venue switches require dated records, not hindsight.
4. Weather: observed historical ERA5 weather is suitable for post-hoc explanatory analysis but **not** automatically a strict retrospective forecast feature. For T-minus-24h or T-minus-60m models use forecast runs actually issued before T where available. Archived forecasts and reanalysis are distinct.
5. Rich events: xG, xA, shots, cards, goalkeeper and tactical rates, calculated from earlier matches only. Missing fields remain missing; do not fill future unavailable information with post-match values.
6. Market control: dated opening/closing bookmaker 1X2 odds plus timestamp, bookmaker/aggregation method and overround. Compare on matched snapshots; closing odds must not leak into an earlier prediction.

Every stored feature needs source identity, retrieval timestamp, source revision/fingerprint, event timestamp, original publication/availability timestamp (nullable), feature computation cutoff and confidence/coverage. If historical publication time is absent, analysis remains NON_STRICT_RETROSPECTIVE, never an authenticated as-of forecast.

## Acquisition and legal boundary

OpenFoot Starter is the primary private research candidate. Only documented free authenticated endpoints within quotas; no paid cursor, scraping, account workaround or unsupported bulk downloads. Other free/open sources can complement fields when independently eligible for private research. Noncommercial or private access does not itself override explicit extraction restrictions. Preserve truthful source identity and any mandatory license notices in private metadata; never commit raw provider responses, API credentials, unapproved match rows, private model weights or private bookmaker data.

## First executable step: aggregate-only seven-season discovery

The existing manually triggered M2 public-source observation workflow gains a separate owner-only input AUDIT_RPL_HISTORY or exact owner issue #182 command /m2-openfoot-history. The job performs **exactly seven** bounded free Starter API calls, one per development season (2018/19 through 2024/25), with no 2025/26 requests and no pagination. The private API key remains a GitHub secret. Provider responses exist only in a runner temporary directory deleted on exit; only match counts, season, sample status and SHA-256 summary appear in the job log. A first-page sample of at most 50 matches **does not establish full-season completeness**, rights, training eligibility or source accuracy.

Follow-up after observed discovery: choose only available seasons for a separately reviewed full directed-fixture audit (240 unique pairs, 16 clubs, 30 rounds), field-specific coverage and event-time quality. Any inability to get all 240 matches on the free tier remains INCONCLUSIVE, not a fake complete season. Never read sealed 2025/26 records to optimize the catalog, mapping or model.

## Initial real source evidence — 2026-11-03

Owner-protected GitHub Actions run #41648185988 sampled all seven development seasons on free Starter: each returned exactly 50 finished records and 16 teams, with source metadata and UTC fields, for 350 sampled rows total. Every page advertised pagination; **none** is a verified full season. The guarded SHA-only record is in [the seven-season sample evidence](M2_SEVEN_SEASON_SAMPLE_EVIDENCE.json). A separate owner-only seven-season team-filter experiment can now examine 16 club views per season (112 plus seven seed GETs), paced below the free Starter 60-requests/minute ceiling. Full structural coverage is still not licence approval, independent historical as-of proof, or model training permission.

## Verified historical season-date exception

The RPL 2019/20 season finished on **22 July 2020** following its COVID-19 suspension ([contemporary club announcement](https://www.fclm.ru/en/news/n/sezon-tinkoff-rpl-vozobnovitsya-21-iyunya-22143/), [dated final-round results](https://www.tntsports.co.uk/football/russian-premier-league/2019-2020/calendar-results.shtml)). The structural audit uses an explicitly bounded 2019/20 calendar allowance through July 2020; it does not weaken the other six season bounds or retroactively authenticate availability timestamps. Original free Starter full-history run #41650108616 ended `INCONCLUSIVE_TEAM_SCHEMA_YEAR_2` before any full-coverage approval. The exception is tested synthetically; the run needs a real replay.

## Real seven-season structural result and score-schema gap

[Owner-only full-team run #41651058492](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41651058492) returned 240 unique fixtures for **each** season 2018/19–2024/25, cross-confirmed in both participating club-filter views: 1,680/1,680 structurally observed fixtures, 16 clubs and 240 reported UTC kickoffs per year, with no paging. However, **0/1,680 final-score pairs were present at the originally checked top-level fields** `homeGoals` and `awayGoals`. Provider documentation names a nested `score` field instead; an owner-only single-GET, count-only diagnostic must establish the exact numeric result path before any normalized training dataset is called eligible. Neither structural coverage nor an unknown score mapping proves source correctness, awarded-game status or historical-as-of availability. [Aggregate receipt](M2_SEVEN_SEASON_FULL_STRUCTURE_EVIDENCE.json).

## Confirmed response score shape — 2026-11-03

Owner-protected [one-GET score-shape run #41652739590](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41652739590) found the finished score on **nested** `score.home` and `score.away` (50/50 of a bounded 2018/19 first-page sample). Neither `homeGoals` nor `awayGoals` exists as a matching top-level numeric pair there (0/50). The full seven-season team-view audit now uses exclusively the empirically observed nested path and compares both team-filter views including their scores. The previously observed 1,680 matches must be **re-audited** to determine all-year goal completeness; first-page evidence alone is not a full historical quality claim. [Pinned aggregate receipt](M2_SEVEN_SEASON_SCORE_SCHEMA_EVIDENCE.json).

## Exit conditions for future multi-season experiment

Before fitting: each development dataset has pinned bytes, legal access scope, verified identities, score/status accuracy and non-overlapping temporal role; freeze model-family menu, features, regularization, temporal folds and market comparator availability. Before the one-time independent test: explicit immutable model lock and owner approval. Report unavailable features as coverage gaps and use ablations; a complex model is promoted only when it beats simpler baselines in development validation.
