# Scoring and evaluation

**CURRENT M2 MEASUREMENT (2026-11-09):** The single protected owner-only [first score](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/42590191735) used a frozen 2024/25 Poisson model on 182 of 240 complete 2025/26 matches, with 58 precommitted abstentions. Its private Log Loss/Brier/RPS and top-1 metrics are immutable in Supabase and were compared against the 2024/25 training H/D/A prior. This is `DAY_ONLY / NON_STRICT_RETROSPECTIVE`, **not** time-authenticated pre-match prediction, calibrated production performance, bookmaker superiority or a reusable holdout. Exact response CSV bytes were not archived; do not imply independent bit-for-bit replay or rerun. [Exit audit](M2_EXIT_AUDIT_2026-11-09.md). The M0-only text below is historical.


Core scoring functions use categories H/D/A, ordered in that sequence. Log Loss = negative log probability of realized outcome (clipped to 1e-15 for numerical finiteness). Multiclass Brier = sum of squared per-class errors (not divided by 3). Ranked Probability Score = sum of squared errors of the first two cumulative category thresholds (H, H+D); this normalization is explicitly retained across experiments.

For final reporting: record N, season/competition, matched forecasts, mean scores, paired differences, block/bootstrap confidence intervals with disclosed clustering scheme, calibration diagrams and an unambiguous baseline. Accuracy alone is insufficient. Bookmaker odds must be timestamp-aligned to the model forecast; closing odds are a separate diagnostic.

No real evaluations exist at M0. Toy values in tests are mathematical fixtures and must not be displayed as match predictions.
