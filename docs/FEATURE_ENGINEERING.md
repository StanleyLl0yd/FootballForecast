# Feature engineering (design)

Candidate features: smoothed attack/defence ratings, time-decayed opponent-adjusted form, Elo, home advantage, confirmed suspensions/injuries, rest and schedule congestion, and *only measurable* tactical features. Document origin and availability timestamp per value. Unconfirmed injury rumors, lineup hints published after forecast cutoff and post-match statistics for the target game are prohibited.

Each feature family requires ablation against baseline and validation by season; exclude weak and non-reproducible features. If provider xG definitions differ, keep them separate rather than merging into one uninterpretable column. No feature generation is active at M0.
