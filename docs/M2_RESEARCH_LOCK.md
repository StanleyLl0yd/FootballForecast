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

No new SQL privilege, production evaluation, model publication, paid service or
browser write ability is introduced.
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

## Offline aggregate scorer (synthetic tests only)

`football_forecast.research.evaluate.evaluate_fixed_locked_holdout` is a pure
function for a *future* trusted, one-time benchmark: it verifies the locked
model fingerprint and same immutable snapshot, rejects role/season/score/date
violations, abstains on unseen train clubs, and computes aggregate N, exclusion
counts and mean multiclass Log Loss, Brier (H/D/A sum), and two-threshold RPS.
The comparator is frozen training-only H/D/A frequency. It has **no database
access**, does not train, tune or publish, and is tested with synthetic labels
only. A caller must verify/anchor the lock **before retrieving any real holdout
label**. No legitimate original historical publisher snapshot or round cluster
proof exists; uncertainty is explicitly `INCONCLUSIVE` and any future result
is non-strict descriptive research, not authenticated pre-match accuracy.

## Guarded train-only runner (prepared, not dispatched)

A **manual-only** protected GitHub Action `.github/workflows/m2-manual-research-lock.yml`
prepares one candidate lock from the same private role-gated train cohort. Only
the repository owner may dispatch `LOCK_TRAIN_ONLY` from protected `main`
with the **exact approved immutable Footbolno CSV SHA-256**, or post the
single exact command `/m2-lock 038fde66188771bccf40ef8b8a219b269fdfe5c30708c0d3243021ab00279a9f` as a newly created comment
on [M2 issue #182](https://github.com/StanleyLl0yd/FootballForecast/issues/182).
This second GitHub-native manual trigger exists solely for connected administration
when `workflow_dispatch` is unavailable: the job additionally gates the event type,
owner GitHub identity, `OWNER` association, exact comment body, issue number,
non-PR issue, repository, and default branch. Both entrypoints share one
protected environment, one 10-minute bounded read-only job, and the same pinned
source SHA enforcement. Posting an arbitrary comment cannot start training. It refuses any mismatch
between the downloaded current CSV and pinned private source version; if the
publisher has changed, no fit is attempted. It independently retrieves the
pinned OpenFootball text, checks exact 240/240 score and UTC-date agreement,
and enforces reviewed Supabase CA / private read-only PostgreSQL transaction.
The mapping is deterministic from *training-season source club IDs only* using
SHA256 aliases; its cross-season continuity is not independently certified.

Temporary downloaded inputs are deleted; only allowlisted aggregate digests and
training H/D/A counts appear in the GitHub job summary and bounded log markers.
The exact public-safe JSON is validated against the strict browser-viewer schema
before logging so a privileged row cannot accidentally enter the attestation.
The markers enable independent digest verification and later protected Git anchoring. The job has no write SQL and **no 2025/26 result-label/identity read path**;
the pre-existing SQL input contract checks only the sealed role/count envelope. A successful protected run is a reproducible *candidate attestation*,
not an immutable approved model record; the owner must verify and separately
anchor its exact result in protected Git history before any holdout evaluation.
The workflow is not triggered on push, PR or schedule; its issue-comment
entrypoint is an explicit, owner-authored manual action, not a periodic event.
No run/real fit has been performed as part of preparing this workflow. The lack of independent third
validation cohort defers Elo/Dixon–Coles selection and calibration; training
these candidates for holdout selection is prohibited.
