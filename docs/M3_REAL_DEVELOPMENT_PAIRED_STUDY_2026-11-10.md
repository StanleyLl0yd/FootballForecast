# M3 real development-only paired study · 2026-11-10

Status: **EXPLORATORY, NOT M3-A3/A4/A5 ACCEPTANCE**. Tracks [#271](https://github.com/StanleyLl0yd/FootballForecast/issues/271). The owner's broad source-use authorization is recorded [in #271](https://github.com/StanleyLl0yd/FootballForecast/issues/271#issuecomment-6777156574); do not prolong this work seeking speculative source permissions. Known real third-party restrictions remain applicable.

## What actually ran

`research/sql/m3_development_poisson_observation.sql` was **executed against the existing FootballForecast Supabase PostgreSQL 17** as one SELECT-only statement. It reads the two already-existing private historical development tables; returns **only five rows of fold-level aggregate scores**. No match IDs, team IDs, individual fixtures, labels, dates, model parameters or credentials are selected into output. The query does not write any tables, change RLS/permissions, create functions or call an HTTP endpoint. The exact SQL is in version control so the owner's subsequent re-run is reproducible. Do not commit database outputs or export fixture rows publicly.

The database schema is restricted by the SQL to exactly these **seven seasons**: 2018/19–2024/25. The consumed 2025/26 holdout and 2026/27 are not queried, and neither M2 escrow nor the production model is read.

The query requires precisely **seven distinct development years**, 240 matches, 16 home and 16 away clubs, 240 directed pairs per year, only `finished` records with bounded scores, plus **exactly seven uniquely matched administrative candidates**. Any failed gate returns **zero result rows**, rather than a plausible-looking score. Explicit negative live executions were performed: changing one known 0:3 exception to 0:4 and changing the 240-match denominator both returned **no result rows**. These are semantic checks; the Python static contract tests are separate checks and not a security sandbox.

## Candidate-label protocol and limitations

The original private archive has **1,680 provider-finished rows**. This experiment does **not** falsely certify all of them as played. Seven unique date-and-direction-score candidates are withheld: four 2019/20 non-played technical awards, two 2020/21 technical awards, and the 2022/23 Pari NN–Torpedo played 1:1 / later official 0:3 revision. These seven were previously corroborated with independent public evidence and exact uniqueness checks. Withholding is a **reversible experimental exclusion**, not editing source or declaring the other 1,673 scores independently certified.

The matched five validation folds contain 1,197 scored provider-result candidates (nominal 1,200; three excluded during validation); earlier training cohorts contain respectively 476, 714, 954, 1,193, 1,433 candidates. All matches of a validation season are excluded from that fold's fit; earlier completed years can train later folds. **No same-season or future outcome enters a fold's training**. Historical pre-match first-serving times are not assumed, because the model uses only completed *prior seasons* and immutable home/away identities; report classification is `NON_STRICT_RETROSPECTIVE`, not authentic timestamp-as-of.

## Models and comparison

Both models are evaluated on the **same exact scored fixtures** in one SQL statement:
- Fixed H/D/A Dirichlet(1,1,1) baseline, frozen before observing real development scores.
- Fixed team Poisson with home/away attack-defence and shrinkage: team pseudo-matches 12, league pseudo-matches 20, home/away priors 1.35/1.05, intensities clamped to 0.05–6.0. Parameters match `m3_synthetic_team_poisson.py`; real historical source team IDs are used **only inside the read-only database execution**.
- Independent Poisson grid over 0–30 goals, normalized to sum to one. For maximum lambda 6 the truncated tail is negligible relative to six-decimal reported scores, but this is a SQL crossimplementation rather than bit-for-bit identity with the adaptive Python integrator.
- Multiclass Log Loss, sum-of-three Brier, two-threshold RPS in H/D/A order; per-fold paired Log Loss gain, approximate normal 95% per-fixture standard-error half-width, abstention count and unseen-team candidate count.

The preliminary Poisson candidate lowered each of the three proper scoring metrics on the common cohort relative to the fixed frequency baseline, across five folds. **This is exploratory real-data evidence, not a sealed independent test, not proof of statistical superiority, not bookmaker comparison, and not license to publish forecasts**. The approximate per-fixture confidence interval ignores serial/team dependence; it must not be presented as a confirmatory result.

## Next milestone-critical work

1. Provide an explicit development-only source-selection and match-label protocol prioritizing actual matches over hypothetical rights attestations. Use the already evidenced 1,200/1,200 five-season correspondence and obtain the full 480-record fixture-level reference for 2021/22 and 2022/23; verify independently plausible matches, especially revised 2023 outcome. Keep clear candidate vs certified counts.
2. Encapsulate this SQL calculation in a reviewed owner-only job (no public privileged endpoint) with private report storage or protected owner UI and immutable **aggregate-only** SHA receipt. Consider implementation-parity checks between the SQL score grid and Python Poisson primitive on synthetic data.
3. Independently validate the historical club-ID continuity assumption and how excluded/uncertain matches affect the candidate's score, then decide which scope of A3/A4/A5 can be accepted under the owner's revised source policy. Keep M3 **2/8** until that decision.

This observation does not reopen, read or re-score the once-consumed 2025/26 holdout and does not modify the fixed M2 model.
