
## Weather candidate preflight, synthetic only — 2026-11-05

`rpl_weather_candidate.py` is a **negative eligibility gate**, not a weather downloader, match joiner, or new feature in any real model. It requires UTC historical kickoff and forecast valid hour, model initialization, documented **first availability** at or before 00:00 UTC on match day, and historically valid match venue/coordinates with separate provenance and rights assertions. The 2019/20 July 2020 season extension remains valid; sealed 2025/26 and all non-development seasons are rejected.

A passing candidate only receives `RESEARCH_CANDIDATE_REQUIRES_INDEPENDENT_REVIEW` with model-use flags permanently false. Boolean assertions of external review do not prove the sources. The synthetic tests exercise future/late forecasts, **exact hourly valid-time alignment, explicit bounded per-model forecast horizons**, wrong venue ranges, missing evidence, timezone errors, and holdout exclusion. See [independent source review](RPL_SEVEN_SEASON_ENRICHMENT_SOURCES.md). No weather model training or source import authorized.
**Additional temporal sanity checks (2026-11-05):** A candidate must declare a reviewable per-model maximum lead of 24–384 hours; the actual run-to-valid-time offset must fit within it. An hourly forecast valid instant must be exactly HH:00 UTC. These are **synthetic-only negative eligibility checks**; a caller-provided horizon and nominal current JMA update schedule do not authenticate original 2018–2024 serving times or grant weather rights. No real weather join or fit has been approved.

# RPL seven-season temporal feature contract — development-only

Pre-registered on 2026-11-03. This is a separate pure feature-engineering foundation, not an amendment to the frozen M2 2024/25 Poisson study, not an approved future model, and not authorization to read 2025/26.

## Source boundary

- Only finished matches from 2018/19–2024/25 may be input. A 2025/26 record is rejected regardless of whether it has already been fetched elsewhere. The pure builder additionally requires explicit `result_kind="played"`: numeric goals plus `finished` status alone cannot distinguish goals on the field from an administrative award. The field is a caller assertion, **not** independent proof of an eligible real archive.
- Exact source IDs, played scores, UTC kickoffs, unique directed pairs and date bounds are checked. The COVID-delayed 2019/20 season includes the documented July 2020 extension.
- Pre-game features for UTC calendar day D may use only outcomes with kickoff dates strictly before D. Same-day matches share the unchanged earlier state, regardless of the order of their starts.
- The information cutoff is midnight UTC of match day; the builder never claims the retrospectively obtained records were actually published at that time. Classification remains NON_STRICT_RETROSPECTIVE.
- Clubs are season-isolated: raw provider IDs are not yet independently proven stable across all seven seasons. Longitudinal continuity needs an explicitly reviewed identity map.

## Fixed first candidate feature group

Previous appearances, home/away appearances, last-five-match goals scored/conceded, days since last earlier match, and flags for unseen teams. No future scores, no same-day labels, no post-match xG of the target, no final lineup before publication, and no inferred historical weather forecasts.

The pure Python module football_forecast.research.rpl_temporal_features does no database access, model fitting, scoring or publication. Synthetic CI tests verify shuffle invariance, chronological cutoff isolation, same-day source leakage refusal, cold starts, score changes and sealed season refusal.

## Played goals versus later official-result revisions — 2026-11-05

A public 2022/23 RPL match was actually played, then its official-table result was changed after a disciplinary decision. [Bounded public corroboration](M2_PUBLIC_RPL_RESULT_REVISION_EVIDENCE.json) records the decision and publication/appeal calendar dates, while **exact original first-serving UTC time remains unverified**. The match has not been mapped to private source IDs. The result-revision helper also enforces kickoff within its declared development season, with the July 2020 extension only for 2019/20; mislabelled year/season pairs fail closed.

The pure `rpl_result_revisions.select_result_as_of` helper separates `official_table` (latest result available at cutoff) from `on_field_goals` (latest available actually played score). It requires a UTC-midnight cutoff, strictly increasing original-availability UTC instants and a caller assertion of independent first-availability verification. Missing timestamps, conflicting versions, awarded-only played goals and sealed 2025/26 fail closed. Even passing these synthetic checks **cannot authenticate** historical publication, private fixture identity, licensing or eligibility for real training. No real seven-season archive has been passed through this helper.

## Historical archive rights boundary — 2026-11-05

[Public source-rights review](M2_HISTORICAL_SOURCE_RIGHTS_GATE_EVIDENCE.json) distinguishes the OpenFootball repository's CC0 declaration, the RFS restriction on reuse of copyright-covered site materials, and the RSSSF homepage's limited acknowledgement language. None independently verifies the original authority and training eligibility of every archived fixture or provides original first-serving timestamps. This is a **manual reference-only check**, not bulk download approval or a ban on quoting public match facts. Private source joins, fitting and held-out evaluation remain prohibited.

## Further research

Next: independent source-club identity mapping and as-of evidence for staff, roster, venue, weather and odds; separately preregister development-only 2020/21–2024/25 expanding-window model validation. No historical bookmaker superiority claims until independently matched vig-adjusted market odds are available; holdout 2025/26 remains sealed and M3 unauthorized.

## Next fixed fold and market research boundary

Five fixed expanding training/validation splits and a synthetic-only bookmaker no-vig metric contract are now separately preregistered in [RPL seven-season development protocol](RPL_SEVEN_SEASON_DEVELOPMENT_PROTOCOL.md). Neither the fold constructor nor the benchmark fetches private match rows, fits a real model, queries 2025/26, reads historical bookmaker odds or makes accuracy claims.
