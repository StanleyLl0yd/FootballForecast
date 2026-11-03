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

## Follow-up

An owner-only importer is prepared in `.github/workflows/m2-openfoot-private-history.yml`, `scripts/m2-openfoot-private-history-{run.sh,validate.mjs}` and `ml/src/football_forecast/research/openfoot_history_store.py`. It re-acquires exactly the seven development seasons from documented free team-filter API requests, validates two team views, normalizes each finished score, computes per-season SHA-256 checksums, then performs an atomic private PostgreSQL transaction with a full 240-row readback per season. Exact repeated season snapshots are deduplicated; changed revisions are immutable. Source records never enter PRs, CI logs or downloadable artifacts.

**Execution is not yet completed.** Only after guarded squash, exact-main CI and live migration verification, run the exact `/m2-openfoot-private-archive` owner command on issue #182 or protected `ARCHIVE_PRIVATE_SEVEN_SEASONS` workflow dispatch. Accept storage only when all seven season snapshots and 1,680 match rows have been re-read and verified on the real Frankfurt database. The archive remains `development_source_only` and cannot authorize model training or held-out evaluation. Next preregister a **separate** expanding-window seven-season modelling experiment without opening sealed 2025/26 or changing existing M2 locks.
