# M2 private RPL history storage — source-only development input

**2026-11-03 owner research direction:** personal, noncommercial and potentially private-only RPL forecasting. The seven seasons 2018/19–2024/25 are a development *candidate*, not an approved 2025/26 evaluation or replacement for the frozen 2024/25 M2 Poisson baseline.

## Empirical source coverage

Owner-only [run #41662712300](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41662712300) queried 7 first pages plus 112 team-filtered pages on authenticated free OpenFoot Starter. All seven development seasons contained exactly **240** structurally distinct, 16-club, finished fixtures with 240 numeric nested `score.home`/`score.away` pairs, explicit UTC kickoffs and two mutually consistent team views per match. Total: **1,680**. No data rows, scores, club IDs or credentials were published; only [closed-schema SHA/count evidence](M2_SEVEN_SEASON_FINAL_SCORE_EVIDENCE.json) is in Git.

This is intra-provider cross-confirmation, **not** independent official record certification, original historical source publication evidence, a validated bookmaker benchmark, or a right to resell or publish raw data. The private source URI, response fingerprint and acquisition time remain truthful. No future or 2025/26 records were read.

## Private storage

`database/migrations/0013_m2_private_rpl_history.sql` defines independent `ff_private.ff_rpl_history_snapshots` and `ff_private.ff_rpl_history_matches`. They use:
- An exact season allowlist **excluding 2025/26**; roles limited to `development_source_only`.
- One append-only snapshot with 240 records per season, source-page hash, normalized rows hash, retrieval date and initiating protected run ID.
- A deferred database-level invariant requiring 240 games, 16 clubs, and exactly 15 home / 15 away appearances per club; invalid or missing scores, duplicate fixtures or invalid season dates are rejected.
- No publication timestamp inferred from retrospective retrieval; `historical_prematch_verified=false`, `model_training_approved=false` and `holdout_read=false` are fixed by CHECK constraints.
- Private schema, **FORCE RLS**, no anonymous, authenticated or service-role grants, and append-only UPDATE/DELETE/TRUNCATE rejection.

Only trusted PostgreSQL role(s) can insert; never grant a browser route access to source rows. The research schema does not activate a publisher integration, retrain M2, modify public `ff_matches`, activate forecasts, or approve any independent study. Supabase data storage capacity and Source API Starter quotas remain capped at $0.

## Protected import implementation — pending real run

Owner-only `.github/workflows/m2-private-rpl-history-import.yml` offers explicit `STORE_RPL_SEVEN_SEASONS_PRIVATE` workflow dispatch or owner issue #182 command `/m2-private-rpl-history`. It re-fetches 119 bounded Starter pages, paced below the free quota, and validates complete two-team agreement for all 1,680 finished matches **before** any PostgreSQL write. All raw provider pages and canonical normalized rows stay only in a protected GitHub runner temporary directory, deleted on exit. `scripts/m2-private-rpl-history-normalize.mjs` returns a closed-schema private JSON file, never stdout rows. `football_forecast.data.rpl_private_history` independently checks season role, timestamps, uniqueness, 15/15 home-away balance, result integrity and canonical SHA, and commits seven seasons in one privileged transaction. A repeated identical dataset is idempotent and verified against stored private rows. Source revisions are immutable; conflicting identities fail closed. Only an allowlisted aggregate receipt can appear in job logs. Production import is **not** yet claimed until a protected real run succeeds and independent DB queries confirm it.

## Follow-up

Implement a separate protected owner-only importer using the free documented team-filter API, bounded by the same source limits and a pinned Git SHA. Require safe idempotent insertion, two-view matching, canonical full-season normalized hashes and an aggregate-only live verification query before claiming data was stored. Any legitimate changed source response is a new immutable revision; never silently overwrite historical rows. Only then preregister a **separate** expanding-window seven-season modelling experiment without opening sealed 2025/26 or changing existing M2 locks.
