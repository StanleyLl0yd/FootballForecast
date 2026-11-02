# M2 pre-holdout lock — bounded research design

**Status (2026-11-02): implementation and synthetic tests only.** This is NOT a real lock,
training run, retrospective benchmark, or independent proof of publisher authority.
M2 #182 remains **3/8 complete** until a permitted one-time study satisfies its
acceptance checks. The 2025/26 sealed cohort must not be opened by this step.

## Contract

`football_forecast.research.locking.prepare_pre_holdout_lock` accepts only:

1. A pre-authorized private read cursor plus pinned immutable snapshot UUID and
   **exact** 64-hex Footbolno CSV SHA-256. The existing 240-row SQL/Python
   2024/25-only `train_baseline` gate runs before fit.
2. A caller-pinned 40-hex Git commit SHA for the *executing* research code;
   this function validates syntax, not the GitHub runner's identity.
3. A **predeclared**, one-to-one mapping of the 16 train-season source club IDs
   to 16 canonical identifiers, constructed and reviewed *without consulting*
   2025/26 results. No data-derived or holdout-optimized aliases.
4. A bounded, trusted-worker-generated 240/240 Footbolno–OpenFootball directed
   fixture comparison: identical scores, dates, status, no awarded games, pinned
   OpenFootball Git blob `6d8b62e4345df9ccd00e98c3bf6a91757b7dc8bc`,
   and CSV hash equal to the selected snapshot. A stale aggregate report or
   a boolean “verified” is insufficient. A JSON object supplied by an untrusted
   caller is **not** independent corroboration.

On success it fits exactly one fixed-v1 ridge-Poisson research model *in memory*,
without manufacturing a `finished_at` timestamp. It returns only a JSON-safe
attestation: protocol/version, pinned code/source SHA, hashed snapshot identity,
SHA-256 of deterministically serialized private training rows, canonical club
mapping and float-hex serialized fitted model, 240/16 counts and training-only
H/D/A prior counts. Raw fixtures, club identifiers, model coefficients and
source rows are **never** returned or stored by this module.

Hash rules: UTF-8 JSON, sorted object keys, compact separators, no NaN/Infinity;
training rows sorted by validated kickoff/ID; fitted float coefficients encoded
via `float.hex()`. Any changed input, code SHA, mapping or model is a new study.
The attestation is **not immutable by itself**: before consuming any holdout
label, the trusted job must pin its runner/compiler environment, fix repository
code SHA, and anchor the full attestation in a protected immutable study record
that the evaluator can independently verify. Until such protected anchoring and
a verified comparison to the *exact* source revision exist, no holdout read.

## Restrictions and remaining integration

No new SQL privilege, production training, evaluation, model publication, GitHub
Actions dispatch, new paid service or browser write ability is introduced.
Automated CI is synthetic-only. The prior M1 OpenFootball gate offers
match-by-match **publisher consistency**, not verified independent *original*
authorship, official scores, or historical pre-kickoff as-of snapshots.

A later owner-authorized guarded research runner must validate trusted proof
generation and the exact locked source revision, guard resource bounds, persist
only non-raw aggregate evidence, independently verify the lock, and **then**
perform at most one fixed non-strict retrospective 2025/26 evaluation. No
hyperparameter tuning, calibration, team mapping adjustments or holdout score
debugging are allowed. Even a resulting score is not authenticated historical
walk-forward accuracy. Unseen clubs must abstain.

References: [baseline protocol](M2_BASELINE_PROTOCOL.md),
[private input contract](M2_TRAINING_INPUT.md),
[tracking issue #182](https://github.com/StanleyLl0yd/FootballForecast/issues/182).
