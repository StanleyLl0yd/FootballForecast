# Model methodology

M0 only implements a deterministic independent-Poisson distribution generator which accepts externally supplied non-negative intensities. **No team strength has been learned.** The input intensities are not real match predictions and must not be shown as such.

**M2 is OPEN (owner 2026-11-02)**, with the frozen [M2 independent-Poisson baseline v1](M2_BASELINE_PROTOCOL.md): fixed regularization, centered identifiable team effects, shared home advantage and cautious insufficient-data abstention. Train only on verified 2024/25 matches; never use 2025/26 sealed labels for fitting, coefficient selection or calibration. Implement a synthetic-only deterministic fit before connecting protected real input. Dixon–Coles and Elo are conditional research candidates, **not** an excuse to tune against the sealed holdout; independent calibration belongs to M3, which remains closed. CatBoost and ensembles remain later research topics pending adequate validation.

Poisson module returns 1X2 probabilities integrated with adaptive score support and retains the explicitly quantified probability mass omitted from the display grid. Unit tests cover symmetry, point-mass zero case, extreme intensities and tail invariance. Hyperparameters cannot be chosen by peeking at test seasons.
