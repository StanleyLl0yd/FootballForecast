# Scoring and evaluation

Core scoring functions use categories H/D/A, ordered in that sequence. Log Loss = negative log probability of realized outcome (clipped to 1e-15 for numerical finiteness). Multiclass Brier = sum of squared per-class errors (not divided by 3). Ranked Probability Score = sum of squared errors of the first two cumulative category thresholds (H, H+D); this normalization is explicitly retained across experiments.

For final reporting: record N, season/competition, matched forecasts, mean scores, paired differences, block/bootstrap confidence intervals with disclosed clustering scheme, calibration diagrams and an unambiguous baseline. Accuracy alone is insufficient. Bookmaker odds must be timestamp-aligned to the model forecast; closing odds are a separate diagnostic.

No real evaluations exist at M0. Toy values in tests are mathematical fixtures and must not be displayed as match predictions.
