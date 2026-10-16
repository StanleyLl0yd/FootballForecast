# Model methodology

M0 only implements a deterministic independent-Poisson distribution generator which accepts externally supplied non-negative intensities. **No team strength has been learned.** The input intensities are not real match predictions and must not be shown as such.

Proposed M2: estimate attack/defence strengths and home advantage on approved historical training data. Implement Dixon–Coles low-score adjustment with identifiability constraint and normalized score probabilities. Add Elo ratings and separately validated 1X2 calibration. CatBoost and ensembles remain M5 research topics pending sufficient sample sizes.

Poisson module returns 1X2 probabilities integrated with adaptive score support and retains the explicitly quantified probability mass omitted from the display grid. Unit tests cover symmetry, point-mass zero case, extreme intensities and tail invariance. Hyperparameters cannot be chosen by peeking at test seasons.
