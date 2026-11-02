# M2 pre-holdout lock — bounded research design

**Status (2026-11-02): bounded implementation and synthetic tests plus two real, reproducible, ephemeral source-offline train-only fits.** These are NOT an approved pre-holdout lock, retrospective benchmark or independent proof of publisher authority.
M2 #182 remains **4/8 complete** (the conditional Elo/Dixon–Coles deferral is accepted); a permitted one-time study still must satisfy its
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

## Guarded train-only runner and independent stored-snapshot preflight

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
publisher has changed, no fit is attempted. Following two independently observed
2026-11-02 GitHub Runner DNS timeouts before training (run 41436355466,
attempts 1–2), the same HTTPS origin may be retried with bounded DNS-over-HTTPS
public A records and `curl --resolve`; the hostname's TLS certificate, original
URL, maximum bytes and exact SHA-256 are unchanged. Only public IPv4 addresses
are accepted, with no arbitrary caller-supplied host, redirect or private IP.
If DNS, HTTPS or bytes fail, training still refuses. It independently retrieves the
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
No source-corroborated real lock has been produced by this workflow. Stored-snapshot preflight and two temporary, independently repeated fits succeeded without rechecking the unavailable publisher. The lack of independent third
validation cohort defers Elo/Dixon–Coles selection and calibration; training
these candidates for holdout selection is prohibited.

## Source-outage path: stored snapshot preflight (no training)

When Footbolno is unavailable, the same protected manual workflow accepts only
the exact owner-written issue #182 comment `/m2-preflight 038fde66188771bccf40ef8b8a219b269fdfe5c30708c0d3243021ab00279a9f`.
This invokes `runner --preflight`, which performs one repeatable-read,
read-only transaction against the **existing approved private snapshot** pinned
by the unchanged Footbolno CSV SHA. It requires the same private certificate,
SQL permissions, unique approved source record, 720-row envelope and 240
verified 2024/25 train-only records (16 clubs, 30 appearances each).

The bounded JSON report contains only the pinned code/source SHA, a hash of
snapshot identity, train count and explicit `externalSourceRechecked: false`,
`modelFitted: false`, `holdoutRead: false`. It cannot be used as the
pre-holdout model lock, does not re-assert publisher availability, does not
train, and does not permit opening the sealed 2025/26 labels.
No private team identifiers or match rows are printed or uploaded.

## Source-outage research candidate (not a protected lock)

The owner may post the exact issue #182 command `/m2-candidate 038fde66188771bccf40ef8b8a219b269fdfe5c30708c0d3243021ab00279a9f` to run one
ephemeral fit **only** on the already stored, approved 2024/25 train cohort.
The shared strict read-only SQL contract and private certificate are enforced;
the source is not fetched. The fixed Independent-Poisson v1 parameters are
the same as those used by the future corroborated lock runner. The model is
discarded in memory after returning a bounded aggregate of training row,
club mapping, model and snapshot fingerprints.

The result explicitly declares `modelFitted: true` but
`preHoldoutLockApproved: false`, `externalSourceRechecked: false`,
`holdoutRead: false` and `modelAccuracyEvaluated: false`. It is not a
production-trained or approved model and **must not** be used to read/score
the 2025/26 sealed holdout. Its deterministic fingerprints can later be
compared against an independently source-corroborated protected lock, without
changing the frozen protocol or tuning on any target labels.

## Observed private research evidence (2026-11-02)

- Protected [preflight #41442233583](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41442233583): read-only Supabase 240/16 train cohort, **PASS**, no model fit.
- Two distinct protected train-only candidate runs [#41443294566](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41443294566) and [#41443547849](https://github.com/StanleyLl0yd/FootballForecast/actions/runs/41443547849): **PASS** on exactly the same code SHA `34570293d603d63fadd0f31cda34e88fb4ee9c4f`.
- Both runs independently emitted the same `snapshotIdentitySha256=afe82bbf33d6e547403ef1ce9505493a655661e0e0f78dffecaea9e857f5b191`, `trainRowsSha256=991a97c6535eae244f8e6fa8189e3408d5c883f15da0423d9aa1be663628fe4e`, `clubMappingSha256=9650628b4d11b608a7e0d1afefa6fec94b514f4cccb937b20af360c802c68997`, and `fittedModelSha256=c4145f27d33eee3c77276ec78a838c491c226b80362588ce6c709869cad0b6f1`.
- Complete bounded aggregate receipt SHA-256: `56d7ca8b1e40832718b971dd857bc51bf4a7c3146ec98ebbeb481374b348b36e`, independently recomputed from the logged JSON including its final newline. Full evidence is linked in [M2 issue #182](https://github.com/StanleyLl0yd/FootballForecast/issues/182#issuecomment-6576955508).
- **Not accepted:** `externalSourceRechecked=false`, `preHoldoutLockApproved=false`, `modelAccuracyEvaluated=false`, `holdoutRead=false`. Models were discarded after SHA generation; no coefficients, raw data, test labels or predictions were published. Even repeated agreement of ephemeral digests is **not** a source-authenticated immutable model lock.

Remaining block: verify the exact Footbolno CSV revision when HTTPS service is restored, independently corroborate its 240 directed fixtures, pin model and environment in a protected accepted record **before** any future one-off holdout evaluation. The already fixed M2 protocol and sealed cohort must not change to compensate for source outage.

## Local comparison of two train-only candidate receipts

The browser Models laboratory includes a **local-only** viewer for two
`M2_STORED_TRAIN_CANDIDATE` JSON receipts from separate protected runs.
It validates an exact 17-key aggregate-only allowlist, fixed 240/16 training
scope, explicitly false external-source/approval/holdout/accuracy flags and
six SHA fields; it reports all differing identity fields or their equality.
Files are read in browser memory (up to 16 KiB each), never uploaded, persisted,
submitted to a research job or used to query the sealed cohort.

The comparison detects accidental differences in *supplied* receipts. It does
not authenticate GitHub Actions, independently verify the original source,
prove the reports came from two executions or approve a pre-holdout lock. Only
protected independently reviewed, immutable evidence can establish those
facts. Existing test-scope restrictions remain unchanged.

## Pinned two-run source-offline evidence (2026-11-02)

The aggregate-only machine evidence is in
[`M2_STORED_TRAIN_REPLAY_EVIDENCE.json`](M2_STORED_TRAIN_REPLAY_EVIDENCE.json).
It was derived from the **two separately executed, successful protected GitHub
Actions job logs**, whose complete `M2_PRIVATE_CANDIDATE_JSON` payloads and logged
receipt SHA-256 agree. A Node regression test recomputes the exact newline-
terminated serialized SHA-256, enforces the strict 17-field allowlist and
distinct run/job identities, and forbids any private raw records or predictions.
The Models page renders this pinned observation without requiring visitors to
download and upload copies of the two JSON lines.

This is a reproducibility observation, **not an immutable approved pre-holdout
lock**: Footbolno was not rechecked, no external fixture comparison was
performed, no source-verified anchor or protected model coefficients exist,
and the 2025/26 sealed holdout was never read. Future independent proof must
be generated from the exact publisher revision before an approved model lock.


## Synthetic-only anchor-request envelope (not an accepted lock)

\`football_forecast.research.anchor.build_study_anchor_request\` creates an
aggregate-only **PENDING_INDEPENDENT_REVIEW** record from a source-corroborated
\`PreHoldoutLock\` structure and explicitly pinned execution evidence. It hashes
the canonical JSON attestation and comparison report, binds the workflow run/job
and code SHA, and requires hashes of the runner image, dependency manifest and
**separately secured private fitted-model artifact**. The function does not
download bytes, verify GitHub identities, review source independence, write an
artifact or store a reconstructible model. It has no holdout read path.

This is a **schema-preparation primitive, not an approval mechanism**: a
caller-supplied source comparison, environment hash or job ID is not inherently
trustworthy. All output forces \`reviewState=PENDING_INDEPENDENT_REVIEW\` and
\`holdoutAccessAuthorized=false\`; no evaluator consumes these requests. The
current offline train-only candidate is ineligible: its source was not rechecked,
and no private model coefficient artifact is durably escrowed.

Before any future one-time evaluation, a separately reviewed protected process
must prove the exact publisher bytes and match-by-match corroboration, verify the
job/code/environment/dependency attestations against trusted origins, securely
persist the private fixed model with independent hash/read controls, commit a
reviewed immutable study record to protected history, independently verify that
commit ancestry and record identity **before any holdout identity/label query**,
and enforce single-use. None of those external attestations, approvals or
holdout operations is implemented or authorized by this preparatory change.
