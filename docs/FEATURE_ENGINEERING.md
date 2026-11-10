# Feature engineering (design)

Candidate features: smoothed attack/defence ratings, time-decayed opponent-adjusted form, Elo, home advantage, confirmed suspensions/injuries, rest and schedule congestion, and *only measurable* tactical features. Document origin and availability timestamp per value. Unconfirmed injury rumors, lineup hints published after forecast cutoff and post-match statistics for the target game are prohibited.

Each feature family requires ablation against baseline and validation by season; exclude weak and non-reproducible features. If provider xG definitions differ, keep them separate rather than merging into one uninterpretable column. No feature generation is active at M0.

## M3 additional tactical research backlog (2026-11-10)

See [13 unvalidated tactical hypotheses](TACTICAL_HYPOTHESES_2026-11-10.md) and [machine-readable register](TACTICAL_HYPOTHESIS_REGISTRY_2026-11-10.json), tracked in [#284](https://github.com/StanleyLl0yd/FootballForecast/issues/284). The existing historical source did not expose event/player/lineup/xG candidate fields in its sampled first 350 rows; entire source availability is undetermined. No player-compatibility scores are inferred from results, no match's own post-match events enter its pregame forecast, and no source/post-publication time is fabricated. M3-A3 eligibility, authenticated historical timestamps and usage rights gate any real feature extraction. Score-state and open-play/set-piece splits may be tested only on licensed historical event data of sufficient per-season completeness, while off-ball geometry and synchronized pressing require tracking or audited video. First register an ablation and frozen fold protocol; no production model change.
