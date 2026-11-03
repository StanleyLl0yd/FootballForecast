# RPL seven-season enrichment: actual first-page evidence and next sources

**Owner-run:** [M2 seven-season identity and field-shape observation #41674569785](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41674569785), 2026-11-03. Source: authenticated free OpenFoot Starter. All raw responses, private club IDs/names and individual match data were discarded by the runner; only aggregate counts and SHA-256 appear in Git.

## What is now established

- **Seven historical first pages**, each 50 finished matches, 16 clubs; 350 first-page responses in total. No 2025/26 request.
- **26 unique source club IDs**. The 6 adjacent-year ID overlaps are `14/14/14/13/14/13`. All **82 shared-ID adjacent-year occurrences** preserve the same normalized display name in these pages. No missing or contradictory names within any sampled season. This independently agrees with our private database *counts*, but is **not** independent verification of the real-world identity of each club.
- For candidate JSON keys probed for **stadium, city, surface, weather, coaches, lineups, players, xG, shots and bookmaker odds**, **0/350 sampled records** returned a nonempty candidate group. The detailed per-season counts are in [SHA-only source evidence](M2_RPL_TEAM_IDENTITY_SAMPLE_EVIDENCE.json). This is only a *first-page key-shape* observation; it does **not** prove that all historical matches lack these fields or that additional authenticated endpoints cannot supply them.
- Full archived match results remain **7×240/1,680**, privately stored in `ff_private`; the existing frozen M2 Poisson escrow and sealed 2025/26 holdout remain untouched.

## Prioritized noncommercial, zero-cost source qualification

| Target | Candidate | What must be proven before source adoption |
|---|---|---|
| **xG, shots, match events, lineups, odds** | [SStats.net API](https://api.sstats.net/docs/) | Official free API documents these fields; **RPL seasons and data completeness unverified**, terms for private training and timestamp of odds/results must be separately qualified. Use only official documented API, bounded free quota. |
| **Stadium, city, coach identity and dated changes** | [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access) CC0, [TheSportsDB](https://api.thesportsdb.com/documentation) free API | Venue coordinates require historical dates and neutral/changed grounds; coach appointment dates and club/player aliases need independent verification. Current team metadata must not be backdated. |
| **Weather** | [Open-Meteo Historical Forecast](https://open-meteo.com/en/docs/historical-forecast-api) | Archive covers historical forecasts primarily from **2022 onward**; verify forecast *issuance before the match's exact cutoff* and venue coordinates/timezones. Earlier reanalysis can support descriptive explanatory studies, never pretend known 24h before kickoff. |
| **Market benchmark odds** | SStats.net, limited reference [Football-Data.co.uk Russia](https://football-data.co.uk/russia.php) | Require exactly matched 1X2 prices and a source-authenticated quotation recorded before the UTC midnight model cutoff. Football-Data.co.uk contains historical Russian odds but exact quote timestamps and ML rights are not yet accepted. Later closing odds cannot serve as earlier model-time benchmark. |

Official source documentation states SStats.net has a free API with statistics, lineups, coefficients, xG/Glicko endpoints; TheSportsDB free API supports some event lineup/statistic lookups but has free-tier result caps; Open-Meteo historical forecasts begin approximately 2022. These descriptions are **discovery candidates, not empirical seven-year RPL coverage**.

## Next concrete evidence steps

1. **SStats.net**: bounded zero-cost documented API metadata read to identify RPL league/season catalog, then first *one or two* historical match summaries with presence-only reporting. No unauthorized scraping, no bulk dump or API-key publication. Verify official terms for private ML training separately.
2. **Venue and coach graph**: establish an independent, dated identity crosswalk for 26 club IDs and historical stadium switches before attaching weather, travel distance or staff effects.
3. **Weather**: choose exact historical venue coordinates, distinguish pre-cutoff archived forecast model runs from post-hoc realized weather. Never feed actual match-day weather into a prior-day prediction.
4. **Odds**: qualify bookmaker identities and time-stamped snapshots; develop the pre-registered paired Log Loss, Brier and RPS benchmark only when verified quotes exist. **Bookmaker superiority not measured.**
5. **Player-level features**: retain event-time source timestamps, published lineup times and historical availability; only match-derived aggregates from completed *earlier* games may feed future-game predictions.

**Restriction:** This evidence does not authorize real new model fitting, opening 2025/26, relaxing the original M2 train-only Poisson constraints or moving to M3. M2 stays 4/8 OPEN. No extra paid services.
