
## Weather candidate preflight, synthetic only — 2026-11-05

`rpl_weather_candidate.py` is a **negative eligibility gate**, not a weather downloader, match joiner, or new feature in any real model. It requires UTC historical kickoff and forecast valid hour, model initialization, documented **first availability** at or before 00:00 UTC on match day, and historically valid match venue/coordinates with separate provenance and rights assertions. The 2019/20 July 2020 season extension remains valid; sealed 2025/26 and all non-development seasons are rejected.

A passing candidate only receives `RESEARCH_CANDIDATE_REQUIRES_INDEPENDENT_REVIEW` with model-use flags permanently false. Boolean assertions of external review do not prove the sources. The 26 synthetic tests exercise future/late forecasts, wrong venue ranges, missing evidence, timezone errors, and holdout exclusion. See [independent source review](RPL_SEVEN_SEASON_ENRICHMENT_SOURCES.md). No weather model training or source import authorized.
# RPL seven-season temporal feature contract — development-only

Pre-registered on 2026-11-03. This is a separate pure feature-engineering foundation, not an amendment to the frozen M2 2024/25 Poisson study, not an approved future model, and not authorization to read 2025/26.

## Source boundary

- Only finished matches from 2018/19–2024/25 may be input. A 2025/26 record is rejected regardless of whether it has already been fetched elsewhere.
- Exact source IDs, played scores, UTC kickoffs, unique directed pairs and date bounds are checked. The COVID-delayed 2019/20 season includes the documented July 2020 extension.
- Pre-game features for UTC calendar day D may use only outcomes with kickoff dates strictly before D. Same-day matches share the unchanged earlier state, regardless of the order of their starts.
- The information cutoff is midnight UTC of match day; the builder never claims the retrospectively obtained records were actually published at that time. Classification remains NON_STRICT_RETROSPECTIVE.
- Clubs are season-isolated: raw provider IDs are not yet independently proven stable across all seven seasons. Longitudinal continuity needs an explicitly reviewed identity map.

## Fixed first candidate feature group

Previous appearances, home/away appearances, last-five-match goals scored/conceded, days since last earlier match, and flags for unseen teams. No future scores, no same-day labels, no post-match xG of the target, no final lineup before publication, and no inferred historical weather forecasts.

The pure Python module football_forecast.research.rpl_temporal_features does no database access, model fitting, scoring or publication. Synthetic CI tests verify shuffle invariance, chronological cutoff isolation, same-day source leakage refusal, cold starts, score changes and sealed season refusal.

## Further research

Next: independent source-club identity mapping and as-of evidence for staff, roster, venue, weather and odds; separately preregister development-only 2020/21–2024/25 expanding-window model validation. No historical bookmaker superiority claims until independently matched vig-adjusted market odds are available; holdout 2025/26 remains sealed and M3 unauthorized.

## Next fixed fold and market research boundary

Five fixed expanding training/validation splits and a synthetic-only bookmaker no-vig metric contract are now separately preregistered in [RPL seven-season development protocol](RPL_SEVEN_SEASON_DEVELOPMENT_PROTOCOL.md). Neither the fold constructor nor the benchmark fetches private match rows, fits a real model, queries 2025/26, reads historical bookmaker odds or makes accuracy claims.
