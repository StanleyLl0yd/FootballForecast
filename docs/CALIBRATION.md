# Calibration methodology (design)

Candidate methods: temperature scaling, multiclass-appropriate sigmoid calibration, isotonic only with adequate data and temporal held-out validation. A calibration status becomes validated only after evaluation on held-out forecasts not used to select the calibrator. Group reliability diagrams by outcome and probability band, include counts and uncertainty intervals. Small samples must be labelled inconclusive.

All published 1X2 probabilities are finite, in [0,1], and sum to 1. Calibration must not alter the immutable raw model prediction record in place; publish a new version/revision. Compare marginal errors for favorites, draws, away matches, short rest and missing data.
